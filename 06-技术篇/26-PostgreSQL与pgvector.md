# 第26章：PostgreSQL 与 pgvector — Agent 的数据地基

## 引言

到目前为止，你的 agent 都是"无状态"的——每次对话结束，数据就跟着内存一起烟消云散。但在真实项目里，agent 需要记住很多东西：用户的对话历史、订单数据、知识库文档、向量索引、以及"这个用户上一轮聊到哪了"。

这些东西不能全靠内存，得有数据库。这一章，我们给 agent 装上数据地基：**PostgreSQL 负责持久化，pgvector 负责向量检索**。

> **🏭 实际项目怎么做**：在生产里，PostgreSQL + pgvector 是**最务实的选择**——尤其对中小项目和团队。因为大多数人本来就要用 Postgres 存业务数据，pgvector 一个扩展就白送了向量能力，**不用额外维护一套向量数据库**。只有当向量数据量大到千万级、对检索延迟有极致要求时，才会考虑 Milvus / Qdrant / Pinecone 这类专用向量库。另外要标注清楚：**pgvector 的教程和生态 90% 是 Python**（psycopg2、SQLAlchemy），但思路完全通用，TS 侧用 `pg`（node-postgres）一样跑，本章全用 TS 演示。

---

## 26.1 为什么是 PostgreSQL

### 一句话直觉

Postgres 是关系型数据库里的"瑞士军刀"——能干普通存储的活，加个 pgvector 扩展还能干向量检索的活，一套基础设施解决两类需求。

### 前端类比

想想你为什么选 Next.js 而不是"纯前端框架 + 独立后端框架"——因为 Next.js 一个框架把前端 + API 都包了，少一套心智、少一套部署。Postgres + pgvector 是同样的逻辑：一个数据库，同时搞定"结构化数据"和"向量数据"，少跑一个服务。

### 详细原理

Agent 项目里，Postgres 通常承担这些角色：

1. **业务数据持久化**：用户表、订单表、对话记录、配置项
2. **会话状态**：多轮对话的历史消息（第 8 章讲过记忆，落地就是存这里）
3. **向量检索**：RAG 的文档 chunk + 向量（靠 pgvector）
4. **元数据过滤**：向量检索时"只搜某个分类/某个用户的数据"（靠 SQL 的 `WHERE`）

为什么大家偏爱 Postgres 而不是 MySQL？几个关键点：

- **pgvector 扩展**：MySQL 至今没有同等成熟的官方向量扩展（虽有变通方案，但体验差一截）
- **JSONB**：灵活存半结构化数据（比如 agent 的工具调用日志、配置）
- **全文搜索**：`tsvector` 做关键词检索，能和向量检索组合成"混合检索"
- **生态成熟**：事务、索引、备份、监控，全套工具链都很完善

---

## 26.2 用 Docker 一键起 Postgres + pgvector

### 一句话直觉

别手动装数据库——用 Docker 起，一条命令搞定，跟 `npm install` 一样省心。

### 详细原理

pgvector 是 Postgres 的一个扩展，需要装 `pgvector` 这个包。最省事的方式是用官方镜像 `pgvector/pgvector`，它已经把扩展装好了。

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: agent-pg
    environment:
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: agent123
      POSTGRES_DB: agent_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

启动：

```bash
docker compose up -d
```

然后确认扩展可用：

```bash
docker exec -it agent-pg psql -U agent -d agent_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> **坑点提醒**：一定要用 `pgvector/pgvector` 镜像，而不是官方 `postgres` 镜像。官方镜像没装 pgvector 扩展，你还要手动 `apt install` 折腾。

---

## 26.3 pgvector 基础：向量类型与相似度检索

### 一句话直觉

pgvector 给 Postgres 加了一种新的列类型 `vector`，以及配套的相似度运算符——你可以像 `WHERE id = 1` 那样，写 `ORDER BY embedding <-> query_vector` 来"找最相似的"。

### 详细原理

**建表**：加一个 `vector(维度)` 类型的列。

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  embedding vector(1024),   -- 1024 维向量，对应千问 embedding
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**插入向量**：向量以数组形式存储。

```sql
INSERT INTO documents (content, embedding, category)
VALUES ('退款政策：7 天内可退', '[0.01, 0.02, ...]', 'policy');
```

**相似度检索**：用 `<->`（余弦距离）、`<#>`（负内积）、`<=>`（L2 距离）三种运算符。

```sql
-- 找与查询向量最相似的前 5 条，按相似度从高到低排
SELECT id, content, 1 - (embedding <-> $1) AS similarity
FROM documents
ORDER BY embedding <-> $1
LIMIT 5;
```

`<->` 返回的是**距离**（越小越相似），所以 `1 - distance` 是相似度分数。第 9 章讲过，向量检索主流用**余弦相似度**，pgvector 里对应 `<->` 运算符。

### 前端类比

`vector` 列就像给表加了一个"坐标"列；`<->` 运算符就像 SQL 里的 `ORDER BY 距离`——只不过这个"距离"是在 1024 维语义空间里算的，而不是地图上的直线距离。

---

## 26.4 HNSW 索引：让检索快起来

### 一句话直觉

数据少时，暴力扫描（全表算距离）也行；数据一多（几万条以上），就得建索引——否则每次检索都要算所有向量的距离，慢到不可用。

### 详细原理

pgvector 支持两种近似最近邻索引：**IVFFlat** 和 **HNSW**。生产里**优先用 HNSW**（第 9 章讲过它是主流算法，召回率和速度的综合表现更好）。

```sql
-- 建 HNSW 索引（cosine 距离）
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

几个关键点：

1. **`vector_cosine_ops`** 指定用余弦距离建索引，要和查询用的运算符 `<->` 一致
2. **数据量门槛**：数据太少（< 几千条）时建索引反而可能更慢，全表扫更快
3. **索引不会自动更新数据语义**：插入新向量后索引自动维护，但如果你**换了 Embedding 模型**，旧向量的"空间坐标系"全变了，必须**清空重算重插**

> **坑点提醒**：`vector_cosine_ops` 索引对应的查询必须用 `<->`。如果你建的是 `vector_l2_ops` 却用 `<->` 查，索引不生效，会退化成全表扫描——慢得莫名其妙。

---

## 26.5 用 pgvector 做 RAG（对比第 9 章的 Chroma）

### 一句话直觉

第 9 章用 Chroma 做 RAG（本地、零配置），这一章用 pgvector 做同样的事，但数据落在 Postgres 里，和生产环境更近。

### 详细原理

完整流程和第 9 章一样：文档分块 → 向量化 → 存 pgvector → 查询时向量检索 → 塞进 prompt 生成。区别只在"存哪"。

```typescript
// lib/pg-rag.ts —— 用 pgvector 替换 Chroma 的 RAG
import 'dotenv/config';
import pg from 'pg';
import { embed, generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,  // postgres://agent:agent123@localhost:5432/agent_db
});

// 索引：把一段文本向量化后存入
async function indexDoc(content: string, category: string) {
  const { embedding } = await embed({
    model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
    value: content,
  });
  await pool.query(
    'INSERT INTO documents (content, embedding, category) VALUES ($1, $2, $3)',
    [content, JSON.stringify(embedding), category]
  );
}

// 查询：向量检索 + 生成
async function query(question: string, category?: string) {
  const { embedding } = await embed({
    model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
    value: question,
  });

  const vec = JSON.stringify(embedding);
  // 带元数据过滤：只检索指定 category
  const { rows } = await pool.query(
    `SELECT content, 1 - (embedding <-> $1) AS similarity
     FROM documents
     WHERE ($2::text IS NULL OR category = $2)
     ORDER BY embedding <-> $1
     LIMIT 5`,
    [vec, category ?? null]
  );

  const context = rows.map(r => r.content).join('\n---\n');
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    system: '根据参考资料回答，找不到就说不知道。',
    prompt: `参考资料：\n${context}\n\n问题：${question}`,
  });
  return { answer: text, sources: rows };
}
```

### 深层追问

**Chroma 和 pgvector 到底怎么选？**

一句话：**原型/学习用 Chroma（零配置），生产用 pgvector（少一套基础设施）**。第 9 章的选择建议里已经点过，这里再强化一次——如果你的项目本来就有 Postgres，那 pgvector 是"白送"的向量库，没理由再引入 Chroma/Pinecone 增加运维负担。

---

## 26.6 元数据过滤：向量检索 + SQL 条件

### 一句话直觉

纯向量检索是"在所有数据里找最相似的"，但真实需求常常是"**在某个用户的数据里**找最相似的"——这就需要把向量检索和 SQL 的 `WHERE` 组合起来。

### 详细原理

这是 pgvector 相对独立向量库的一大优势：**向量检索和传统过滤天然融合**，因为都在同一个 SQL 里。

```sql
-- 只搜"政策"分类、且最近 30 天创建的文档
SELECT content, 1 - (embedding <-> $1) AS similarity
FROM documents
WHERE category = 'policy'
  AND created_at > now() - interval '30 days'
ORDER BY embedding <-> $1
LIMIT 5;
```

前端类比：这就像你的搜索功能里加了筛选器——"搜索关键词"（向量检索）+ "只看某分类/某价格区间"（WHERE 过滤），两者叠加才能精准命中。

> **坑点提醒**：过滤条件会**先筛掉一部分数据，再做向量检索**。如果过滤条件太严（比如 `WHERE category = 'x'` 但 'x' 类只有 3 条数据），检索结果会很少甚至为空。这是"过滤 + 向量"组合的固有特性，设计时要想清楚过滤粒度。

---

## 26.7 混合检索：向量 + 全文搜索

### 一句话直觉

向量检索擅长"语义相似"，全文搜索擅长"精确关键词"。真实 RAG 系统常常两者结合——这就是混合检索（Hybrid Search）。

### 详细原理

Postgres 原生支持全文搜索（`tsvector` / `tsquery`），所以你能在同一个库里做混合检索：

```sql
-- 全文搜索：找包含"退款"关键词的文档
SELECT content FROM documents
WHERE to_tsvector('simple', content) @@ to_tsquery('simple', '退款');
```

混合检索的思路：**分别跑向量检索和全文检索，把两边的结果按某种方式合并**（比如 RRF，Reciprocal Rank Fusion——倒数排名融合）。第 10 章 RAG 进阶已经讲过混合检索的价值，这里只是告诉你：pgvector + Postgres 全文搜索，能在**一个库**里实现它，不用引入 Elasticsearch。

> 说明：混合检索的完整实现（RRF 合并）偏进阶，第 10 章有详细讲解，本章点到为止——你只需知道 Postgres 有 `tsvector` 全文搜索这个能力。

---

## 概念辨析

### pgvector vs Chroma vs 专用向量库

| | pgvector | Chroma | Pinecone/Milvus/Qdrant |
|---|---|---|---|
| 形态 | Postgres 扩展 | 独立服务（可内嵌） | 独立服务 |
| 运维 | 复用 Postgres，零额外 | 要单独起 | 要单独起/托管 |
| 规模 | 中小规模够用（百万级内） | 开发/原型 | 千万级以上 |
| 过滤 | SQL WHERE，极强 | 支持 | 支持但各不同 |
| 事务 | 有（和业务数据同库） | 无 | 无 |
| 适合 | **生产中小项目首选** | 学习/demo | 大规模专用 |

### PostgreSQL vs Redis（下一章的主角）

| | PostgreSQL | Redis |
|---|---|---|
| 存储 | 持久化、磁盘 | 内存为主 |
| 数据 | 结构化 + 向量 + 全文 | 键值、缓存、队列 |
| 角色 | 数据的地基 | 性能的加速器 |
| 类比 | 仓库 | 手边的抽屉 |

---

## 灵魂拷问

> **Q1：我已经有 Postgres 了，为什么还要学 Redis（下一章）？两者不重复吗？**

> **A：** 不重复，分工不同。Postgres 是"仓库"——数据要**持久保存、可查询、可关联**；Redis 是"手边的抽屉"——**快、易失、扛高频**。比如限流计数、热点缓存、任务队列，这些要的是"纳秒级读写 + 数据丢了也没关系"，放 Postgres 反而又慢又浪费。生产里两者是搭档，不是二选一。

> **Q2：向量存在 pgvector 里，会不会拖慢普通的业务查询？**

> **A：** 不会，只要索引建得对。向量数据和其他数据只是**住在同一个库的不同表**，互不干扰。真正要注意的是：向量插入/更新会维护 HNSW 索引，有写放大（比普通行插入慢），所以**大批量灌入向量时**建议批量提交（一个事务里插多条），而不是逐条 `INSERT`。

> **Q3：换 Embedding 模型会有什么影响？为什么不能"原地升级"？**

> **A：** 换 Embedding 模型 = 换一个语义坐标系。旧模型输出的向量和新模型输出的向量，**不在同一个空间里**，直接拿新模型编码的查询去匹配旧模型编码的文档，结果会完全错乱。所以换模型必须：**清空所有旧向量 → 用新模型重新编码所有文档 → 重新插入**。这也就是第 9 章强调的"文档和查询必须用同一个 Embedding 模型"。

> **Q4：pgvector 的 `ORDER BY embedding <-> $1` 数据一多会很慢吗？怎么解决？**

> **A：** 数据少（几千条）时全表扫描也快；几万条以上就必须建 HNSW 索引（26.4 节），否则每次检索都要算全表距离，延迟会线性增长到秒级。建索引后，检索延迟基本稳定在几十毫秒量级。所以**生产里 HNSW 索引是必须的，不是可选项**。

---

## 最佳实践

### DO

- **DO** 项目里已有 Postgres，就用 pgvector，别额外引入向量库
- **DO** 用 `pgvector/pgvector` 官方镜像起服务，省去手动装扩展
- **DO** 生产环境给向量列建 HNSW 索引，且索引类型（cosine/l2）和查询运算符一致
- **DO** 用 SQL `WHERE` 做元数据过滤，和向量检索组合出精准查询
- **DO** 批量插入向量（一个事务多行），减少写放大
- **DO** 换 Embedding 模型时，清空并重算所有向量

### DON'T

- **DON'T** 用官方 `postgres` 镜像 + 手动装 pgvector，折腾且易错
- **DON'T** 数据量很小（< 几千条）时就急着建索引，可能适得其反
- **DON'T** 把 `vector_l2_ops` 索引配 `<->` 查询用——类型不匹配会退化成全表扫
- **DON'T** 在 `WHERE` 里做太严的过滤导致检索结果为空，注意过滤粒度
- **DON'T** 逐条 `INSERT` 大批量向量，性能会差几个数量级
- **DON'T** 把向量库当成"万能记忆"——它解决的是相似度检索，不是精确查询和业务关联

---

## 代码实战

> **项目归属**：独立 demo 项目。依赖：`pg`、`ai`、`@ai-sdk/deepseek`、`@ai-sdk/openai-compatible`、`dotenv`，`npx tsx` 运行。先按 26.2 用 Docker 起好 Postgres + pgvector，`.env` 配 `DATABASE_URL`、`QWEN_API_KEY`、`DEEPSEEK_API_KEY`。

### 一：初始化（建表 + 建索引 + 建扩展）

```typescript
// 26-init.ts
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      content TEXT,
      embedding vector(1024),
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops)'
  );
  console.log('✅ 初始化完成');
  await pool.end();
}

init().catch(e => { console.error(e); process.exit(1); });
```

### 二：写入向量

```typescript
// 26-index.ts
import 'dotenv/config';
import pg from 'pg';
import { embed } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const docs = [
  { content: '退款政策：购买后 7 天内可无条件退款。', category: 'policy' },
  { content: '发货说明：下单后 48 小时内发货。', category: 'shipping' },
  { content: '产品支持 Windows 10+ 和 macOS 12+。', category: 'faq' },
];

async function main() {
  for (const d of docs) {
    const { embedding } = await embed({
      model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
      value: d.content,
    });
    await pool.query(
      'INSERT INTO documents (content, embedding, category) VALUES ($1, $2, $3)',
      [d.content, JSON.stringify(embedding), d.category]
    );
    console.log(`✅ 已写入：${d.content.slice(0, 20)}...`);
  }
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
```

### 三：向量检索 + 元数据过滤

```typescript
// 26-search.ts
import 'dotenv/config';
import pg from 'pg';
import { embed } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function search(question: string, category?: string) {
  const { embedding } = await embed({
    model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
    value: question,
  });
  const vec = JSON.stringify(embedding);

  const { rows } = await pool.query(
    `SELECT content, 1 - (embedding <-> $1) AS similarity, category
     FROM documents
     WHERE ($2::text IS NULL OR category = $2)
     ORDER BY embedding <-> $1
     LIMIT 3`,
    [vec, category ?? null]
  );

  console.log(`\n🔍 问题：${question}`);
  rows.forEach(r => console.log(`  [${r.category}] (${Number(r.similarity).toFixed(3)}) ${r.content}`));
  await pool.end();
}

search('你们支持哪些操作系统？');
// 不加分类过滤 vs 加过滤，观察结果差异
```

---

## 实操练习

### 目标

把你第 9 章的 RAG demo 从 Chroma 迁移到 pgvector，并加上元数据过滤。

### 步骤

1. 用 Docker 起 Postgres + pgvector（`pgvector/pgvector:pg16`）
2. 写 `26-init.ts` 建表建索引，跑通
3. 准备 5-10 篇文档，分好类别，用 `26-index.ts` 写入向量
4. 写 `26-search.ts`，实现带/不带 category 过滤的检索
5. 对比：同一批数据，Chroma 和 pgvector 的检索结果是否一致

### 验收标准

- [ ] HNSW 索引创建成功（`\d documents` 能看到索引）
- [ ] 能按语义检索到相关文档
- [ ] category 过滤生效：加了过滤后结果只来自指定分类
- [ ] 换一个 Embedding 模型后，能正确清空并重算向量

### 挑战加分项

- [ ] 用 `tsvector` 实现全文搜索，和向量检索结果做简单对比
- [ ] 实现一个简单的 RRF（倒数排名融合）合并两种检索结果

---

## 本章小结

1. **Postgres + pgvector = 一套基础设施解决持久化 + 向量检索**，是生产中小项目的务实首选。

2. **pgvector 用法**：`vector(维度)` 列 + `<->` 余弦距离运算符，`ORDER BY embedding <-> $1` 就是"找最相似的"。

3. **HNSW 索引是生产必需**：数据一多（几万条）就必须建，且索引类型要和查询运算符匹配。

4. **元数据过滤是 pgvector 的核心优势**：向量检索 + SQL `WHERE` 天然融合，不用引入第二套系统。

5. **换 Embedding 模型 = 换坐标系**，必须清空重算所有向量。

6. **生产真相**：教程和生态是 Python 主导，但思路通用，TS 用 `pg` 一样跑；数据量到千万级再考虑专用向量库。

下一章，我们聊聊框架层的"生产真相"——LangGraph 与 LangChain。
