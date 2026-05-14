# 第10章：RAG 进阶 — 从能用到好用

## 引言

上一章我们搭建了一个能跑的 RAG 系统。但"能跑"和"好用"之间隔着一道鸿沟。

这就像你写了一个 React 应用——能渲染、能交互、不报错。但用户觉得慢、搜索结果不准、偶尔返回莫名其妙的内容。你得做性能优化、搜索调优、错误处理。从 MVP 到生产级，中间要做的事情比想象的多。

RAG 也是一样。你会遇到这些真实的痛点：

- 用户搜"退款"，返回的是关于"付款"的文档——语义相似但不是用户想要的
- 用户搜"Node.js 怎么连数据库"，但文档里写的是"使用 Prisma 进行数据库操作"——关键词对不上
- 检索到了 5 条结果，排第一的是垃圾、排第四的才是正确答案——排序不对
- 用户问了一个模糊的问题"那个东西怎么弄"——检索啥都没检索到

这一章，我们逐一解决这些问题。从分块策略优化、混合检索、重排序、到查询优化和系统评估，带你把 RAG 从"能用"推到"好用"。

---

## 10.1 分块策略进阶

### 一句话直觉

分块方式决定了你"切蛋糕"的方法——切得好，每块都有奶油和水果；切得差，有的全是面包有的全是奶油。

### 上一章的问题

上一章我们用了最简单的固定大小分块——每 500 字切一刀。这就像你把一篇文章每隔 500 字就剪一下，不管是不是在句子中间、段落中间、甚至一个词的中间。显然不够好。

### 固定大小分块（Fixed-size Chunking）

```
优点：简单、可预测、容易并行处理
缺点：可能切断句子、段落、甚至代码块
适合：格式统一的纯文本（如新闻、博客文章）
```

实际使用时的改进：**在分隔符处切割**。不是严格按字符数切，而是在最近的句号、换行符处切。

```typescript
// 改进版：优先在自然边界处切割
function smartChunk(text: string, maxSize: number = 500): string[] {
  const separators = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? '];
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining.trim());
      break;
    }

    // 在 maxSize 范围内找最后一个分隔符
    let splitAt = -1;
    for (const sep of separators) {
      const idx = remaining.lastIndexOf(sep, maxSize);
      if (idx > maxSize * 0.3) { // 至少要在 30% 之后切，避免太小的 chunk
        splitAt = idx + sep.length;
        break;
      }
    }

    // 找不到合适的分隔符，就硬切
    if (splitAt === -1) splitAt = maxSize;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt);
  }

  return chunks.filter(c => c.length > 0);
}
```

### 语义分块（Semantic Chunking）

**原理**：根据语义变化来决定在哪里切割。如果相邻两段文字在讨论不同的话题，就应该分成不同的 chunk。

前端类比：想象你在做一个无限滚动的 Feed 流。固定分块就是"每 10 条一组"，不管内容是什么；语义分块就是"把相关的内容分在一组"——一组是技术文章、一组是产品资讯、一组是用户讨论。

**实现思路**：
1. 先把文档按句子切分
2. 计算相邻句子的 Embedding 相似度
3. 当相似度低于阈值时——说明话题发生了转变——在这里切割

```
句子 1：React 是一个 UI 框架...        ─┐
句子 2：它使用虚拟 DOM 提高性能...      ─┤ 相似度高 → 同一个 chunk
句子 3：组件是 React 的基本单元...      ─┘
                                         ← 相似度骤降（话题转变）
句子 4：数据库选择需要考虑...           ─┐
句子 5：PostgreSQL 适合关系型数据...    ─┤ 相似度高 → 另一个 chunk
句子 6：MongoDB 适合文档型存储...       ─┘
```

**优点**：chunk 的语义内聚性高，每个 chunk 讨论一个主题
**缺点**：需要额外的 Embedding 计算（每个句子都要 Embed），成本和时间更高
**适合**：主题跨度大的长文档（技术博客、研究报告）

### 递归分块（Recursive Chunking）

**原理**：按文档的层次结构递归分割。先按最大的分隔符（如双换行）分，如果块还太大，再按次一级的分隔符（如单换行）分，以此类推。

前端类比：这就像 CSS 的选择器优先级——先按大类（标签选择器）分组，不够细再按中类（class 选择器），还不够再按小类（id 选择器）。

```
层级 1：按 ## 标题分 → 每个二级标题是一个大块
层级 2：块太大？按 \n\n（段落）分
层级 3：段落还太大？按 \n（行）分
层级 4：行还太大？按 。（句子）分
层级 5：句子还太大？按字符数硬切
```

这是 LangChain 默认的 `RecursiveCharacterTextSplitter` 的实现思路。它的好处是尽可能保留文档的自然结构。

### 按文档结构分块

对于结构化的文档（Markdown、HTML、代码），可以利用文档本身的结构来分块。

**Markdown 文档**：按标题层级分块

```
# 产品概述          → chunk 1
## 核心功能
### 功能 A          → chunk 2
这是功能 A 的说明...
### 功能 B          → chunk 3
这是功能 B 的说明...
## 定价方案          → chunk 4
```

**HTML 文档**：按 DOM 结构分块（`<section>`、`<article>`、`<h2>` 等）

**代码文件**：按函数/类分块

前端类比：这就像 React 的组件树——你按 `<Header>`、`<Main>`、`<Footer>` 来组织代码，而不是每 50 行切一刀。文档分块也应该尊重文档本身的逻辑结构。

### Small-to-Big 策略

**核心思想**：用小 chunk 做检索（精准匹配），但返回大 chunk 给 AI（完整上下文）。

这个策略非常巧妙。它解决了上一章提到的经典矛盾：chunk 小了检索准但上下文丢失，chunk 大了上下文全但检索不准。

```
存储时：
├── 大 chunk（2000 字）：整个章节
│   ├── 小 chunk（200 字）：第 1 段    ← 用于检索
│   ├── 小 chunk（200 字）：第 2 段    ← 用于检索
│   ├── 小 chunk（200 字）：第 3 段    ← 用于检索
│   └── ...

检索时：
用户问题 → 匹配到第 2 段（小 chunk）
→ 通过 parent_id 找到整个章节（大 chunk）
→ 把整个章节传给 AI
```

前端类比：想象 Google 搜索。你搜"React useEffect 清理函数"，Google 在搜索结果中**高亮显示**匹配的那一段话（小 chunk 用于匹配），但你点进去看到的是**整篇文章**（大 chunk 用于阅读）。检索粒度和展示粒度是两回事。

**实现要点**：

```typescript
interface SmallChunk {
  id: string;
  text: string;        // 200 字的小块，用于 Embedding 和检索
  parentId: string;    // 指向大 chunk
}

interface BigChunk {
  id: string;
  text: string;        // 2000 字的大块，用于传给 AI
  childIds: string[];  // 包含的小 chunk
}

// 检索流程
async function smallToBigRetrieve(query: string) {
  // 1. 用小 chunk 做向量检索
  const smallResults = await vectorDB.search({ query, topK: 5 });

  // 2. 找到对应的大 chunk（去重）
  const parentIds = [...new Set(smallResults.map(r => r.metadata.parentId))];
  const bigChunks = await Promise.all(
    parentIds.map(id => vectorDB.get(id))
  );

  // 3. 返回大 chunk 给 AI
  return bigChunks;
}
```

---

## 10.2 混合检索（Hybrid Search）

### 一句话直觉

向量检索和关键词检索各有盲区，把它们结合起来能互补短板。

### 向量检索的局限

上一章说过向量检索的优势——理解语义。但它有一个被低估的缺陷：**语义相似不等于真正相关**。

举个前端开发者熟悉的例子：

```
用户搜："React hooks 的 useState"
向量检索可能返回："Vue 3 的 ref 和 reactive"

为什么？因为从语义上讲，React hooks 和 Vue Composition API
在功能层面确实非常相似。向量检索认为它们"语义接近"——
但如果用户明确在问 React，返回 Vue 的文档就是错的。
```

再举一个更微妙的例子：

```
用户搜："Apple 公司的股价"
向量检索可能返回："苹果的营养成分" 或 "水果采摘指南"

为什么？"Apple" 这个词在语义空间中可能同时接近
"科技公司"和"水果"。Embedding 模型不一定能准确
区分多义词在特定上下文中的含义。
```

**核心问题**：向量检索捕捉的是"大致的语义方向"，可能丢失具体的关键词信息。

### 关键词检索的局限

传统的关键词检索（如 BM25）基于词频统计——文档中出现搜索关键词越多、越稀有，排名越高。

但关键词检索有一个致命弱点：**同义词和近义词搜不到**。

```
用户搜："退款"
关键词检索只能匹配包含"退款"二字的文档

但以下文档明明很相关，却搜不到：
- "如何申请退钱"（退钱 ≠ 退款，关键词不匹配）
- "款项返还流程"（返还 ≠ 退款）
- "cancelation and refund policy"（英文文档）
```

前端类比：关键词检索就像 `Array.filter(item => item.includes(keyword))`——精确但死板。向量检索像是模糊匹配——灵活但可能跑偏。

### BM25 + 向量检索的混合方案

混合检索的思路很直白：**两种方式各跑一遍，然后合并结果**。

```
用户问题："React useState 的用法"

向量检索 top-5：
1. React Hooks 入门指南        (语义相关 ✓)
2. Vue 3 响应式原理            (语义相似但不相关 ✗)
3. React 状态管理最佳实践       (相关 ✓)
4. Svelte 的响应式系统          (语义相似但不相关 ✗)
5. React useEffect 详解        (相关 ✓)

BM25 关键词检索 top-5：
1. React useState 源码解析     (关键词精确匹配 ✓)
2. React useState vs useReducer (关键词匹配 ✓)
3. useState 常见错误            (关键词匹配 ✓)
4. React Hooks 面试题          (部分匹配 ✓)
5. Angular 的 useState 对比    (关键词匹配但不完全相关)

混合后：
→ 两种检索都排在前面的 = 高置信度
→ 只有向量检索匹配的 = 语义相关（可能是也可能不是）
→ 只有关键词匹配的 = 字面相关（精确度高）
```

混合检索让"React useState"这类既有明确关键词又有语义含义的查询效果大幅提升。

### RRF（Reciprocal Rank Fusion）：融合排名

两种检索各返回一个排名列表，怎么合成一个最终排名？最常用的算法是 RRF（Reciprocal Rank Fusion，倒数排名融合）。

**公式**：

```
RRF_score(doc) = Σ 1 / (k + rank_i(doc))
```

其中 `k` 是一个常数（通常为 60），`rank_i(doc)` 是文档在第 i 种检索中的排名。

**直觉理解**：

```
文档 A 在向量检索排第 1，在关键词检索排第 3
RRF(A) = 1/(60+1) + 1/(60+3) = 0.0164 + 0.0159 = 0.0323

文档 B 在向量检索排第 2，在关键词检索排第 1
RRF(B) = 1/(60+2) + 1/(60+1) = 0.0161 + 0.0164 = 0.0325

文档 C 在向量检索排第 1，不在关键词检索结果中
RRF(C) = 1/(60+1) + 0 = 0.0164

→ B > A > C
两种检索都靠前的文档会排最高
```

前端类比：RRF 就像你做代码审查时综合多个 reviewer 的意见。如果两个 reviewer 都说某段代码有问题（两种检索都排在前面），那这段代码很可能确实有问题。如果只有一个 reviewer 提到，置信度就低一些。

**为什么是 RRF 而不是简单地平均分数？** 因为向量检索的相似度分数和 BM25 的分数**量纲不同**——一个是 0 到 1 之间的余弦相似度，一个可能是 0 到 30 的 BM25 分。直接平均没有意义。RRF 用排名代替分数，消除了量纲差异。

---

## 10.3 重排序（Reranking）

### 一句话直觉

初筛（检索）追求速度和覆盖面，精选（重排序）追求精确。就像招聘——先筛简历再面试。

### 前端类比

你做过搜索功能吗？通常会有两个阶段：

1. **初筛**：数据库的全文索引快速返回候选结果（几毫秒）
2. **精排**：在候选结果上做更复杂的排序（相关性、热度、时间、个性化权重）

RAG 的检索 + 重排序也是这个思路。向量检索是初筛（快速召回候选），Reranker 是精排（对候选做精确排序）。

### 为什么需要重排序？

向量检索用的是 **Bi-encoder** 架构：

```
Bi-encoder（向量检索）：
文档和查询分别编码，互不影响

Query: "React hooks"  → Embed → [0.2, 0.8, ...]  ─┐
                                                      ├→ 计算相似度
Doc:   "useState 教程" → Embed → [0.3, 0.7, ...]  ─┘

特点：查询和文档的 Embedding 是独立计算的
优势：文档 Embedding 可以预计算并缓存，检索超快
劣势：无法捕捉查询和文档之间的交互关系
```

Reranker 用的是 **Cross-encoder** 架构：

```
Cross-encoder（重排序）：
把查询和文档拼在一起，同时处理

输入: "[CLS] React hooks [SEP] useState 教程 [SEP]"
                        ↓
              [Cross-encoder 模型]
                        ↓
输出: 相关性分数 0.92

特点：查询和文档的每个词都能互相"看到"对方
优势：能理解更细微的相关性（如"hooks"和"useState"的关联）
劣势：无法预计算，必须在线计算，比较慢
```

**关键区别**：Bi-encoder 把查询和文档看作两个独立的物体，比较它们的"外形"是否相似。Cross-encoder 把查询和文档放在一起仔细阅读，判断它们是否真正相关。

前端类比：Bi-encoder 就像你看两个 npm 包的 README 首行描述，觉得"都是状态管理库"就归为一类。Cross-encoder 像你真正去看两个库的源码和 API，判断它们的设计理念和适用场景是否一致。前者快但粗，后者慢但准。

### Reranker 模型

主流的 Reranker 模型：

| 模型 | 特点 |
|------|------|
| **Cohere Rerank** | 商用 API，效果好、接入简单 |
| **BGE Reranker** | 开源，BAAI 出品，中文效果好 |
| **Jina Reranker** | 开源，支持多语言 |

### 重排序的流程

```
用户问题
  ↓
向量检索 top-20（快速召回，多拿一些候选）
  ↓
Reranker 对 20 个结果重新打分排序
  ↓
取 top-5 送给 AI
  ↓
AI 生成回答
```

注意：向量检索时要多拿一些候选（比如 top-20 甚至 top-50），给 Reranker 足够的"工作素材"。如果只拿 top-5 去重排序，效果提升有限。

### 为什么不直接用 Cross-encoder 做检索？

> 这是一个关键问题。既然 Cross-encoder 效果更好，为什么不跳过向量检索，直接用 Cross-encoder 检索？

**因为太慢了。**

Cross-encoder 需要把查询和每一条文档拼在一起过一遍模型。如果你有 10 万条文档，每次查询就要跑 10 万次 Cross-encoder——这可能需要几分钟甚至更长。

Bi-encoder（向量检索）的文档向量是预计算好的，查询时只需要计算一次查询向量，然后在向量数据库中做近似最近邻搜索——几十毫秒搞定。

```
10 万条文档，Cross-encoder 直接检索：
10 万次模型推理 ≈ 几分钟 ← 用户等不了

10 万条文档，向量检索 + Reranking：
向量检索（几十毫秒） → 20 条候选 → 20 次 Cross-encoder（几百毫秒）
总计 < 1 秒 ← 用户体验 OK
```

这就是"初筛 + 精选"的经典架构——用快但粗的方式大幅缩小范围，再用慢但准的方式在小范围内精确排序。

---

## 10.4 Query 优化

### 一句话直觉

用户的提问经常"歪歪扭扭"，帮他们整理一下再去检索，效果会好很多。

### 前端类比

你做过搜索框的输入处理吗？用户输入 "   rEACT   hooks  "，你会先 trim、转小写、合并空格，变成 "react hooks" 再去搜索。Query 优化就是这个思路的"语义版"——不只是字面清理，而是理解用户真正想问什么，然后把问题改写成更适合检索的形式。

### Query Rewriting（查询改写）

**问题**：用户的自然语言提问经常不适合直接作为检索查询。

```
用户说："那个东西昨天出了问题，怎么解决？"
→ "那个东西"是什么？"昨天的问题"是什么问题？

直接用这句话去做向量检索，能检索到什么？几乎什么有用的都检索不到。
```

**解决方案**：用 LLM 先改写用户的查询，让它更适合检索。

```typescript
// Query Rewriting 示例
import { generateText } from 'ai';

async function rewriteQuery(
  originalQuery: string,
  chatHistory: string[] = []
): Promise<string> {
  const { text } = await generateText({
    model: yourModel,
    system: `你是一个查询优化助手。用户会提出问题，你需要将其改写为更适合在知识库中检索的查询。

规则：
1. 消除指代不明（如"那个"、"它"），结合聊天历史补全信息
2. 去掉口语化表达，提取核心关键词和概念
3. 如果问题涉及多个方面，拆分成最核心的查询
4. 输出改写后的查询，不要输出其他内容`,
    prompt: `聊天历史：${chatHistory.join('\n')}
    
用户最新问题：${originalQuery}

请改写为适合知识库检索的查询：`,
  });

  return text;
}

// 示例
// 聊天历史：["用户: 我在使用 React Router", "AI: 好的，你有什么问题？"]
// 用户说："它的嵌套路由怎么配置？"
// 改写后："React Router 嵌套路由配置方法"
```

**注意**：Query Rewriting 增加了一次 LLM 调用的延迟和成本。对于清晰明确的查询（如"React useState 的用法"），改写可能没有必要。你可以先做一个判断——如果查询中包含代词、指示词、或者向量检索的结果分数很低，再触发改写。

### HyDE（Hypothetical Document Embedding）

HyDE 是一种很有创意的技术。它的思路是：**不用用户的问题去检索，而是先让 AI 假设一个答案，用这个假设的答案去检索。**

为什么这样做有效？

```
用户问题："React 组件通信有哪些方式？"
→ 这是一个"问题"的语义向量

知识库中的文档："在 React 中，父子组件通过 props 传递数据，
兄弟组件可以通过共同的父组件或 Context 通信，
跨层级组件可以使用 Redux 等状态管理库..."
→ 这是一个"回答"的语义向量

问题和回答的语义向量不一定很接近——
它们一个是"问"的形式，一个是"答"的形式。
```

HyDE 的做法：

```
步骤 1：让 AI 生成一个假设的回答
"React 组件通信方式包括：props（父子通信）、
Context（跨层级通信）、状态管理库（全局通信）..."

步骤 2：用这个假设回答去检索
假设回答的向量 ↔ 知识库中真实文档的向量
→ 两者都是"回答"的形式，语义更接近！

步骤 3：用检索到的真实文档生成最终回答
```

前端类比：想象你在 GitHub Issues 里搜索一个 bug。直接搜"为什么我的组件不渲染"可能搜不到。但如果你先猜测答案——"可能是 key prop 没设对导致 React 不更新"——用这个猜测去搜索，反而能找到相关的 Issue 和解答。因为 Issues 里的内容大多是"解答"形式，你用"解答"去搜"解答"当然更匹配。

```typescript
// HyDE 实现
async function hydeRetrieve(query: string) {
  // 1. 生成假设回答
  const { text: hypotheticalAnswer } = await generateText({
    model: yourModel,
    system: '请根据你的知识直接回答以下问题。简洁回答即可。',
    prompt: query,
  });

  // 2. 用假设回答做向量检索
  const results = await vectorDB.search({
    queryText: hypotheticalAnswer, // 用假答案而不是原问题！
    topK: 5,
  });

  return results;
}
```

**局限性**：假设的答案如果偏差很大，反而会把检索带偏。这在模型对相关领域了解很少时尤为明显。HyDE 更适合模型"大致知道方向"但需要精确细节的场景。

### Multi-query（多查询）

**思路**：同一个问题从不同角度生成多个查询，合并所有检索结果，提高召回率。

```
用户问题："如何优化 React 应用性能？"

生成多个查询：
Query 1: "React 性能优化方法"
Query 2: "React 组件渲染优化 memo useMemo"
Query 3: "React 应用加载速度提升 code splitting"

分别检索 → 合并结果 → 去重 → 排序
```

前端类比：你在找一个 npm 包时，不会只搜一个词。你会试"react date picker"、"react calendar component"、"react datetime selector"——每个搜索角度可能返回不同的结果。Multi-query 就是把这个过程自动化。

```typescript
// Multi-query 实现
async function multiQueryRetrieve(query: string) {
  // 1. 生成多个查询变体
  const { text } = await generateText({
    model: yourModel,
    system: `给定一个用户问题，生成 3 个不同角度的检索查询。
每行一个查询，不要编号。`,
    prompt: query,
  });

  const queries = text.split('\n').filter(q => q.trim().length > 0);

  // 2. 对每个查询分别检索
  const allResults = await Promise.all(
    queries.map(q => vectorDB.search({ queryText: q, topK: 5 }))
  );

  // 3. 合并去重（用 RRF 或简单的分数加权）
  const merged = mergeAndDedup(allResults);

  return merged.slice(0, 5); // 返回 top-5
}
```

### 三种 Query 优化的选择

| 技术 | 额外 LLM 调用 | 适用场景 | 效果 |
|------|-------------|---------|------|
| Query Rewriting | 1 次 | 模糊/口语化查询、多轮对话 | 稳定提升 |
| HyDE | 1 次 | 问答形式的检索 | 特定场景显著提升 |
| Multi-query | 1 次（生成多查询） | 复杂/多面的问题 | 提高召回率 |

> **实践建议**：先做 Query Rewriting，这是性价比最高的。HyDE 和 Multi-query 在特定场景有奇效，但会增加延迟和成本。根据你的场景选择性使用。

---

## 10.5 Graph RAG 入门

### 一句话直觉

传统 RAG 检索的是"文本片段"，Graph RAG 还能理解实体之间的"关系"。

### 为什么需要 Graph RAG？

传统 RAG 有一个根本性的局限：它把文档切成孤立的 chunk，丢失了信息之间的关系。

举一个前端开发者能立刻理解的例子：

```
文档 A："React 由 Meta 公司开发和维护。"
文档 B："Meta 公司的 CEO 是 Mark Zuckerberg。"
文档 C："Mark Zuckerberg 毕业于哈佛大学。"

用户问题："React 的开发公司的 CEO 毕业于哪所大学？"
```

传统 RAG 要回答这个问题，需要跨越三个 chunk 做**多跳推理**（multi-hop reasoning）：React → Meta → Zuckerberg → 哈佛。但向量检索只能找到和问题"语义最相似"的 chunk，它很可能只返回文档 A，不会连带返回 B 和 C。

Graph RAG 通过构建**知识图谱**来解决这个问题：

```
[React] --开发者→ [Meta] --CEO→ [Zuckerberg] --毕业于→ [哈佛]
```

检索时，从 "React" 这个实体出发，沿着关系链路往下走，就能自然地找到答案。

### 什么场景需要 Graph RAG？

**需要 Graph RAG**：
- 多跳推理：答案需要连接多条信息才能得出
- 关系查询："谁和谁有关系？"、"A 和 B 的共同点是什么？"
- 复杂实体网络：人物关系、组织架构、系统依赖关系
- 总结型查询："这个主题涉及哪些关键概念？"——需要从全局视角理解知识结构

**不需要 Graph RAG**：
- 答案在单个文档片段中就能找到（大多数 FAQ 类场景）
- 简单的事实查询（"退款政策是什么？"）
- 文档之间没有明显的实体关系

### Graph RAG vs 传统 RAG

| | 传统 RAG | Graph RAG |
|---|---|---|
| 索引方式 | 文本 chunk 的向量 | 实体 + 关系的图结构 |
| 检索方式 | 向量相似度 top-K | 图遍历 + 向量检索 |
| 强项 | 快速匹配相关段落 | 多跳推理、关系查询 |
| 弱项 | 无法处理跨文档推理 | 构建和维护成本高 |
| 复杂度 | 低 | 高（需要 NER、关系抽取、图数据库） |
| 适用规模 | 从几十到几十万文档 | 更适合中小规模、高关系密度的知识库 |

前端类比：传统 RAG 像是一个扁平的搜索引擎——给你最相关的"页面"。Graph RAG 像是维基百科——不只给你页面，还有超链接让你在概念之间跳转，理解它们的关系。

### 构建流程

```
1. 文档 → 实体抽取（NER）
   "React 由 Meta 开发" → 实体: [React, Meta]，关系: [开发者]

2. 实体 + 关系 → 存入图数据库（如 Neo4j）
   (React)-[:开发者]->(Meta)

3. 查询时：
   a. 从问题中提取实体："React 的开发公司" → [React]
   b. 在图中从 React 出发，沿关系链路探索
   c. 把探索到的相关实体和关系作为上下文
   d. 传给 LLM 生成回答
```

> **务实建议**：Graph RAG 概念很吸引人，但构建成本远高于传统 RAG。实体抽取和关系抽取的准确率直接决定了图的质量——如果图是错的，基于图的推理也会出错。大多数项目应该先把传统 RAG 做好，只在确实需要多跳推理时才引入 Graph RAG。

---

## 10.6 RAG 评估框架

### 一句话直觉

不能评估的系统就不能改进。RAG 评估就是给你的"开卷考试系统"做质量检测。

### 前端类比

你写了一个电商搜索，怎么知道它好不好？你不会只自己试几个关键词就上线。你会建一个测试集、跑 A/B 测试、看用户行为指标。RAG 评估的思路完全一样。

### 三个核心评估维度

**1. Faithfulness（忠实度）**

AI 的回答是否忠实于检索到的文档？有没有"编造"检索结果里不存在的信息？

```
检索到的文档："退款在 3-5 个工作日内处理"
AI 回答："退款将在 1 个工作日内到账"  ← 不忠实！文档说的是 3-5 天
AI 回答："退款将在 3-5 个工作日内处理" ← 忠实 ✓
```

前端类比：这就像检查你的 UI 组件是否忠实地渲染了后端返回的数据。如果 API 返回 `price: 99`，你的组件显示 `¥89`，那就是"不忠实"。

**2. Relevance（相关性）**

检索到的文档是否和用户的问题真正相关？

```
用户问题："退款需要多久？"
检索结果 1："退款在 3-5 个工作日内处理" ← 高度相关 ✓
检索结果 2："我们提供 7 天无理由退货"   ← 部分相关
检索结果 3："运费标准为 10 元"          ← 不相关 ✗
```

Relevance 评估的是检索阶段的质量。如果检索结果都不相关，再好的 LLM 也回答不了。

**3. Answer Correctness（答案正确性）**

最终回答是否正确？这是端到端的评估。

```
标准答案："退款在 3-5 个工作日内原路返还"
AI 回答："退款将在 3-5 个工作日内原路返还到您的付款账户"
→ 语义正确 ✓（虽然措辞不同，但含义一致）
```

### RAGAS 框架

RAGAS（Retrieval Augmented Generation Assessment）是一个专门用于 RAG 评估的开源框架。它把以上三个维度自动化了——用 LLM 作为"评估者"，对 RAG 系统的输出打分。

RAGAS 评估的核心指标：

| 指标 | 评估什么 | 怎么算 |
|------|---------|-------|
| Faithfulness | AI 回答中的每个声明是否都能在检索结果中找到依据 | 用 LLM 拆分回答为多个声明，逐一检查 |
| Context Relevancy | 检索到的上下文和问题的相关程度 | 用 LLM 判断每段上下文是否与问题相关 |
| Answer Relevancy | 回答和问题的相关程度（有没有答非所问） | 用 LLM 从回答反推问题，看是否和原问题一致 |
| Context Recall | 正确答案需要的信息是否都被检索到了 | 对比标准答案和检索结果的覆盖率 |

**评估流程**：

```
1. 准备评估数据集：
   [
     {
       question: "退款需要多久？",
       ground_truth: "3-5 个工作日",  // 人工标注的正确答案
     },
     ...
   ]

2. 对每个问题运行 RAG 系统，记录：
   - 检索到的上下文 (contexts)
   - 生成的回答 (answer)

3. 用 RAGAS 计算各项指标

4. 分析低分 case，定位问题在哪个环节
```

前端类比：RAGAS 评估就像是你的 E2E 测试（End-to-End）。单元测试检查单个函数，E2E 测试检查整个用户流程。RAGAS 不只看检索是否准确，而是看从用户提问到最终回答的整个流程是否正确。

> **实践建议**：评估数据集不需要很大，但要有代表性。先准备 30-50 个覆盖核心场景的问答对，就足以发现大多数问题。重点关注那些"看起来回答得不错但实际上是错的" case——这是最危险的失败模式。

---

## 10.7 RAG 的常见失败模式

在优化 RAG 之前，你得先知道它会怎么失败。这里列出最常见的失败模式和排查方法。

### 失败模式一：检索到了但没用好

**症状**：检索结果里有正确答案，但 AI 的回答是错的或不完整的。

**原因**：
- Prompt 模板不好——AI 没有被明确指示要基于参考资料回答
- 检索结果太多太杂——相关信息淹没在不相关信息中
- "Lost in the Middle"——正确信息在中间位置，AI 忽略了

**排查方法**：把检索结果打印出来看。如果正确答案确实在其中，问题在 Generation 阶段。

**解决方法**：
- 优化 system prompt，明确指示 AI 引用参考资料
- 减少 top-K，只传最相关的 3-5 条
- 把最相关的结果放在最前面（Reranking 能帮上忙）

### 失败模式二：检索不到正确文档

**症状**：相关文档明明在知识库里，但检索结果中没有。

**原因**：
- 分块不当——正确信息被切割到了多个 chunk 中，每个 chunk 都不完整
- Embedding 质量差——模型对你的领域理解不好
- 用户提问和文档的表述方式差异太大

**排查方法**：对失败的 query，手动检查向量相似度分数。如果正确文档的分数很低，说明 Embedding 没有把它们放在向量空间的相近位置。

**解决方法**：
- 调整分块策略（更小的 chunk、按结构分块）
- 换更好的 Embedding 模型（尤其是中文场景）
- 引入混合检索
- 做 Query 优化

### 失败模式三：幻觉性回答

**症状**：AI 声称"根据文档..."，但实际上文档里并没有这个信息。AI 自信地编造了一个看起来很合理的回答。

**原因**：
- LLM 的固有倾向——它倾向于给出看起来合理的回答，即使没有依据
- Prompt 指令不够强——"如果不知道就说不知道"这个指令被忽略了
- 检索结果中有**部分相关**的内容，AI 基于部分信息"脑补"了其余部分

**排查方法**：这是最难发现的失败模式，因为回答看起来很"对"。需要人工核实或用 Faithfulness 评估来检测。

**解决方法**：
- 在 prompt 中更强调"只根据参考资料回答"，加入明确的不确定表述指令
- 添加 Faithfulness 自动检测——用另一个 LLM 调用检查回答是否有文档依据
- 让 AI 在回答中标注每个关键信息的来源（强制引用），这样没有来源的信息一眼就能看出

### 失败模式四：检索到了错误文档

**症状**：检索到的文档和问题"看起来相关"，但实际上不是用户想要的。

```
用户问："React 18 的新特性"
检索到："React Native 0.72 的新特性"  ← 语义相似但不是用户想要的
```

**解决方法**：
- 混合检索——关键词检索能区分 "React 18" 和 "React Native"
- Metadata 过滤——给文档打标签（产品、版本、类型），检索时指定过滤条件
- Reranking——Cross-encoder 能更好地理解 "React 18" 和 "React Native" 的区别

---

## 概念辨析

### Bi-encoder vs Cross-encoder

| | Bi-encoder | Cross-encoder |
|---|---|---|
| 架构 | 查询和文档分别编码 | 查询和文档拼接后共同编码 |
| 速度 | 快（文档向量可预计算） | 慢（每次查询都要重新计算） |
| 精度 | 较低（无法捕捉交互） | 较高（能理解细微关系） |
| 用途 | 向量检索（初筛） | 重排序（精选） |
| 类比 | 看简历筛候选人 | 面试评估候选人 |

### 向量检索 vs 关键词检索 vs 混合检索

| | 向量检索 | 关键词检索（BM25） | 混合检索 |
|---|---|---|---|
| 匹配方式 | 语义匹配 | 字面匹配 | 两者结合 |
| 能找到同义词？ | 能 | 不能 | 能 |
| 精确关键词？ | 可能忽略 | 很强 | 很强 |
| 多义词？ | 可能混淆 | 不受影响 | 互补 |
| 实现复杂度 | 中 | 低 | 高 |

### 固定分块 vs 语义分块 vs 递归分块

| | 固定分块 | 语义分块 | 递归分块 |
|---|---|---|---|
| 原理 | 按字符数切割 | 按语义变化切割 | 按文档结构层级切割 |
| 优点 | 简单、快速 | 每个 chunk 语义内聚 | 保留文档结构 |
| 缺点 | 可能切断语义 | 需要额外 Embedding 计算 | 需要知道文档格式 |
| 适合 | 格式统一的纯文本 | 主题跨度大的长文 | 结构化文档（Markdown、HTML） |

---

## 灵魂拷问

> **Q1：纯向量检索为什么会检索到"语义相似但不相关"的内容？举个例子？**

> **A：** 因为 Embedding 模型学到的是"语义方向"的相似性，而不是"用户意图"的相似性。语义方向相近的两段文字，不一定回答同一个问题。
>
> 最经典的例子：
>
> 用户问："Python 如何读取 CSV 文件？"
> 向量检索可能返回："R 语言读取 CSV 的 read.csv 函数"
>
> 因为从语义上看，"Python 读 CSV"和"R 语言读 CSV"说的是同一件事（读 CSV 文件），只是工具不同。Embedding 模型把它们映射到了相近的向量空间位置。
>
> 再比如：
>
> 用户搜："苹果手机价格"
> 可能返回："苹果产地和价格信息"（水果的苹果）
>
> 对于多义词，Embedding 模型可能无法在脱离上下文的情况下准确消歧。
>
> **解决方案就是混合检索**——关键词检索能精确匹配"Python"和"苹果手机"这些关键词，不会被语义相似性误导。向量检索和关键词检索的互补，正是混合检索的价值所在。

---

> **Q2：Reranking 既然效果好，为什么不一开始就用 Cross-encoder 做检索？**

> **A：** 纯粹的计算成本问题。
>
> Cross-encoder 的工作方式是把查询和文档拼在一起过一遍模型。假设你有 10 万篇文档，每次用户提问都要做 10 万次模型推理——即使用 GPU，这也需要几分钟。用户不可能每个问题等几分钟。
>
> Bi-encoder（向量检索）的文档向量是一次性预计算的，之后每次查询只需要：1）把查询向量化（1 次模型调用），2）在向量数据库中做 ANN 搜索（纯数学计算，毫秒级）。
>
> 所以工程上的最佳实践是"两阶段"：
> - 第一阶段：用 Bi-encoder（向量检索）快速召回 20-50 个候选（几十毫秒）
> - 第二阶段：用 Cross-encoder（Reranker）对候选精确排序（几百毫秒）
>
> 总时间控制在 1 秒以内，兼顾了速度和精度。
>
> 前端类比：你不会在前端用冒泡排序对 10 万条数据做全量排序。你会先用数据库的索引缩小范围（WHERE + LIMIT），然后在小结果集上做精排。思路是一样的。

---

> **Q3：HyDE 用 AI 生成的"假答案"去检索，这个假答案不准确不会影响检索质量吗？**

> **A：** 好问题。确实有这个风险，但 HyDE 利用的是一个微妙的特性。
>
> HyDE 的核心洞察是：**假答案不需要事实准确，只需要"风格"和"主题"和真实答案接近。**
>
> 即使 AI 生成的假答案细节是错的（"退款在 1 天内到账"），但它的语义方向是对的（在讨论退款和时效）。这个语义方向已经足够让向量检索找到真正的相关文档了。
>
> 但 HyDE 确实有失败的场景：
> 1. **模型对领域完全无知**：如果模型完全不了解你的业务，生成的假答案可能连方向都是错的
> 2. **假答案偏向一个子主题**：用户问"A 和 B 的区别"，假答案可能只谈了 A，导致只检索到关于 A 的文档
> 3. **假答案"太自信"**：生成了一个非常具体但完全错误的答案，反而把检索带偏了
>
> **实践建议**：HyDE 在通用知识领域效果不错，在高度专业的垂直领域（如医学、法律）需要谨慎测试。你可以做 A/B 对比——同一组测试问题，用和不用 HyDE 分别检索，看 Recall 是否提升。

---

> **Q4：Graph RAG 看起来很强大，但为什么大多数项目还是用普通 RAG？**

> **A：** 四个字：**投入产出比**。
>
> Graph RAG 的构建成本远高于传统 RAG：
>
> 1. **实体抽取（NER）不完美**：你需要从文档中自动识别实体和关系。这一步的准确率直接决定了图的质量。如果 NER 把"React Router"识别为两个独立实体"React"和"Router"，图就是错的。
>
> 2. **关系抽取更不完美**："React 由 Meta 开发"，关系是"开发者"。但"React 的生态系统非常丰富"——这句话有什么实体和关系？很多文本表达的是模糊的、隐含的关系，自动抽取困难。
>
> 3. **图数据库运维**：你需要额外部署和维护一个图数据库（如 Neo4j），增加了系统复杂度。
>
> 4. **大多数问题不需要多跳推理**：实际业务中，80% 的用户问题可以在单个文档片段中找到答案。"退款政策是什么"、"产品支持哪些系统"——这些问题传统 RAG 完全胜任。
>
> **什么时候值得投入？**
> - 你的知识库有大量的实体关系（如组织架构、产品依赖关系、法规引用关系）
> - 用户经常问需要"连接多条信息"的问题
> - 你有资源和时间来构建和维护高质量的知识图谱
>
> 如果这三个条件不同时满足，普通 RAG + 好的分块策略 + 混合检索，就足以覆盖绝大多数场景。

---

> **Q5：如何发现你的 RAG 系统"静悄悄地失败了"——回答看起来合理但其实是错的？**

> **A：** 这是 RAG 系统（甚至整个 AI 系统）最危险的问题。因为 LLM 擅长生成"看起来对的"文本，用户（甚至你自己）很难发现它在一本正经地胡说八道。
>
> 检测方法分为自动化和人工两类：
>
> **自动化检测：**
>
> 1. **Faithfulness 评估**：用另一个 LLM 检查回答中的每个声明是否都有检索结果中的依据。没有依据的声明很可能是幻觉。
>
> 2. **相似度阈值监控**：如果检索结果的最高分都低于阈值（比如 0.6），说明知识库中可能没有相关内容。此时生成的回答大概率不可靠。
>
> 3. **回答一致性检查**：对同一个问题问多次，看回答是否一致。如果每次回答差异很大，说明 AI 在"编"（基于真实文档的回答通常一致性高）。
>
> 4. **定期用评估集回归测试**：准备一组有标准答案的问题，定期跑一遍，看分数有没有下降。文档更新、模型变化、Embedding 升级都可能引起回归。
>
> **人工检测：**
>
> 1. **强制引用来源**：要求 AI 在回答中引用具体来源（"根据《退款政策》第 3 条..."）。这样人工审查时可以快速验证。
>
> 2. **用户反馈机制**：在回答下方加"有帮助/无帮助"按钮，收集用户反馈。"无帮助"频率高的 query 重点排查。
>
> 3. **抽样审查**：定期随机抽取一批回答，人工检查其准确性。这是保底手段。
>
> 前端类比：这就像监控你的前端应用——你不能只依赖开发时的测试，还需要生产环境的错误监控（Sentry）、用户行为追踪（Amplitude）、定期的人工 QA。RAG 系统也需要一套完整的"可观测性"方案。

---

## 最佳实践

### DO

- **DO** 从混合检索开始——向量 + 关键词的组合几乎总比纯向量好
- **DO** 在向量检索后加 Reranking——这是投入产出比最高的优化手段
- **DO** 建立评估数据集——哪怕只有 30 个问答对，也比"感觉还行"靠谱得多
- **DO** 记录每次请求的检索结果和分数——出问题时需要这些日志来排查
- **DO** 用 Small-to-Big 策略——用小 chunk 精准检索，用大 chunk 保留上下文，两全其美
- **DO** 对低于相似度阈值的查询做降级处理——明确告诉用户"我不确定"比编造答案好
- **DO** 定期用评估集做回归测试——文档更新、模型升级后都要跑一遍

### DON'T

- **DON'T** 一上来就搞 Graph RAG——先把传统 RAG 优化好，90% 的场景够用
- **DON'T** 对所有查询都做 Query Rewriting / HyDE——这会增加延迟和成本，只在需要时启用
- **DON'T** 忽略 Reranker 的候选数量——向量检索只取 top-5 再 Rerank 效果有限，至少取 top-20
- **DON'T** 用不同的 Embedding 模型编码文档和查询——这是最容易犯的"事故级"错误
- **DON'T** 把评估简化为"自己试几个问题看看"——你的直觉会骗你，数据不会
- **DON'T** 忽略失败 case 的分析——10 个成功 case 不如 1 个失败 case 的价值大
- **DON'T** 在没有评估体系的情况下做"优化"——没有指标，你怎么知道是优化还是劣化？

---

## 代码实战

### 混合检索 + Reranking 完整实现

```typescript
// src/advanced-rag.ts
// 进阶 RAG：混合检索 + Reranking

import { generateText, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// =========================================
// 1. BM25 关键词检索（简化实现）
// =========================================

interface Document {
  id: string;
  text: string;
  metadata: Record<string, string>;
}

class SimpleBM25 {
  private docs: Document[] = [];
  private avgDocLength = 0;
  private idf: Map<string, number> = new Map();
  private k1 = 1.2;
  private b = 0.75;

  // 简单的中文分词（实际项目建议用 jieba 等专业库）
  private tokenize(text: string): string[] {
    // 按非中文字符和空格分割，保留中文词组和英文单词
    return text
      .toLowerCase()
      .split(/[\s,，。！？；：""''（）\(\)\[\]{}\/\\|<>@#$%^&*+=~`]+/)
      .filter(t => t.length > 0);
  }

  index(documents: Document[]) {
    this.docs = documents;

    // 计算 IDF
    const docCount = documents.length;
    const df: Map<string, number> = new Map();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc.text));
      for (const token of tokens) {
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    for (const [token, freq] of df) {
      this.idf.set(token, Math.log((docCount - freq + 0.5) / (freq + 0.5) + 1));
    }

    // 计算平均文档长度
    this.avgDocLength =
      documents.reduce((sum, d) => sum + this.tokenize(d.text).length, 0) / docCount;
  }

  search(query: string, topK: number = 10): Array<{ doc: Document; score: number }> {
    const queryTokens = this.tokenize(query);
    const scores: Array<{ doc: Document; score: number }> = [];

    for (const doc of this.docs) {
      const docTokens = this.tokenize(doc.text);
      const docLength = docTokens.length;
      const termFreq: Map<string, number> = new Map();

      for (const token of docTokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }

      let score = 0;
      for (const qt of queryTokens) {
        const tf = termFreq.get(qt) || 0;
        const idf = this.idf.get(qt) || 0;
        const tfNorm =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength)));
        score += idf * tfNorm;
      }

      scores.push({ doc, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

// =========================================
// 2. RRF 融合排名
// =========================================

interface RankedResult {
  docId: string;
  text: string;
  metadata: Record<string, string>;
  score: number;       // 融合后的分数
  vectorRank?: number; // 向量检索中的排名
  bm25Rank?: number;   // BM25 检索中的排名
}

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; text: string; metadata: Record<string, string> }>,
  bm25Results: Array<{ id: string; text: string; metadata: Record<string, string> }>,
  k: number = 60
): RankedResult[] {
  const scoreMap = new Map<string, RankedResult>();

  // 处理向量检索结果
  vectorResults.forEach((result, rank) => {
    const existing = scoreMap.get(result.id);
    const rrfScore = 1 / (k + rank + 1);

    if (existing) {
      existing.score += rrfScore;
      existing.vectorRank = rank + 1;
    } else {
      scoreMap.set(result.id, {
        docId: result.id,
        text: result.text,
        metadata: result.metadata,
        score: rrfScore,
        vectorRank: rank + 1,
      });
    }
  });

  // 处理 BM25 结果
  bm25Results.forEach((result, rank) => {
    const existing = scoreMap.get(result.id);
    const rrfScore = 1 / (k + rank + 1);

    if (existing) {
      existing.score += rrfScore;
      existing.bm25Rank = rank + 1;
    } else {
      scoreMap.set(result.id, {
        docId: result.id,
        text: result.text,
        metadata: result.metadata,
        score: rrfScore,
        bm25Rank: rank + 1,
      });
    }
  });

  return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
}

// =========================================
// 3. Reranking（用 LLM 模拟 Cross-encoder）
// =========================================

async function rerank(
  query: string,
  candidates: RankedResult[],
  model: ReturnType<ReturnType<typeof createOpenAI>>,
  topK: number = 5
): Promise<RankedResult[]> {
  // 用 LLM 对每个候选打相关性分数
  // 注意：生产环境建议用专门的 Reranker 模型（如 Cohere Rerank）
  // 这里用 LLM 模拟是为了演示原理
  const { text } = await generateText({
    model,
    system: `你是一个相关性评分助手。给定一个查询和一组候选文档，
请对每个文档与查询的相关性打分（0-10 分）。
只输出 JSON 数组格式的分数，如 [8, 3, 9, 2, 7]。不要输出其他内容。`,
    prompt: `查询：${query}

候选文档：
${candidates.map((c, i) => `[${i}] ${c.text.slice(0, 200)}`).join('\n\n')}

请对以上 ${candidates.length} 个文档打分（0-10）：`,
  });

  try {
    const scores = JSON.parse(text) as number[];
    const reranked = candidates.map((c, i) => ({
      ...c,
      score: scores[i] || 0,
    }));
    return reranked.sort((a, b) => b.score - a.score).slice(0, topK);
  } catch {
    // JSON 解析失败，返回原排序
    return candidates.slice(0, topK);
  }
}

// =========================================
// 4. 完整的进阶 RAG 查询流程
// =========================================

interface AdvancedRAGConfig {
  embeddingApiKey: string;
  llmApiKey: string;
  llmBaseURL: string;
  llmModel: string;
  vectorTopK?: number;    // 向量检索候选数量
  bm25TopK?: number;      // BM25 检索候选数量
  finalTopK?: number;     // 最终返回给 AI 的数量
  enableReranking?: boolean;
  enableQueryRewriting?: boolean;
}

export class AdvancedRAGService {
  private bm25: SimpleBM25;
  private config: AdvancedRAGConfig;
  private llm: ReturnType<typeof createOpenAI>;
  // vectorDB 在实际项目中替换为真实的向量数据库客户端
  private vectorStore: Map<string, { text: string; vector: number[]; metadata: Record<string, string> }>;

  constructor(config: AdvancedRAGConfig) {
    this.config = {
      vectorTopK: 20,
      bm25TopK: 20,
      finalTopK: 5,
      enableReranking: true,
      enableQueryRewriting: false,
      ...config,
    };
    this.bm25 = new SimpleBM25();
    this.vectorStore = new Map();
    this.llm = createOpenAI({
      baseURL: config.llmBaseURL,
      apiKey: config.llmApiKey,
    });
  }

  // 索引文档（简化版本）
  async indexDocuments(documents: Document[]) {
    // BM25 索引
    this.bm25.index(documents);

    // 向量索引（实际项目中用向量数据库）
    for (const doc of documents) {
      const { embedding } = await embed({
        model: this.llm.embedding('text-embedding-3-small'),
        value: doc.text,
      });
      this.vectorStore.set(doc.id, {
        text: doc.text,
        vector: embedding,
        metadata: doc.metadata,
      });
    }

    console.log(`索引完成：${documents.length} 个文档`);
  }

  // Query Rewriting
  private async rewriteQuery(query: string): Promise<string> {
    if (!this.config.enableQueryRewriting) return query;

    const { text } = await generateText({
      model: this.llm(this.config.llmModel),
      system: `将用户的口语化查询改写为适合知识库检索的精确查询。
只输出改写后的查询，不要其他内容。`,
      prompt: query,
    });

    console.log(`Query 改写："${query}" → "${text}"`);
    return text;
  }

  // 完整查询流程
  async query(userQuestion: string): Promise<{
    answer: string;
    sources: RankedResult[];
    debugInfo: {
      rewrittenQuery?: string;
      vectorResults: number;
      bm25Results: number;
      fusedResults: number;
      rerankedResults: number;
    };
  }> {
    const debugInfo: any = {};

    // 1. Query 优化
    const searchQuery = await this.rewriteQuery(userQuestion);
    if (searchQuery !== userQuestion) {
      debugInfo.rewrittenQuery = searchQuery;
    }

    // 2. 向量检索
    const { embedding: queryEmbedding } = await embed({
      model: this.llm.embedding('text-embedding-3-small'),
      value: searchQuery,
    });

    // 简化的向量搜索（实际项目用向量数据库）
    const vectorScores = Array.from(this.vectorStore.entries())
      .map(([id, doc]) => ({
        id,
        text: doc.text,
        metadata: doc.metadata,
        score: cosineSimilarity(queryEmbedding, doc.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.vectorTopK!);

    debugInfo.vectorResults = vectorScores.length;

    // 3. BM25 关键词检索
    const bm25Results = this.bm25
      .search(searchQuery, this.config.bm25TopK!)
      .map(r => ({
        id: r.doc.id,
        text: r.doc.text,
        metadata: r.doc.metadata,
      }));

    debugInfo.bm25Results = bm25Results.length;

    // 4. RRF 融合
    const fusedResults = reciprocalRankFusion(vectorScores, bm25Results);
    debugInfo.fusedResults = fusedResults.length;

    // 5. Reranking（可选）
    let finalResults: RankedResult[];
    if (this.config.enableReranking && fusedResults.length > 0) {
      finalResults = await rerank(
        searchQuery,
        fusedResults.slice(0, 20), // 取前 20 个重排序
        this.llm(this.config.llmModel),
        this.config.finalTopK!
      );
    } else {
      finalResults = fusedResults.slice(0, this.config.finalTopK!);
    }
    debugInfo.rerankedResults = finalResults.length;

    // 6. 生成回答
    if (finalResults.length === 0) {
      return {
        answer: '抱歉，我没有在知识库中找到与您问题相关的信息。',
        sources: [],
        debugInfo,
      };
    }

    const context = finalResults
      .map((r, i) => `[${i + 1}] (来源: ${r.metadata.source || 'unknown'})\n${r.text}`)
      .join('\n---\n');

    const { text: answer } = await generateText({
      model: this.llm(this.config.llmModel),
      system: `你是一个专业的知识库问答助手。
请严格根据参考资料回答问题，引用来源编号。
如果参考资料不足以回答问题，请如实说明。

参考资料：
${context}`,
      prompt: userQuestion,
    });

    return { answer, sources: finalResults, debugInfo };
  }
}

// 余弦相似度计算
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 使用示例

```typescript
// src/demo.ts
import { AdvancedRAGService } from './advanced-rag';

async function main() {
  const rag = new AdvancedRAGService({
    embeddingApiKey: process.env.OPENAI_API_KEY!,
    llmApiKey: process.env.DEEPSEEK_API_KEY!,
    llmBaseURL: 'https://api.deepseek.com/v1',
    llmModel: 'deepseek-chat',
    vectorTopK: 20,
    bm25TopK: 20,
    finalTopK: 5,
    enableReranking: true,
    enableQueryRewriting: true,
  });

  // 索引文档
  await rag.indexDocuments([
    {
      id: 'doc-1',
      text: '退款政策：购买后 7 天内可以无条件申请退款。退款将在审核通过后 3-5 个工作日内原路返还。',
      metadata: { source: 'refund-policy.md' },
    },
    {
      id: 'doc-2',
      text: '产品支持 Windows 10 及以上和 macOS 12 及以上操作系统。个人版支持最多 3 台设备同时使用。',
      metadata: { source: 'product-faq.md' },
    },
    {
      id: 'doc-3',
      text: '国内订单使用顺丰或中通快递，标准快递 3-5 天到达。满 99 元免运费，未达到需支付 10 元运费。',
      metadata: { source: 'shipping-guide.md' },
    },
    {
      id: 'doc-4',
      text: '付款方式支持微信支付、支付宝和银行卡。企业用户可以申请月结账期，需要提供企业资质证明。',
      metadata: { source: 'payment-guide.md' },
    },
  ]);

  // 测试查询
  const result = await rag.query('退款要多久能收到钱？');

  console.log('=== 回答 ===');
  console.log(result.answer);

  console.log('\n=== 来源 ===');
  result.sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.metadata.source} (score: ${s.score.toFixed(4)})`);
    console.log(`    向量排名: ${s.vectorRank || '-'}, BM25排名: ${s.bm25Rank || '-'}`);
  });

  console.log('\n=== 调试信息 ===');
  console.log(result.debugInfo);
}

main().catch(console.error);
```

### Query 优化：HyDE 实现

```typescript
// src/hyde.ts
// HyDE（Hypothetical Document Embedding）实现

import { generateText, embed } from 'ai';

async function hydeSearch(
  query: string,
  model: any,
  embeddingModel: any,
  vectorDB: any, // 你的向量数据库客户端
  topK: number = 5
) {
  // 步骤 1：生成假设的回答
  const { text: hypothetical } = await generateText({
    model,
    system: `请直接回答以下问题。基于你的知识给出一个简洁的回答。
不需要声明不确定性，直接给出你认为最可能的答案。`,
    prompt: query,
  });

  console.log('假设回答:', hypothetical.slice(0, 100) + '...');

  // 步骤 2：对假设回答做 Embedding
  const { embedding } = await embed({
    model: embeddingModel,
    value: hypothetical,
  });

  // 步骤 3：用假设回答的 Embedding 去检索
  const results = await vectorDB.search({
    vector: embedding,
    topK,
  });

  return {
    results,
    hypotheticalAnswer: hypothetical,
  };
}

// 对比实验：普通检索 vs HyDE 检索
async function compareSearchMethods(query: string) {
  console.log(`\n查询: "${query}"\n`);

  // 普通检索
  console.log('--- 普通向量检索 ---');
  const normalResults = await vectorDB.search({
    queryText: query,
    topK: 5,
  });
  normalResults.forEach((r: any, i: number) => {
    console.log(`  [${i + 1}] score: ${r.score.toFixed(4)} | ${r.text.slice(0, 60)}...`);
  });

  // HyDE 检索
  console.log('\n--- HyDE 检索 ---');
  const hydeResults = await hydeSearch(query, model, embeddingModel, vectorDB, 5);
  hydeResults.results.forEach((r: any, i: number) => {
    console.log(`  [${i + 1}] score: ${r.score.toFixed(4)} | ${r.text.slice(0, 60)}...`);
  });
}
```

### 简单的 RAG 评估脚本

```typescript
// src/evaluate.ts
// 简单的 RAG 评估——计算 Recall@K 和 MRR

interface TestCase {
  question: string;
  relevantDocIds: string[];  // 人工标注的相关文档 ID
}

interface EvaluationResult {
  recallAtK: number;
  mrr: number;
  details: Array<{
    question: string;
    found: boolean;
    rank: number | null;
    retrievedIds: string[];
  }>;
}

async function evaluateRAG(
  ragService: any, // 你的 RAG 服务
  testCases: TestCase[],
  topK: number = 5
): Promise<EvaluationResult> {
  const details: EvaluationResult['details'] = [];
  let totalRecall = 0;
  let totalRR = 0;

  for (const testCase of testCases) {
    // 只做检索，不做生成
    const results = await ragService.retrieve(testCase.question);
    const retrievedIds = results.map((r: any) => r.docId).slice(0, topK);

    // 计算这个 query 的 recall
    const hits = testCase.relevantDocIds.filter(id => retrievedIds.includes(id));
    const recall = hits.length / testCase.relevantDocIds.length;
    totalRecall += recall;

    // 计算 RR（第一个正确结果的排名的倒数）
    let firstCorrectRank: number | null = null;
    for (let i = 0; i < retrievedIds.length; i++) {
      if (testCase.relevantDocIds.includes(retrievedIds[i])) {
        firstCorrectRank = i + 1;
        break;
      }
    }
    const rr = firstCorrectRank ? 1 / firstCorrectRank : 0;
    totalRR += rr;

    details.push({
      question: testCase.question,
      found: hits.length > 0,
      rank: firstCorrectRank,
      retrievedIds,
    });
  }

  const n = testCases.length;
  return {
    recallAtK: totalRecall / n,
    mrr: totalRR / n,
    details,
  };
}

// 使用示例
async function runEvaluation() {
  const testCases: TestCase[] = [
    {
      question: '退款要多久？',
      relevantDocIds: ['refund-policy-chunk-1'],
    },
    {
      question: '支持哪些操作系统？',
      relevantDocIds: ['product-faq-chunk-1'],
    },
    {
      question: '运费是多少？',
      relevantDocIds: ['shipping-guide-chunk-1'],
    },
    {
      question: '可以在几台电脑上用？',
      relevantDocIds: ['product-faq-chunk-1'],
    },
    {
      question: '怎么申请退钱？', // 注意：用的是"退钱"而不是"退款"
      relevantDocIds: ['refund-policy-chunk-1'],
    },
  ];

  const result = await evaluateRAG(ragService, testCases);

  console.log('=== 评估结果 ===');
  console.log(`Recall@5: ${(result.recallAtK * 100).toFixed(1)}%`);
  console.log(`MRR:      ${(result.mrr * 100).toFixed(1)}%`);

  console.log('\n=== 详细结果 ===');
  for (const d of result.details) {
    const status = d.found ? 'PASS' : 'FAIL';
    const rankInfo = d.rank ? `(排名第 ${d.rank})` : '(未检索到)';
    console.log(`[${status}] ${d.question} ${rankInfo}`);
  }

  // 分析失败 case
  const failures = result.details.filter(d => !d.found);
  if (failures.length > 0) {
    console.log('\n=== 失败 Case 分析 ===');
    for (const f of failures) {
      console.log(`问题: "${f.question}"`);
      console.log(`检索到的文档: ${f.retrievedIds.join(', ')}`);
      console.log('→ 需要排查：分块策略？Embedding 质量？同义词覆盖？');
      console.log('');
    }
  }
}

runEvaluation().catch(console.error);
```

---

## 实操练习

### 目标

在第 9 章的基础上，大幅提升你的 AI 工作助手的知识库检索质量。实现混合检索和重排序，让助手的回答更加精准可靠。

### 步骤

1. **优化分块策略**：把第 9 章的固定大小分块改为递归分块或按文档结构分块
2. **实现 BM25 关键词检索**：在现有的向量检索基础上，增加关键词检索通道
3. **实现 RRF 融合**：把向量检索和 BM25 检索的结果用 RRF 算法合并
4. **添加 Reranking**：使用 LLM 或 Cohere Rerank API 对融合结果做重排序
5. **实现 Query Rewriting**：对模糊的用户查询做自动改写
6. **建立评估体系**：准备测试集，计算 Recall@5 和 MRR
7. **对比优化效果**：对比优化前后的评估指标

### 验收标准

- [ ] 实现了混合检索（向量 + 关键词）
- [ ] 实现了 RRF 排名融合
- [ ] Reranking 后的 top-5 质量明显优于初始检索
- [ ] 准备了至少 20 个测试问题的评估集
- [ ] Recall@5 达到 80% 以上
- [ ] 有检索过程的日志输出（便于调试）

### 挑战加分项

- [ ] 实现 HyDE 并与普通检索做 A/B 对比
- [ ] 实现 Small-to-Big 策略
- [ ] 实现 Multi-query 检索
- [ ] 尝试不同的 Embedding 模型（如 BGE-zh），对比中文检索效果
- [ ] 用 RAGAS 的思路实现 Faithfulness 自动检测

---

## 本章小结

这一章从五个维度优化了 RAG 系统，回顾核心要点：

1. **分块策略不是一刀切**。固定分块简单但粗糙，语义分块精准但成本高，递归分块和结构化分块在多数场景下是好的平衡。Small-to-Big 策略巧妙地解决了检索粒度和上下文完整性的矛盾。

2. **混合检索弥补了纯向量检索的盲区**。向量检索擅长语义匹配但会被"语义相似但不相关"的内容干扰，关键词检索精确但不理解同义词。BM25 + 向量检索 + RRF 融合是目前性价比最高的方案。

3. **Reranking 是投入产出比最高的优化**。用 Bi-encoder 快速召回大量候选，再用 Cross-encoder 精确排序。"初筛 + 精选"的两阶段架构兼顾速度和精度。

4. **Query 优化让检索"听懂"用户**。Query Rewriting 解决模糊和口语化问题，HyDE 用"假答案"拉近查询和文档的语义距离，Multi-query 从多角度提高召回率。

5. **没有评估就没有优化**。Faithfulness、Relevance、Answer Correctness 三个维度缺一不可。建立评估数据集，定期跑回归测试。最危险的失败是"看起来对但其实错了"——必须有机制来检测。

6. **Graph RAG 是未来方向但不是当下必须**。大多数场景下，传统 RAG + 混合检索 + Reranking 已经足够好。Graph RAG 在多跳推理场景有独特价值，但构建和维护成本显著更高。

到这里，你的 AI 助手已经拥有了一个相当专业的知识库检索系统——能处理模糊查询、能综合多种检索方式、能自动评估质量。下一章，我们将探索多模态能力，让助手不只理解文字，还能理解图片、语音和文件。
