# 第9章：RAG 基础 — 让 AI 拥有你的私有知识

## 引言

假设你是一个新入职的前端开发，第一天上班，老板让你回答用户关于公司产品的问题。你非常聪明——你有扎实的 JavaScript 知识、丰富的开发经验、出色的表达能力。但问题来了：**你根本不知道这家公司的产品是什么。**

你会怎么做？翻公司的内部文档呗。

这就是 RAG（Retrieval-Augmented Generation，检索增强生成）的核心思想。

大语言模型就像那个聪明但刚入职的你——它有强大的语言理解和生成能力，但它的知识有截止日期（训练数据的截止时间），也完全不知道你公司的内部数据、你团队的代码规范、你产品的功能文档。直接让它回答业务问题，它要么编（幻觉），要么说"我不知道"。

RAG 的做法很简单粗暴：**在 AI 回答之前，先帮它检索相关的资料，然后把资料塞进 prompt 里，让它"看着参考资料答题"。**

一句话直觉：**RAG 就是给 AI 开卷考试。**

你每天写代码时搜 StackOverflow、查 MDN 文档、翻 GitHub Issues——这就是你在做"人肉 RAG"。RAG 只不过是把这个过程自动化了。

这一章，我们会从零搭建一个完整的 RAG 系统。学完之后，你的 AI 助手就能检索你公司的私有知识库，给出靠谱的回答了。

---

## 9.1 什么是 RAG

### 一句话直觉

先搜再答，带着参考资料回答问题。

### 前端类比

你用 VS Code 写代码时，IntelliSense 是怎么给你代码补全建议的？它不是凭空猜的，而是先去 `node_modules` 里的 `.d.ts` 类型定义文件**检索**相关的类型信息，然后**生成**补全建议。这就是一种"检索增强生成"——先查资料（Retrieval），再给建议（Generation）。

### 详细原理

RAG 的完整名字是 Retrieval-Augmented Generation，拆开来看：

- **Retrieval（检索）**：从知识库中找到与用户问题相关的文档片段
- **Augmented（增强）**：把检索到的内容作为额外上下文，增强给 AI 的输入
- **Generation（生成）**：AI 基于这些参考资料生成回答

整个过程可以用一个公式概括：

```
用户问题 + 检索到的相关文档 → AI → 有依据的回答
```

不用 RAG 时：

```
用户："我们公司的退款政策是什么？"
AI：（训练数据里没有你们公司的信息）
AI 回答："一般来说，退款政策通常包括..." ← 编的，通用废话
```

用了 RAG 后：

```
用户："我们公司的退款政策是什么？"
→ 检索知识库，找到《退款政策 v2.3》的相关段落
→ 把段落塞入 prompt
AI 回答："根据我们的退款政策，购买后 7 天内可以无条件退款，需要提供订单号..." ← 有依据
```

### 深层追问

你可能会问：这不就是在 prompt 里多塞了点文字吗？对，本质上就是这么简单。但魔鬼在细节：

1. **怎么知道该检索哪些文档？** —— 这就需要 Embedding 和向量数据库
2. **文档太长怎么办？** —— 需要分块（Chunking）策略
3. **检索到的内容不相关怎么办？** —— 需要评估和优化检索质量
4. **检索到了但 AI 没用好怎么办？** —— 需要优化 prompt 模板

这些问题串起来，就是这一章和下一章的全部内容。

---

## 9.2 RAG vs Fine-tuning vs 长上下文

这三种方式都能让 AI "学会新知识"，但机制完全不同。这是面试高频考点，也是实际项目中必须做的技术选型。

### 三种方式的类比

| 方式 | 类比 | 核心思路 |
|------|------|----------|
| **RAG** | 开卷考试：带着参考书答题 | 运行时检索外部知识，塞入 prompt |
| **Fine-tuning** | 补课：上了培训班再考试 | 训练阶段修改模型权重，让模型"记住"新知识 |
| **长上下文** | 把整本书塞进试卷：题目和参考资料都在卷子上 | 利用超长上下文窗口，直接把所有文档放进 prompt |

### RAG：开卷考试

**原理**：不改变模型本身，而是在每次回答时动态检索相关文档，作为上下文提供给模型。

**优点**：
- 知识可以实时更新（改文档就行，不需要重新训练模型）
- 可以明确引用来源（"根据《产品手册》第 3 章..."）
- 成本相对低（只需要 Embedding 模型 + 向量数据库）
- 可以应对海量知识（10 万条文档也没问题，因为每次只检索 top-K）

**缺点**：
- 回答质量强依赖检索质量（检索不到，答案就错）
- 有延迟（多了检索这一步）
- 需要维护知识库（文档更新了，向量也要更新）

**适用场景**：企业知识库问答、客服系统、文档助手、最新信息查询。

### Fine-tuning：补课

**原理**：用你的专有数据对模型进行额外训练，让模型的权重（参数）发生变化，"记住"新的知识或行为模式。

前端类比：Fine-tuning 就像你给 ESLint 写了一套自定义规则。原来 ESLint 不知道你团队的代码规范，但经过"训练"（配置）后，它就"学会"了你们的规范。不同的是，Fine-tuning 修改的不是配置文件，而是模型的神经网络参数。

**优点**：
- 回答风格和行为模式可以深度定制
- 运行时不需要额外检索，响应更快
- 可以学会模型原本不擅长的任务格式

**缺点**：
- 成本高（需要 GPU、训练数据准备、训练时间）
- 知识不容易更新（数据变了得重新训练）
- 容易"遗忘"——新知识可能覆盖旧知识（灾难性遗忘）
- 不适合事实性知识（模型可能"记混"细节，还是会幻觉）

**适用场景**：特定语气/风格定制、特殊任务格式（比如生成特定格式的代码）、领域专有术语理解。

### 长上下文：把整本书塞进去

**原理**：现代模型的上下文窗口越来越大（Gemini 支持 200 万 token，Claude 支持 20 万 token）。直接把所有文档塞进 prompt，不需要检索。

前端类比：长上下文就像你直接把整个 `node_modules` 的源代码打开看，而不是用 IDE 的搜索功能只看相关的部分。简单粗暴，但代价大。

**优点**：
- 最简单——不需要 Embedding、不需要向量数据库、不需要分块
- 模型能看到全部上下文，不会遗漏
- 不存在检索质量问题

**缺点**：
- 贵！按 token 计费，每次请求都要付全部文档的钱
- 慢！输入越长，推理越慢
- 有上限——再大的窗口也有尽头
- "大海捞针"问题——文档太长时，模型可能忽略中间的关键信息（Lost in the Middle 现象）

**适用场景**：文档量小（几千到几万字）的场景、一次性分析任务、原型验证。

### 如何选择？

```
你的知识量有多大？
├── 小于 5 万字 → 直接用长上下文，简单粗暴
├── 5 万 ~ 500 万字 → RAG 是最佳选择
├── 需要实时更新？ → RAG（更新文档即可）
├── 需要特殊风格/格式？ → Fine-tuning + RAG 组合
└── 预算极其有限？ → RAG（成本最可控）
```

> **实际项目中的建议**：90% 的场景用 RAG 就够了。先做 RAG，发现不够再考虑 Fine-tuning。长上下文适合做快速验证——先把文档全塞进去看看效果，效果 OK 了再用 RAG 优化成本。

---

## 9.3 Embedding 深入理解

### 一句话直觉

Embedding 就是把文字翻译成一组数字（向量），让计算机能用数学方式理解"语义"。

### 前端类比

你知道 CSS 的颜色表示法吗？"天蓝色"这个词人类能理解，但计算机不行。CSS 用 RGB 值 `rgb(135, 206, 235)` 来表示"天蓝色"——三个数字组成的向量，计算机就能处理了。而且相似的颜色，RGB 值也相近：`rgb(135, 206, 250)` 是"浅天蓝"，数值上很接近。

Embedding 做的是同样的事，只不过把"文本语义"编码成了几百到几千维的向量。语义相似的文本，向量也会相近。

### Embedding 模型是怎么工作的？

Embedding 模型是一个独立的神经网络（注意：它不是大语言模型！），专门用来把文本映射到向量空间。

```
输入："JavaScript 是一种编程语言"
                    ↓
            [Embedding 模型]
                    ↓
输出：[0.023, -0.156, 0.891, 0.045, ..., -0.234]  （1536 维向量）
```

这个过程有几个关键点：

**1. Embedding 模型和 LLM 是两个不同的东西**

LLM（如 GPT-5、Claude）的任务是**生成文本**——输入一段话，输出下一段话。

Embedding 模型（如 `qwen3.7-text-embedding-flash`、`bge-large`）的任务是**编码语义**——输入一段话，输出一个固定长度的数字向量。

类比前端：LLM 像一个 React 组件的 `render()` 函数，输入 props 输出 JSX。Embedding 模型更像是 `JSON.stringify()`，把对象编码成一种方便比较和存储的格式。

**2. 向量维度意味着什么？**

常见的维度有 768、1024、1536 等。维度越高，能表达的语义信息越丰富，但存储和计算成本也越高。

类比：用 RGB（3 维）描述颜色，能区分 1600 万种颜色。用 HSL（也是 3 维但角度不同）能更直观地表达色相、饱和度、亮度。维度越高，就像颜色空间的维度越高——能区分的"语义色彩"越多。

| 模型 | 维度 | 特点 |
|------|------|------|
| `qwen3.7-text-embedding-flash` (通义千问) | 1024 | 轻量便宜，本章使用 |
| `qwen3.7-text-embedding` (通义千问) | 1024 | 精度更高，可选更多维度 |
| `bge-large-zh` (BAAI) | 1024 | 中文优化，开源免费 |
| `text-embedding-3-small` (OpenAI) | 1536 | 通用场景 |

**3. 语义相似度 vs 关键词匹配——本质区别**

关键词匹配是"字面匹配"——搜索"JavaScript 教程"只能匹配包含"JavaScript"和"教程"这两个词的文档。

语义相似度是"含义匹配"——搜索"JavaScript 教程"也能匹配到"前端编程入门指南"和"如何学习 JS"，因为它们语义相近。

```
关键词匹配 = 你在代码里用 Ctrl+F 搜索一个变量名
语义匹配 = 你在 Google 里搜索一个模糊的问题描述

Ctrl+F "handleClick" → 只能找到精确包含 handleClick 的地方
Google "按钮点击后页面没反应" → 能找到各种相关的解答
```

语义匹配之所以能工作，是因为 Embedding 模型在训练时学到了词义关系。"JS" 和 "JavaScript" 在向量空间中几乎重叠，"前端" 和 "网页开发" 也很接近。

### 余弦相似度 vs 欧几里得距离

有了向量之后，怎么衡量两段文本的相似程度？两种主流方法：

**余弦相似度（Cosine Similarity）**

比较两个向量的**方向**是否一致，不关心长度。

类比：两个人站在原点，各自指向一个方向。如果他们指向同一个方向，余弦相似度为 1（完全相似）；如果方向垂直，相似度为 0（不相关）；如果方向相反，相似度为 -1（完全相反）。

```
向量 A = [1, 0]   指向右边
向量 B = [0.99, 0.01]  几乎指向右边
→ 余弦相似度 ≈ 0.9999（非常相似）

向量 C = [100, 0]  也指向右边，但"长度"更长
→ A 和 C 的余弦相似度 = 1.0（方向完全相同，忽略长度差异）
```

**欧几里得距离（Euclidean Distance）**

比较两个向量的**位置**是否接近，就是两点之间的直线距离。

类比：欧几里得距离就是 Google 地图上的直线距离——两个点越近，距离越小。

**实际选择**：在 RAG 场景中，**余弦相似度用得更多**。因为我们关心的是文本的"语义方向"是否一致，而不是向量的绝对大小。Embedding 模型输出的向量长度可能因文本长度不同而不同，但我们关心的是"这段文字在说什么"，而不是"这段文字有多长"。

打个比方：你比较两篇技术文章的主题是否相似，不应该因为一篇是 500 字的博客、另一篇是 5000 字的长文就判断它们不相似。余弦相似度帮你忽略这个"长度差异"，只比较"方向"（主题）。

---

## 9.4 向量数据库

### 一句话直觉

向量数据库就是专门为"语义搜索"优化的数据库——你给它一个向量，它能快速找到最相似的向量。

### 为什么普通数据库不行？

用前端的视角思考：你有一个包含 10 万条数据的数组，需要找到最相似的 5 条。

```typescript
// 暴力搜索：遍历所有数据，计算相似度，排序取 top 5
// O(n) 复杂度，10 万条还行，100 万条就慢了
const results = documents
  .map(doc => ({ doc, score: cosineSimilarity(query, doc.vector) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
```

普通数据库（MySQL、PostgreSQL）擅长精确查询：`WHERE id = 123`，`WHERE name LIKE '%keyword%'`。它们的索引（B-tree）是为精确匹配和范围查询设计的。

但向量搜索不是精确查询——你要找的是"最相似"的，没有确切的等号可以匹配。在 1536 维的空间里做最近邻搜索，传统索引完全无能为力。

### ANN（近似最近邻）：核心原理

向量数据库的核心算法是 ANN（Approximate Nearest Neighbor，近似最近邻）。注意"近似"两个字——它不保证找到绝对最近的，但能在极短时间内找到"足够近"的。

前端类比：想象你要在一个大型购物中心找到离你最近的咖啡店。精确方式是测量到每家店的距离（暴力搜索）。近似方式是：先看你在哪个楼层、哪个区域，只搜索这个区域的店——可能漏掉隔壁区域边界上一家更近的咖啡店，但速度快了 100 倍。

ANN 的常见算法：

- **HNSW（Hierarchical Navigable Small World）**：最主流的算法，类似于"跳表 + 图搜索"。想象一个多层结构——顶层是稀疏的地标节点，可以快速跳到大致区域；底层是密集的所有节点，做精确搜索。就像你在一个城市找路：先看地图确定大方向，再用导航走小路。
- **IVF（Inverted File Index）**：先把向量空间分成很多簇（聚类），搜索时只在最相关的几个簇里找。类似 Webpack 的 code splitting——不加载所有代码，只加载当前页面需要的 chunk。

### 主流向量数据库对比

**Pinecone —— 云托管，最省心**

```
定位：全托管的向量数据库云服务
类比：Vercel 之于部署。不需要自己管服务器，API 调用即可。
优点：零运维、自动扩缩容、免费额度够学习用
缺点：数据在云端（有些企业不允许）、大规模使用有成本
适合：快速上手、生产级项目
```

**Chroma —— 本地运行，适合开发**

```
定位：轻量级开源向量数据库，可以嵌入到应用中
类比：SQLite 之于关系型数据库。不需要独立部署，内嵌到应用里就能用。
优点：本地运行、API 简洁、适合开发和测试
缺点：不适合大规模生产（性能有上限）
适合：开发环境、小型项目、学习
```

**pgvector —— PostgreSQL 扩展**

```
定位：给 PostgreSQL 加上向量搜索能力的扩展
类比：给 Express 加一个中间件。不需要引入新的数据库，在已有的 PG 上装个扩展就行。
优点：不引入新的基础设施、SQL 生态兼容、事务支持
缺点：向量检索性能不如专用向量数据库、配置和调优有学习成本
适合：已经在用 PostgreSQL 的项目、不想增加运维复杂度
```

**选择建议**：

```
刚学习/做 demo？→ Chroma（本地运行，零配置）
已有 PostgreSQL？→ pgvector（不增加运维负担）
生产级新项目？→ Pinecone（全托管，省心）
对数据合规有要求？→ pgvector 或自部署方案
```

---

## 9.5 RAG 流水线：六步走

一个完整的 RAG 系统，从原始文档到最终回答，需要经过六个步骤。这六步可以分为两个阶段：

**离线阶段（Indexing）**：提前把文档处理好，存入向量数据库
**在线阶段（Querying）**：用户提问时，实时检索并生成回答

```
离线阶段（只需做一次，文档更新时重做）：
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌──────────────┐
│ 文档加载  │ →  │ 文本分块  │ →  │ 向量化     │ →  │ 存入向量数据库 │
│ (Load)   │    │ (Chunk)  │    │ (Embed)   │    │ (Store)      │
└─────────┘    └──────────┘    └───────────┘    └──────────────┘

在线阶段（每次用户提问都执行）：
┌──────────┐    ┌───────────┐    ┌──────────────────┐    ┌───────────┐
│ 用户提问  │ →  │ 查询向量化 │ →  │ 向量检索 (top-K)  │ →  │ 生成回答   │
│ (Query)  │    │ (Embed)   │    │ (Retrieve)       │    │ (Generate) │
└──────────┘    └───────────┘    └──────────────────┘    └───────────┘
```

### 第一步：文档加载（Document Loading）

把各种格式的原始文档读取为纯文本。

前端类比：这就像 Webpack 的 Loader——`markdown-loader` 处理 `.md` 文件、`html-loader` 处理 `.html` 文件、`pdf-loader` 处理 PDF。不同格式的文件需要不同的"加载器"。

常见的文档来源：
- **Markdown/TXT**：直接读取，最简单
- **PDF**：需要解析库（如 `pdf-parse`），注意扫描版 PDF 需要 OCR
- **网页**：爬取后提取正文（去掉导航栏、广告等噪音）
- **数据库**：直接查询，拼接成文本
- **Notion/Confluence**：通过 API 拉取

> **坑点提醒**：文档加载看似简单，实际上是 RAG 系统中最脏最累的一步。PDF 的表格解析经常出错、网页的正文提取容易带上噪音、不同文档的格式千差万别。数据质量在这一步就决定了 80% 的上限。

### 第二步：文本分块（Text Chunking）

把长文档切成小块。为什么不能直接把整篇文档存进去？

前端类比：搜索引擎的索引不是以"整个网页"为单位的——Google 不是把百度百科的整个页面作为一条索引。它会把页面拆分成多个段落/片段分别索引。这样当你搜索特定问题时，能精准定位到回答那个问题的那一段，而不是把整篇文章都返回给你。

分块的原因：
1. **精确性**：整篇文档作为一个 chunk，检索时要么全选要么不选，无法精确定位到相关段落
2. **上下文窗口限制**：检索到多个文档后要塞入 prompt，token 有限，不能每个都放整篇
3. **Embedding 质量**：一个 chunk 包含的主题越多，Embedding 向量越"模糊"，不利于精确匹配

最简单的分块方式——按固定大小切：

```
原始文档（3000 字）
    ↓ 按 500 字一块切分
chunk 1: 第 1-500 字
chunk 2: 第 501-1000 字
chunk 3: 第 1001-1500 字
...
```

但这样太粗暴了。可能正好把一句话切断，上下文丢失。更好的策略我们在下一章展开。

### 第三步：向量化（Embedding）

把每个 chunk 通过 Embedding 模型转成向量。

```typescript
// 伪代码
const chunks = ["chunk 1 的文本...", "chunk 2 的文本...", ...];
const vectors = await Promise.all(
  chunks.map(chunk => embeddingModel.embed(chunk))
);
// vectors[0] = [0.023, -0.156, 0.891, ...] (1024 维)
```

注意：**Embedding 是有成本的**。10 万个 chunk，每个 500 字，就是 5000 万字需要 Embedding。好消息是 Embedding 模型比 LLM 便宜得多——千问的 `qwen3.7-text-embedding-flash` 大约每百万 token 0.125 元。

### 第四步：存入向量数据库（Indexing）

把向量和原始文本一起存入向量数据库。

```typescript
// 伪代码
for (const [i, chunk] of chunks.entries()) {
  await vectorDB.insert({
    id: `doc_${i}`,
    vector: vectors[i],           // 用于检索的向量
    metadata: {
      text: chunk,                // 原始文本（检索到后要返回给 AI）
      source: "product-manual.pdf", // 来源信息
      page: 15,                   // 页码
    }
  });
}
```

存储时通常会附带 metadata（元数据），方便后续过滤和引用溯源。就像前端做搜索功能时，索引里不只存搜索词，还存对应的页面 URL、标题、分类等信息。

### 第五步：查询检索（Retrieval）

用户提问时，先把问题也向量化，然后在向量数据库中找最相似的 chunk。

```typescript
// 用户提问
const query = "退款流程是什么？";

// 1. 把问题向量化（用同一个 Embedding 模型！）
const queryVector = await embeddingModel.embed(query);

// 2. 在向量数据库中检索 top-K 个最相似的 chunk
const results = await vectorDB.search({
  vector: queryVector,
  topK: 5,  // 返回最相似的 5 个
});

// results = [
//   { text: "退款政策：购买 7 天内可退...", score: 0.92 },
//   { text: "退货流程：先联系客服...", score: 0.88 },
//   { text: "换货说明：不支持跨品类...", score: 0.75 },
//   ...
// ]
```

这里的 `topK` 参数很关键——K 太小可能漏掉相关内容，K 太大会引入噪音（不相关的内容混进去反而干扰 AI）。常见的经验值是 3-10。

**关键细节：查询和文档必须用同一个 Embedding 模型。** 就像加密和解密必须用同一个算法一样，如果文档用 `qwen3.7-text-embedding-flash` 编码，查询也必须用这个模型。不同模型的向量空间不一样，混用会导致检索完全失效。

### 第六步：生成回答（Generation）

把检索到的 chunk 塞入 prompt，让 AI 基于这些参考资料回答。

```typescript
const systemPrompt = `你是一个客服助手。请根据以下参考资料回答用户的问题。
如果参考资料中没有相关信息，请如实说"我没有找到相关信息"，不要编造。

参考资料：
---
${results.map(r => r.text).join('\n---\n')}
---`;

const response = await generateText({
  model: yourModel,
  instructions: systemPrompt,
  prompt: query,
});
```

注意 prompt 里的关键指令："如果参考资料中没有相关信息，请如实说不知道"。这是防止 AI 在检索结果不相关时自行编造答案的重要防线。

---

## 9.6 文档分块（Chunking）入门

### 一句话直觉

分块就是把长文档切成适合检索的小片段，切得好不好直接决定了检索质量。

### 前端类比

想象你在做一个电商网站的搜索功能。你会怎么建立搜索索引？

- **方案 A**：每个商品的整个详情页（标题 + 描述 + 参数 + 评价）作为一个索引项
- **方案 B**：把标题、描述、参数、评价分开索引

显然方案 B 更好——当用户搜索"防水手机壳"时，你能精准匹配到描述里提到"防水"的商品，而不是把整个页面的内容都搅在一起。

文档分块的道理一样：粒度越精细，检索越精准。但粒度太细又会丢失上下文。

### Chunk Size 的 Trade-off

**Chunk 太小（比如 100 字）**：
- 优点：检索精准，能定位到具体的句子
- 缺点：上下文丢失严重。"它"指代什么？"如上所述"说的是什么？检索到的片段可能没头没尾、看不懂
- 类比：把一篇文章切成单句，你拿到一句"但是这个方案有个致命缺陷"——什么方案？什么缺陷？

**Chunk 太大（比如 5000 字）**：
- 优点：上下文完整，每个 chunk 自成一体
- 缺点：检索不精准（一个 chunk 包含多个主题，Embedding 向量变得模糊）、浪费 token（可能只有 200 字是相关的，但你要塞 5000 字进 prompt）
- 类比：你搜一个 API 用法，结果返回了整个文档的一整章——信息在里面，但你得自己翻半天

**推荐的起始值**：

```
一般文档：500-1000 字/chunk
技术文档：300-800 字/chunk（更精确的检索）
FAQ 类型：每个 QA 对作为一个 chunk（天然的分块单位）
```

### Overlap（重叠）

相邻 chunk 之间应该有一部分重叠，防止关键信息恰好在切割点被分断。

```
不重叠：
chunk 1: [AAAA|BBBB]
chunk 2:             [CCCC|DDDD]
→ 如果重要信息在 BBBB-CCCC 的衔接处，两个 chunk 都没有完整信息

有重叠（overlap = 100 字）：
chunk 1: [AAAA|BBBB]
chunk 2:       [BBBB|CCCC]
chunk 3:             [CCCC|DDDD]
→ BBBB 同时出现在 chunk 1 和 chunk 2 中，信息不会丢失
```

常见的 overlap 比例是 chunk size 的 10%-20%。比如 chunk size 500 字，overlap 50-100 字。

---

## 9.7 检索质量评估

### 一句话直觉

做了 RAG 不等于 RAG 好用，你得有办法衡量检索效果是否达标。

### 前端类比

你做了一个搜索功能，怎么知道它好不好？不是你自己试几个 query 觉得"还行"就行了。搜索引擎有一整套评估体系，RAG 也是一样的。

### 三个核心指标

**1. 召回率（Recall）**

在所有相关的文档中，你检索到了多少？

```
总共有 10 条相关文档
你的 top-5 检索结果中有 3 条是相关的
→ Recall@5 = 3/10 = 30%
```

类比：你的搜索功能能找到所有相关商品吗？如果 100 个防水手机壳只搜到了 30 个，召回率就是 30%——漏了太多。

**2. 准确率（Precision）**

在你检索到的结果中，有多少是真正相关的？

```
你的 top-5 检索结果中
3 条是相关的，2 条是不相关的
→ Precision@5 = 3/5 = 60%
```

类比：搜索结果里有多少是"废物"？搜"React 教程"，结果里混了 Angular 和 Vue 的教程，准确率就低了。

**3. MRR（Mean Reciprocal Rank，平均倒数排名）**

第一条正确结果排在第几位？

```
如果正确答案排在第 1 位 → RR = 1/1 = 1.0
如果正确答案排在第 2 位 → RR = 1/2 = 0.5
如果正确答案排在第 5 位 → RR = 1/5 = 0.2
```

多个查询取平均就是 MRR。MRR 越高，说明正确结果排得越靠前。

类比：Google 搜索的核心指标就是让正确结果出现在第一页第一条。用户不会翻到第三页去找答案。

### 评估流程

```
1. 准备测试集：一组 (问题, 正确文档) 对
2. 运行检索：对每个问题做向量检索
3. 计算指标：对比检索结果和正确答案
4. 分析失败 case：为什么某些问题检索不到正确文档？
5. 优化调整：改 chunk 策略、换 Embedding 模型、调 topK
6. 重复以上步骤
```

> **给前端开发者的建议**：把 RAG 质量评估想象成你在做单元测试。测试集就是你的 test cases，检索结果就是 actual output，正确文档就是 expected output。你不会上线一个没有测试的功能，也不应该上线一个没有评估的 RAG 系统。

---

## 概念辨析

### RAG vs 直接塞 prompt

| | RAG | 直接塞进 prompt |
|---|---|---|
| 知识量 | 理论上无限（向量数据库存多少都行） | 受上下文窗口限制 |
| 成本 | 每次只传 top-K 的 token | 每次都传全量文档的 token |
| 精确性 | 只返回最相关的内容 | AI 需要在大段文本中自己找重点 |
| 实时性 | 更新向量库即可 | 每次请求都带最新文档 |
| 复杂度 | 需要 Embedding + 向量数据库 | 零额外架构 |

### Embedding 模型 vs LLM

| | Embedding 模型 | LLM |
|---|---|---|
| 输入 | 文本 | 文本 |
| 输出 | 固定长度的数字向量 | 文本（自然语言回答） |
| 用途 | 编码语义、用于检索/相似度比较 | 理解和生成文本 |
| 大小 | 通常较小（几百 MB） | 通常很大（几 GB ~ 几百 GB） |
| 成本 | 便宜（约 LLM 的 1/100） | 贵 |
| 类比 | `JSON.stringify()` —— 编码 | `React.render()` —— 生成 |

### 向量数据库 vs 传统数据库

| | 向量数据库 | 传统关系型数据库 |
|---|---|---|
| 查询方式 | "最相似的 K 条" | `WHERE x = y` 精确匹配 |
| 索引方式 | HNSW、IVF（空间索引） | B-tree、Hash（精确索引） |
| 返回结果 | 带相似度分数的 top-K | 精确匹配的所有行 |
| 典型操作 | 相似度搜索、KNN | CRUD、JOIN、聚合 |
| 类比 | "帮我找看起来像这个的" | "帮我找等于这个的" |

---

## 灵魂拷问

> **Q1：RAG 和直接把文档塞进 prompt 有什么区别？如果上下文窗口无限大，还需要 RAG 吗？**

> **A：** 这是一个好问题，答案是：即使上下文窗口无限大，大多数场景仍然需要 RAG。
>
> 首先说区别：RAG 是"先检索再生成"，只把最相关的内容传给 AI；直接塞 prompt 是"全量传入"。从成本上看，如果你有 10 万篇文档，每次问答都把全部文档传进去，按 token 计费的成本会是天文数字。
>
> 更重要的是，"上下文窗口无限大"在实践中还面临两个问题：
> 1. **Lost in the Middle（中间遗忘）**：即使模型能接收 100 万 token，研究表明模型对中间部分的内容关注度明显低于开头和结尾。塞的文档越多，模型越容易忽略关键信息。
> 2. **推理速度**：输入越长，推理越慢。把全部文档塞进去，等个回答可能要几十秒。
>
> 但在知识量小的场景（比如一份几页的产品说明书），直接塞进 prompt 比 RAG 更简单、效果可能更好。**别为了用 RAG 而用 RAG**。

---

> **Q2：Embedding 模型和 LLM 是同一个东西吗？为什么需要两个不同的模型？**

> **A：** 不是同一个东西，但有渊源关系。
>
> Embedding 模型的任务是"编码"——把文本压缩成一个固定长度的向量，保留语义信息。它的输出是数字，不是文字。
>
> LLM 的任务是"生成"——理解输入文本，生成新的文本。它的输出是自然语言。
>
> 为什么需要两个模型？因为它们的训练目标不同：
> - Embedding 模型的训练目标是让语义相似的文本向量接近、语义不同的文本向量远离
> - LLM 的训练目标是预测下一个 token
>
> 前端类比：`JSON.stringify()` 和 `console.log()` 都处理 JavaScript 对象，但一个是序列化（编码），一个是展示（生成）。你不会用 `console.log()` 去做数据存储，也不会用 `JSON.stringify()` 去做用户展示。
>
> 补充一点：技术上，LLM 内部确实有 Embedding 层（把 token 映射为向量），你也可以用 LLM 的 Embedding 层来做文本编码。但专用的 Embedding 模型更小、更快、更便宜，效果也针对检索场景做了优化，所以实际项目中都是分开用的。

---

> **Q3：你的文档有 10 万条，用户问了一个问题，向量检索返回 top 5。如果正确答案不在 top 5 里怎么办？**

> **A：** 这是 RAG 系统最常见的失败模式——检索失败（Retrieval Miss）。应对策略有好几层：
>
> **第一层：增大 K 值**。top-5 找不到？试试 top-20。但 K 太大会引入噪音，也会占用更多 token。
>
> **第二层：优化 Embedding**。也许你用的 Embedding 模型对你的领域理解不好。比如中文医学文档，用通用的英文 Embedding 模型效果可能很差。换成领域优化的 Embedding 模型（如 BGE 系列的中文模型）可能大幅提升。
>
> **第三层：优化分块策略**。也许正确答案在一个很长的 chunk 里，被其他不相关的内容"稀释"了，导致 Embedding 不够精准。减小 chunk size 或改用语义分块可能有效。
>
> **第四层：混合检索**。向量检索找不到，也许关键词检索能找到。下一章会讲混合检索（Hybrid Search）。
>
> **第五层：Query 优化**。也许问题是用户的提问方式不好。"那个东西怎么弄"——"那个东西"是什么？让 AI 先改写用户的提问再检索（Query Rewriting），下一章也会讲。
>
> **兜底策略**：当检索结果的相似度分数都很低时（比如都低于 0.7），系统应该主动说"我没有找到相关信息"，而不是硬用低质量的结果去生成答案。

---

> **Q4：Chunk 大小设为 200 字和 2000 字，各自的 trade-off？**

> **A：**
>
> **200 字的 chunk**：
> - 检索精准度高：每个 chunk 主题单一，Embedding 向量"纯净"，语义匹配更精确
> - 但上下文碎片化严重：一个 chunk 可能只有半句话，缺少前因后果
> - 需要更多的 chunk 才能覆盖同样的知识量，向量数据库更大
> - 适合：FAQ 数据库、高精度问答
>
> **2000 字的 chunk**：
> - 上下文完整：每个 chunk 自成一体，AI 容易理解
> - 但检索精准度低：一个 chunk 可能涵盖 3-4 个子主题，Embedding 向量是多个主题的"平均值"
> - 浪费 token：可能只有 200 字是相关的，但 AI 要读完全部 2000 字
> - 适合：需要完整上下文的长文档分析
>
> 前端类比：这就像 React 组件的粒度问题。组件拆得太细（一个按钮一个组件、一个文字一个组件），维护成本高但复用性好；组件粒度太大（整个页面一个组件），简单但不灵活。**没有银弹，根据具体场景选择合适的粒度。**

---

> **Q5：中文文档做 RAG 和英文文档有什么不同的坑？**

> **A：** 坑还不少：
>
> **1. 分词问题**：英文单词之间有空格，天然分隔；中文字与字之间没有分隔符。"下载应用" 到底是 "下载/应用" 还是 "下/载/应/用"？分块时如果按字符数硬切，可能切断一个词。需要用分词工具（如 jieba）辅助。
>
> **2. Embedding 模型选择**：很多主流 Embedding 模型是英文语料训练的，对中文的语义理解可能不够好。建议选中文优化的模型：通义千问 Embedding（阿里云百炼）、BGE 系列（BAAI 的开源模型）、M3E、text2vec-chinese 等。
>
> **3. Token 计算差异**：同样内容的中文文本，token 数量通常比英文多（因为中文字符在多数 tokenizer 中需要更多 token 来表示）。这意味着同样长度的中文文档，Embedding 和 LLM 的成本会更高。
>
> **4. 中英混合**：技术文档中经常中英混合（"使用 useState Hook 管理状态"），这会影响分块和 Embedding 质量。有些 Embedding 模型处理中英混合文本的效果不好。
>
> **5. 同义词和近义词更复杂**：中文的表述方式更灵活。"退款" = "退钱" = "把钱退给我" = "返还费用"，语义检索需要能识别这些不同表述。

---

> **Q6：向量数据库说是"近似"最近邻，那它会不会漏掉最相关的文档？这个风险怎么评估？**

> **A：** 会。这是"近似"的代价。
>
> ANN 算法（如 HNSW）通过构建层次化的图结构来加速搜索，但它不保证找到真正的最近邻——可能会漏掉一些距离很近但在搜索路径上"拐弯太多"的节点。
>
> 不过在实际应用中，这个风险通常很小：
>
> **1. 召回率很高**：主流的 HNSW 算法在默认参数下，recall@10 通常能达到 95%+ 甚至 99%+。也就是说，真正的 top-10 中有 95% 以上都能被找到。
>
> **2. 可以调参**：HNSW 的 `ef_search` 参数（搜索时的候选队列大小）越大，召回率越高，但搜索越慢。你可以根据业务需求在速度和精度之间做权衡。
>
> **3. RAG 场景容错性强**：你检索 top-5，即使漏掉了排名第 3 的文档，排名第 6 的文档替补进来可能也包含相关信息。除非前 5 全漏了（概率极低），否则对最终回答的影响有限。
>
> **评估方法**：用精确暴力搜索（对所有向量计算距离）的结果作为 baseline，和 ANN 的结果对比。差异就是 ANN 的"近似损失"。如果你有 10 万条数据，在一个小的测试集上跑一次暴力搜索也就几秒钟，完全可以做这个对比。

---

## 最佳实践

### DO

- **DO** 在项目初期用"直接塞 prompt"的方式验证可行性，再引入 RAG 优化成本
- **DO** 保留检索到的原始 chunk 信息（来源、页码），方便回答时引用出处
- **DO** 设置相似度阈值——如果检索结果的分数都低于阈值，让 AI 说"我不确定"而不是硬答
- **DO** 用同一个 Embedding 模型处理文档和查询——换模型意味着要重新 Embedding 所有文档
- **DO** 把 Embedding 过程和存储过程做成可重跑的脚本——文档更新时需要重新索引
- **DO** 从小规模数据开始验证（几十篇文档），确认效果后再扩展到全量
- **DO** 在 prompt 中明确指示 AI 基于检索结果回答，找不到就说不知道

### DON'T

- **DON'T** 跳过数据清洗就开始 Embedding——垃圾进垃圾出，脏数据会严重拉低检索质量
- **DON'T** 用一个 Embedding 模型编码文档、另一个模型编码查询——向量空间不兼容，检索会失效
- **DON'T** 把所有文档不分类型地混在一起——FAQ、产品文档、技术手册应该分开索引或打标签
- **DON'T** 忽略 chunk 的 overlap——没有重叠的分块会导致切割点的信息丢失
- **DON'T** 只看 demo 效果就上线——RAG 必须有评估指标和测试集，否则你不知道它什么时候会"静悄悄地失败"
- **DON'T** 以为 RAG 能解决所有知识问题——模型需要推理能力的问题（如数学题），检索再多文档也没用
- **DON'T** 为了"先进"而选择复杂的向量数据库——如果你的数据量小于 10 万条，Chroma 甚至内存里的暴力搜索就够了

---

## 代码实战

> **项目归属**：本章代码实战**独立建一个 `rag-demo` 项目**（ts 项目，`npx tsx` 运行，脚本已加 `import 'dotenv/config'` 加载 `.env`），**不在主线 Next.js 项目里**；最后一节「在 Next.js API Route 中使用」才接入 Next.js。

下面我们用 TypeScript + Vercel AI SDK 搭建一个最简单的 RAG 系统。

### 准备工作

```bash
# 初始化项目
mkdir rag-demo && cd rag-demo
npm init -y
npm install ai @ai-sdk/deepseek @ai-sdk/openai-compatible chromadb dotenv
npm install -D typescript tsx @types/node
```

然后在项目根目录新建 `.env`，填入两个 Key（`QWEN_API_KEY` 是千问 Embedding 的 Key，`DEEPSEEK_API_KEY` 是 DeepSeek 大模型的 Key）：

```text
QWEN_API_KEY=sk-xxx        # 通义千问 Embedding（阿里云百炼 DashScope）
DEEPSEEK_API_KEY=sk-xxx    # DeepSeek 大模型
```

### 第一步：文档准备与分块

```typescript
// lib/chunker.ts
// 简单的文本分块器——按固定大小分块，带重叠

interface Chunk {
  id: string;
  text: string;
  metadata: {
    source: string;
    chunkIndex: number;
  };
}

export function splitTextIntoChunks(
  text: string,
  source: string,
  options: {
    chunkSize?: number;   // 每块的字符数
    overlap?: number;     // 重叠字符数
  } = {}
): Chunk[] {
  const { chunkSize = 500, overlap = 100 } = options;
  const chunks: Chunk[] = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        id: `${source}_chunk_${chunkIndex}`,
        text: chunkText,
        metadata: {
          source,
          chunkIndex,
        },
      });
      chunkIndex++;
    }

    // 下一个 chunk 的起点 = 当前起点 + chunkSize - overlap
    start += chunkSize - overlap;
  }

  return chunks;
}

// 使用示例
const document = `
我们公司的退款政策如下：

1. 购买后 7 天内，可以无条件申请退款。
2. 退款需要提供原始订单号和购买凭证。
3. 数字产品（如会员、课程）一旦激活，不支持退款。
4. 实物商品需要保持完好，不影响二次销售。
5. 退款将在审核通过后 3-5 个工作日内原路返还。

如需退款，请联系客服邮箱 support@example.com，
或在"我的订单"页面点击"申请退款"按钮。
`;

const chunks = splitTextIntoChunks(document, "refund-policy");
console.log(`文档被分成了 ${chunks.length} 个 chunk`);
chunks.forEach(c => console.log(`[${c.id}] ${c.text.slice(0, 50)}...`));
```

### 第二步：Embedding 与存入向量数据库

```typescript
// lib/indexer.ts
// 把文档 chunk 向量化并存入 Chroma

import 'dotenv/config';
import { embed } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ChromaClient } from 'chromadb';
import { splitTextIntoChunks } from './chunker';

// 通义千问（阿里云百炼 DashScope）Embedding，走 OpenAI 兼容接口
const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

async function indexDocuments() {
  // 1. 连接 Chroma（本地运行）
  const chroma = new ChromaClient();

  // 2. 创建或获取 collection（类似数据库的表）
  const collection = await chroma.getOrCreateCollection({
    name: 'company-docs',
  });

  // 3. 准备文档
  const documents = [
    {
      source: 'refund-policy',
      text: `我们公司的退款政策如下：购买后 7 天内可以无条件申请退款。
退款需要提供原始订单号和购买凭证。数字产品一旦激活不支持退款。
实物商品需要保持完好。退款将在 3-5 个工作日内原路返还。`,
    },
    {
      source: 'shipping-guide',
      text: `发货说明：下单后 48 小时内发货。国内使用顺丰或中通快递。
国际订单使用 DHL 或 FedEx。标准快递 3-5 天到达，加急 1-2 天。
免邮门槛为 99 元，未达到需支付 10 元运费。`,
    },
    {
      source: 'product-faq',
      text: `常见问题：Q: 产品支持哪些操作系统？A: 支持 Windows 10+、macOS 12+。
Q: 可以同时在多台设备使用吗？A: 个人版支持 3 台设备，团队版无限制。
Q: 数据存储在哪里？A: 数据存储在用户本地，不上传云端。`,
    },
  ];

  // 4. 分块
  const allChunks = documents.flatMap(doc =>
    splitTextIntoChunks(doc.text, doc.source, { chunkSize: 200, overlap: 50 })
  );

  // 5. 逐 chunk 用千问模型向量化，再显式存入 Chroma
  for (const chunk of allChunks) {
    const { embedding } = await embed({
      model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
      value: chunk.text,
    });
    await collection.add({
      ids: [chunk.id],
      embeddings: [embedding],
      documents: [chunk.text],
      metadatas: [chunk.metadata],
    });
  }

  console.log(`成功索引 ${allChunks.length} 个 chunk`);
}

indexDocuments().catch(console.error);
```

### 第三步：检索 + 生成回答

```typescript
// lib/rag-query.ts
// 完整的 RAG 查询流程

import 'dotenv/config';
import { generateText, embed } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ChromaClient } from 'chromadb';

// 通义千问（阿里云百炼 DashScope）Embedding，走 OpenAI 兼容接口
const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

async function ragQuery(userQuestion: string) {
  // === 第一步：检索相关文档 ===

  const chroma = new ChromaClient();

  const collection = await chroma.getCollection({
    name: 'company-docs',
  });

  // 用千问模型把问题向量化
  const { embedding: queryEmbedding } = await embed({
    model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
    value: userQuestion,
  });

  // 向量检索 top-3（显式传入 queryEmbeddings）
  const searchResults = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 3,
  });

  const retrievedDocs = searchResults.documents[0] || [];
  const retrievedMetadatas = searchResults.metadatas[0] || [];
  const distances = searchResults.distances?.[0] || [];

  console.log('--- 检索结果 ---');
  retrievedDocs.forEach((doc, i) => {
    console.log(`[${i + 1}] 来源: ${retrievedMetadatas[i]?.source}`);
    console.log(`    距离: ${distances[i]?.toFixed(4)}`);
    console.log(`    内容: ${doc?.slice(0, 80)}...`);
  });

  // === 第二步：构造带检索结果的 prompt ===

  const context = retrievedDocs
    .map((doc, i) => `[来源: ${retrievedMetadatas[i]?.source}]\n${doc}`)
    .join('\n---\n');

  const systemPrompt = `你是一个专业的客服助手。请根据以下参考资料回答用户的问题。

规则：
1. 只根据参考资料中的信息回答，不要编造
2. 如果参考资料中没有相关信息，请明确告知用户
3. 回答时引用信息来源

参考资料：
---
${context}
---`;

  // === 第三步：调用 LLM 生成回答 ===

  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    instructions: systemPrompt,
    prompt: userQuestion,
  });

  console.log('\n--- AI 回答 ---');
  console.log(text);

  return text;
}

// 测试
async function main() {
  await ragQuery('你们的退款政策是什么？多久能收到退款？');
  console.log('\n========\n');
  await ragQuery('可以在几台设备上使用？');
  console.log('\n========\n');
  await ragQuery('你们的CEO是谁？'); // 故意问知识库里没有的问题
}

main().catch(console.error);
```

### 第四步：封装成可复用的 RAG 服务

```typescript
// lib/rag-service.ts
// 封装一个可复用的 RAG 服务类

import { generateText, streamText, embed } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ChromaClient } from 'chromadb';

// 通义千问（阿里云百炼 DashScope）Embedding，走 OpenAI 兼容接口
const dashscope = createOpenAICompatible({
  name: 'dashscope',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.QWEN_API_KEY,
});

interface RAGConfig {
  collectionName: string;
  llmModel: string;
  topK?: number;
  similarityThreshold?: number; // 低于此阈值的结果不采用
}

interface RetrievalResult {
  text: string;
  source: string;
  score: number;
}

export class RAGService {
  private config: RAGConfig;
  private chroma: ChromaClient;

  constructor(config: RAGConfig) {
    this.config = {
      topK: 5,
      similarityThreshold: 0.3, // Chroma 用距离，越小越相似
      ...config,
    };

    this.chroma = new ChromaClient();
  }

  // 检索相关文档
  async retrieve(query: string): Promise<RetrievalResult[]> {
    const collection = await this.chroma.getCollection({
      name: this.config.collectionName,
    });

    // 用千问模型把查询向量化
    const { embedding } = await embed({
      model: dashscope.embeddingModel('qwen3.7-text-embedding-flash'),
      value: query,
    });

    const results = await collection.query({
      queryEmbeddings: [embedding],
      nResults: this.config.topK,
    });

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances?.[0] || [];

    return docs
      .map((text, i) => ({
        text: text || '',
        source: (metadatas[i]?.source as string) || 'unknown',
        score: distances[i] || 999,
      }))
      .filter(r => r.score <= this.config.similarityThreshold!);
      // 过滤掉相似度太低的结果
  }

  // 检索 + 生成
  async query(userQuestion: string): Promise<{
    answer: string;
    sources: RetrievalResult[];
  }> {
    const sources = await this.retrieve(userQuestion);

    // 没有找到相关文档
    if (sources.length === 0) {
      return {
        answer: '抱歉，我没有找到与您问题相关的信息。请尝试换个方式提问，或联系人工客服。',
        sources: [],
      };
    }

    const context = sources
      .map((s, i) => `[${i + 1}] (来源: ${s.source})\n${s.text}`)
      .join('\n---\n');

    const { text } = await generateText({
      model: deepseek(this.config.llmModel),
      instructions: `你是一个专业的客服助手。请根据以下参考资料回答用户的问题。
只根据参考资料回答，不要编造信息。如果资料不足以回答，请如实告知。

参考资料：
${context}`,
      prompt: userQuestion,
    });

    return { answer: text, sources };
  }

  // 流式版本——适合前端展示
  async queryStream(userQuestion: string) {
    const sources = await this.retrieve(userQuestion);

    if (sources.length === 0) {
      return {
        textStream: (async function* () {
          yield '抱歉，我没有找到与您问题相关的信息。';
        })(),
        sources: [],
      };
    }

    const context = sources
      .map((s, i) => `[${i + 1}] (来源: ${s.source})\n${s.text}`)
      .join('\n---\n');

    const result = streamText({
      model: deepseek(this.config.llmModel),
      instructions: `你是一个专业的客服助手。请根据参考资料回答问题。
只根据参考资料回答，不要编造。

参考资料：
${context}`,
      prompt: userQuestion,
    });

    return { textStream: result.textStream, sources };
  }
}
```

### 在 Next.js API Route 中使用

> **回到主线项目**：第 1~4 步都是在独立的 `rag-demo` 里验证 RAG 逻辑。从这一步开始回到**主线 Next.js 项目**——把 `rag-demo` 里的 `lib/rag-service.ts` 复制到主线项目的 `lib/` 目录（这样就能用 `@/lib/rag-service` 导入），再新建下面的 `app/api/rag/route.ts`。同时记得在主线项目的 `.env.local` 里加上 `QWEN_API_KEY`（千问 Embedding 的 Key；`DEEPSEEK_API_KEY` 之前已经配过）。

```typescript
// app/api/rag/route.ts
// Next.js API Route —— 暴露 RAG 查询接口

import { RAGService } from '@/lib/rag-service';

const rag = new RAGService({
  collectionName: 'company-docs',
  llmModel: 'deepseek-chat',
  topK: 5,
  similarityThreshold: 0.3,
});

export async function POST(req: Request) {
  const { question } = await req.json();

  // 流式返回
  const { textStream, sources } = await rag.queryStream(question);

  // 使用 ReadableStream 实现 SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 先发送来源信息
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
      );

      // 流式发送回答
      for await (const chunk of textStream) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`)
        );
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 实操练习

### 目标

为你的 AI 工作助手添加知识库检索功能。助手能够基于你上传的文档回答问题，并引用来源。

### 步骤

1. **准备知识库文档**：准备 3-5 篇文档（可以是你团队的技术规范、产品 FAQ、或任何 Markdown/文本文件）
2. **实现分块器**：编写 `splitTextIntoChunks` 函数，支持自定义 chunk size 和 overlap
3. **搭建本地 Chroma**：运行 Chroma 并创建 collection
4. **实现索引脚本**：读取文档 → 分块 → 存入 Chroma
5. **实现查询接口**：接收用户问题 → 向量检索 → 构造 prompt → 生成回答
6. **集成到前端**：在聊天界面中展示 AI 回答和参考来源

### 验收标准

- [ ] 至少索引了 3 篇文档
- [ ] 对于知识库内的问题，AI 能给出有依据的回答
- [ ] 对于知识库外的问题，AI 能诚实说"不知道"而不是编造
- [ ] 回答中包含来源引用（哪篇文档的哪部分）
- [ ] 检索延迟在 500ms 以内

### 挑战加分项

- [ ] 实现相似度分数的可视化——前端展示每个检索结果的相似度
- [ ] 支持文档更新——上传新文档后自动重新索引
- [ ] 实现简单的评估脚本——准备 10 个测试问题，计算 Recall@5
- [ ] 对比不同 chunk size（200/500/1000）对检索质量的影响

---

## 本章小结

这一章我们从零搭建了一个完整的 RAG 系统。回顾核心要点：

1. **RAG = 检索 + 生成**：先从知识库中找到相关文档，再让 AI 基于这些文档回答。本质就是"开卷考试"。

2. **三种知识增强方式各有适用场景**：RAG 灵活且成本可控（适合 90% 的场景），Fine-tuning 适合深度定制风格和行为，长上下文适合小量文档的快速验证。

3. **Embedding 是语义搜索的基石**：把文本转成向量，让计算机能用数学方式理解语义相似性。记住：Embedding 模型和 LLM 是两个不同的东西。

4. **向量数据库专为相似度搜索优化**：核心是 ANN 近似最近邻算法，用"近似"换"速度"。选择上，Chroma 适合开发、pgvector 适合已有 PG 的项目、Pinecone 适合零运维。

5. **RAG 流水线六步走**：文档加载 → 文本分块 → 向量化 → 存储 → 检索 → 生成。每一步都有优化空间。

6. **分块策略直接影响检索质量**：chunk 太小丢上下文、太大不精准。overlap 防止切割点的信息丢失。

7. **必须有检索质量评估**：用 Recall、Precision、MRR 衡量检索效果，不然你不知道系统什么时候在"静悄悄地失败"。

下一章，我们会深入 RAG 的进阶技术——更智能的分块策略、混合检索、重排序、以及如何系统性地评估和优化 RAG 系统。从"能用"到"好用"，中间隔着不少功夫。
