# 第28章：Redis — Agent 的限流、缓存与队列

## 引言

你的 agent 现在有了数据地基（Postgres）和大脑（模型），但还缺一样东西：**当流量涌进来时，怎么不被打垮、怎么不重复花钱、怎么处理耗时任务**。

想象一下：你的 AI 客服突然上了热搜，一秒钟进来 1000 个请求。模型 API 有 QPS 上限，超了会被限流；每个请求都实时调模型，成本暴涨；有些任务（比如批量生成报告）要跑 30 秒，用户不可能干等着。

这些问题，Postgres 解决不了（它不是为了扛高频读写设计的），靠的正是 **Redis**——agent 生产环境里几乎必配的"加速器"。

> **🏭 实际项目怎么做**：Redis 在 agent 生产项目里是**标配配件**，语言无关（Python/TS 都用）。它主要干四件事：**限流**（防止模型 API 被打爆）、**缓存**（相同问题不重复调模型，省钱省时）、**会话状态**（存对话上下文，比存数据库快）、**任务队列**（异步处理耗时任务）。别小看这四件事——少了任何一件，你的 agent 一上量就会崩。

---

## 28.1 为什么 Agent 项目需要 Redis

### 一句话直觉

Redis 是"内存里的极速数据库"——读写快到纳秒级，但数据易失。所以它不存"重要数据"，只存"热点、临时、高频"的数据。

### 前端类比

Redis 之于后端，就像**浏览器缓存 / 内存变量**之于前端。你不会把用户的所有数据都放 `localStorage`（那是数据库的活），但你会把 token、热点数据放进去，因为"快"。

### 详细原理

Agent 项目的四个典型 Redis 场景：

```
① 限流（Rate Limiting）   —— "这个用户 1 分钟最多问 10 次"
② 缓存（Caching）         —— "这个问题昨天问过，直接返回缓存答案"
③ 会话（Session）         —— "这个用户聊到第 3 轮了，上下文存这里"
④ 队列（Queue）           —— "这个耗时任务排队异步执行"
```

它们的共同点：**都是高频、临时、可丢失的数据**——完美契合 Redis 的定位。

---

## 28.2 用 Docker 起 Redis

```yaml
# docker-compose.yml（和上一章的 Postgres 合并即可）
services:
  redis:
    image: redis:7-alpine
    container_name: agent-redis
    ports:
      - "6379:6379"
```

```bash
docker compose up -d redis
docker exec -it agent-redis redis-cli ping   # 返回 PONG 就是通了
```

TS 侧用 `ioredis`：

```typescript
import Redis from 'ioredis';
const redis = new Redis('redis://localhost:6379');
```

---

## 28.3 限流：别让模型 API 被打爆

### 一句话直觉

限流就是"给每个用户/每个 IP 设一个**额度**，超了就拒绝或排队"。模型 API 按 token 计费且有 QPS 上限，不限流等于把钱包和接口都交到别人手里。

### 详细原理

最常用的限流算法是**滑动窗口**（Sliding Window）：统计"过去 N 秒内的请求次数"，超过阈值就拒绝。

Redis 用 `INCR` + `EXPIRE` 实现一个简易计数器（固定窗口）：

```typescript
async function rateLimit(userId: string, limit = 10, windowSec = 60) {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);          // 原子自增
  if (count === 1) {
    await redis.expire(key, windowSec);          // 第一次设置过期时间
  }
  return count <= limit;
}

// 使用
const allowed = await rateLimit('user-123', 10, 60);
if (!allowed) {
  throw new Error('请求太频繁，请稍后再试');
}
```

### 前端类比

这就像防抖（debounce）——限制触发频率。区别是：防抖限制的是"函数调用"，限流限制的是"API 请求"。你在第 23 章性能优化里应该接触过限流的思想，这里落地到 Redis。

> **坑点提醒**：上面是**固定窗口**，边界处有漏洞（第 59 秒和 61 秒各来一批，都算"窗口内未超限"）。生产里更严谨用**滑动窗口**（ZSET 记录每次请求时间戳）或**令牌桶**。但固定窗口对大多数"防止滥用"的场景够用了。

### 深层追问

**为什么用 Redis 限流，而不是 Postgres 或应用内存？**

两个原因：**原子性** 和 **分布式**。`INCR` 是原子操作，多进程/多实例并发也不会计数错乱（Postgres 要 `SELECT ... FOR UPDATE` 加锁，慢）。而且 agent 通常多实例部署，应用内存限流是"各限各的"，Redis 才是全局统一的一本账。

---

## 28.4 缓存：相同问题别重复花钱

### 一句话直觉

模型调用又贵又慢。如果"这个问题刚问过、答案还新鲜"，直接从缓存返回，**省钱 + 提速**。

### 详细原理

两种缓存层次：

**1. 精确缓存（Exact Cache）**：完全相同的问题，直接返回缓存答案。

```typescript
async function askWithCache(question: string) {
  const key = `cache:qa:${hash(question)}`;   // 问题哈希作 key
  const cached = await redis.get(key);
  if (cached) {
    return { answer: cached, hit: true };
  }

  const { text } = await generateText({ model, prompt: question });
  await redis.set(key, text, 'EX', 3600);      // 缓存 1 小时
  return { answer: text, hit: false };
}
```

**2. 语义缓存（Semantic Cache）**：问题措辞不同但语义相同（"怎么退款" vs "如何退钱"），也命中缓存。实现上先 Embedding 再比对相似度，更复杂，但命中率更高。

> **坑点提醒**：缓存有个"新鲜度"陷阱——知识更新了，缓存还是旧答案。所以：**缓存一定要设过期时间（TTL）**，并且**只缓存确定性强的问答**（如 FAQ），别缓存"实时数据"类问题（如"现在天气"）。

### 前端类比

语义缓存就像 React 的 `useMemo`——输入没变就不重算，输入变了重新算。只不过这里的"重算"是调模型。

---

## 28.5 会话状态：上下文存哪

### 一句话直觉

第 8 章讲过对话记忆。落地时，历史消息要么存数据库（慢、持久），要么存 Redis（快、易失）。**短期会话状态放 Redis 最合适。**

### 详细原理

```typescript
// 存当前会话的消息列表
const sessionKey = `session:${userId}`;
await redis.lpush(sessionKey, JSON.stringify({ role: 'user', content: '...' }));
await redis.ltrim(sessionKey, 0, 49);   // 只保留最近 50 条（滑动窗口）
await redis.expire(sessionKey, 86400);  // 会话 24 小时过期
```

典型策略：**热数据（最近对话）放 Redis，冷数据（历史全量）定期归档到 Postgres**。这样读得快，又不丢长期记忆。

---

## 28.6 任务队列：耗时任务异步化

### 一句话直觉

有些 agent 任务要跑几十秒（批量生成、多步推理、外部 API 调用），不能阻塞用户请求。这时把任务丢进队列，后台慢慢跑，跑完再通知。

### 详细原理

TS 生态最常用的队列库是 **BullMQ**（基于 Redis）：

```typescript
import { Queue, Worker } from 'bullmq';

// 生产者：把任务丢进队列
const queue = new Queue('agent-tasks', { connection: { host: 'localhost', port: 6379 } });
await queue.add('generate-report', { userId: 'user-123', topic: '周报' });

// 消费者：后台 Worker 逐个处理
const worker = new Worker('agent-tasks', async (job) => {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    prompt: `生成关于「${job.data.topic}」的报告`,
  });
  // 结果写入数据库或通知用户
  return text;
}, { connection: { host: 'localhost', port: 6379 } });
```

### 前端类比

任务队列就像浏览器的 **Web Worker**——把重活放到后台线程，不阻塞主线程（用户请求）。区别是 BullMQ 是跨进程/跨机器的"后台线程"。

---

## 概念辨析

### Redis vs PostgreSQL

| | Redis | PostgreSQL |
|---|---|---|
| 存储介质 | 内存（快、易失） | 磁盘（慢、持久） |
| 数据模型 | 键值/列表/集合/有序集合 | 关系表 + JSONB + 向量 |
| 典型用途 | 限流/缓存/会话/队列 | 业务数据/向量检索/全文 |
| 类比 | 手边的抽屉 | 仓库 |

### 精确缓存 vs 语义缓存

| | 精确缓存 | 语义缓存 |
|---|---|---|
| 命中条件 | 问题完全相同 | 问题语义相似 |
| 实现 | 哈希 key | Embedding + 相似度 |
| 命中率 | 低 | 高 |
| 复杂度 | 低 | 中 |

---

## 灵魂拷问

> **Q1：Redis 数据在内存里，重启就丢了，那存会话状态安全吗？**

> **A：** 分情况。**短期会话**（最近对话、限流计数、缓存）丢了无所谓，本来就是临时的。但**关键数据**（订单、用户档案）绝不能只存 Redis——那些必须落 Postgres。正确姿势是**分层**：热数据 Redis 加速，冷数据 Postgres 持久化。另外，Redis 支持 RDB/AOF 持久化，真要"重启不丢"也能配置，只是有性能代价。

> **Q2：限流用固定窗口有漏洞，生产里到底用哪个算法？**

> **A：** 看场景。**防滥用/防刷**（大多数场景）：固定窗口够用，简单好维护。**要精确平滑**（比如对外 API 计费）：用令牌桶或滑动窗口（Redis ZSET 实现）。**分布式高并发**：用 Redis 的 Lua 脚本或现成的 `rate-limiter-flexible` 库，别自己造轮子。核心原则：**先简单，够用就别过度设计**。

> **Q3：缓存 LLM 结果会不会导致用户看到过期/错误的信息？**

> **A：** 会，这是缓存最大的风险。缓解手段：**必须设 TTL**（过期时间），并且**只缓存确定性内容**（FAQ、知识库问答），对实时性要求高的（天气、股价、订单状态）**不缓存**。还可以在数据更新时**主动失效**（删缓存 key）。一句话：缓存是"用新鲜度换速度"，你要清楚哪些数据"新鲜度不重要"。

> **Q4：我能不能不搞队列，直接让用户等 30 秒？**

> **A：** 短任务（< 2 秒）可以等；长任务（> 5 秒）必须异步。原因：用户耐心有限（等待超 3 秒流失率飙升）；而且同步长任务会**占满连接**，一个慢请求卡死一片（雪崩）。队列的价值是：**请求快速返回"已受理"，任务后台跑，跑完通知**。这正是第 24 章部署架构里"异步解耦"思想的落地。

---

## 最佳实践

### DO

- **DO** 用 Redis 做限流、缓存、会话、队列四件事，别用 Postgres 硬扛高频读写
- **DO** 缓存一定设 TTL，且只缓存确定性内容
- **DO** 热数据 Redis + 冷数据 Postgres 分层存储
- **DO** 限流计数用 Redis 原子操作（`INCR`），保证分布式下准确
- **DO** 耗时任务（> 5 秒）走队列异步化
- **DO** 生产用 `rate-limiter-flexible` / BullMQ 这类成熟库，别自己手写

### DON'T

- **DON'T** 把关键业务数据只存 Redis（重启就丢）
- **DON'T** 缓存实时性数据（天气、股价、订单状态）
- **DON'T** 用应用内存做限流/会话（多实例不共享，各记各的）
- **DON'T** 让用户同步等待长任务（> 5 秒）
- **DON'T** 忽略缓存的新鲜度陷阱——旧答案比慢答案更伤信任

---

## 代码实战

> **项目归属**：独立 demo 项目。依赖：`ioredis`、`bullmq`、`ai`、`@ai-sdk/deepseek`、`dotenv`。先 `docker compose up -d redis`，`.env` 配 `DEEPSEEK_API_KEY`。

### 一：限流 + 缓存

```typescript
// 28-rate-cache.ts
import 'dotenv/config';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

const redis = new Redis('redis://localhost:6379');

const hash = (s: string) => createHash('md5').update(s).digest('hex');

async function rateLimit(userId: string, limit = 10, windowSec = 60) {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return count <= limit;
}

async function ask(userId: string, question: string) {
  // ① 限流
  if (!(await rateLimit(userId))) {
    return { answer: '请求太频繁，请稍后再试', hit: false, limited: true };
  }

  // ② 精确缓存
  const cacheKey = `cache:qa:${hash(question)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return { answer: cached, hit: true, limited: false };

  // ③ 调模型
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    system: '你是简洁的助手',
    prompt: question,
  });

  await redis.set(cacheKey, text, 'EX', 3600);  // 缓存 1 小时
  return { answer: text, hit: false, limited: false };
}

// 连续问两次相同问题，第二次命中缓存
console.log(await ask('user-1', '什么是 RAG？'));
console.log(await ask('user-1', '什么是 RAG？'));  // hit: true
await redis.quit();
```

### 二：任务队列

```typescript
// 28-queue.ts
import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

const connection = { host: 'localhost', port: 6379 };
const queue = new Queue('agent-tasks', { connection });

// 生产者：加入任务
await queue.add('summarize', { text: '这是一段很长的文章……' });
console.log('✅ 任务已入队');

// 消费者：后台处理
const worker = new Worker('agent-tasks', async (job) => {
  console.log(`⚙️ 处理任务 ${job.id}`);
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    prompt: '用 20 字总结：' + job.data.text,
  });
  console.log('✅ 结果：', text);
  return text;
}, { connection });

// 优雅退出
process.on('SIGINT', async () => {
  await worker.close();
  await queue.close();
  process.exit(0);
});
```

---

## 实操练习

### 目标

给你第 11 章的 agent 加上限流、缓存和队列，让它"扛得住流量"。

### 步骤

1. 起 Redis，写 `28-rate-cache.ts`，验证限流和缓存都生效
2. 把缓存 key 加上 TTL，验证过期后能重新调模型
3. 用 BullMQ 把一个耗时 agent 任务改成异步（入队 + Worker 消费）
4. 用 `redis-cli` 观察 key 的变化（`KEYS *`、`TTL key`）

### 验收标准

- [ ] 同一用户 1 分钟内超 10 次请求被拒绝
- [ ] 相同问题第二次命中缓存（不再调模型）
- [ ] 缓存过期后能重新生成
- [ ] 任务队列能异步处理任务，不阻塞调用方

### 挑战加分项

- [ ] 用 ZSET 实现滑动窗口限流（替代固定窗口）
- [ ] 实现语义缓存：先 Embedding 问题，再判断是否命中相似缓存

---

## 本章小结

1. **Redis 是 agent 生产环境的标配加速器**，定位是"内存极速、数据易失"，不存关键数据。

2. **四大用途**：限流（防打爆）、缓存（省钱提速）、会话（存上下文）、队列（异步化）。

3. **限流**：Redis `INCR` + `EXPIRE` 实现固定窗口，原子且分布式一致。

4. **缓存**：精确缓存（哈希 key）+ 语义缓存（Embedding），必须设 TTL、只缓存确定性内容。

5. **会话**：热数据 Redis + 冷数据 Postgres，分层存储。

6. **队列**：BullMQ 基于 Redis，耗时任务（> 5 秒）异步化，防雪崩。

下一章，给 agent 装上"眼睛"——Langfuse 可观测与评估。
