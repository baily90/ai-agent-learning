# 附录 A：术语表

> 涵盖本学习资料中出现的所有核心术语，按字母顺序排列。
> 每个术语附带一句话定义和前端类比，帮你用熟悉的概念理解 AI 世界。

---

| 术语 | 中文 | 定义 | 前端类比 |
|------|------|------|---------|
| A2A (Agent-to-Agent) | Agent 间协议 | Google 提出的 Agent 之间互相通信和协作的标准化协议，让不同厂商的 Agent 能互操作 | 类似 REST API 规范——不同团队的服务只要遵循同一套接口约定就能互调 |
| Agent | 智能体 | 能自主感知环境、做出决策并采取行动的 AI 系统，核心是"感知→思考→行动"的循环 | 自动化端到端测试框架（如 Cypress），但它会自己决定测什么、怎么测 |
| AI Gateway | AI 网关 | 统一管理 AI API 调用的中间层，负责路由、限流、鉴权、缓存和可观测性 | Nginx / API Gateway——所有请求过网关，你可以在这一层做限流、日志、负载均衡 |
| ANN (Approximate Nearest Neighbor) | 近似最近邻 | 向量数据库的核心算法，用"近似"换"速度"来快速找到最相似的向量 | 类似模糊搜索（fuzzy search）——不要求精确匹配，但速度远快于暴力遍历 |
| API Key | API 密钥 | 调用 AI 模型 API 时用于身份验证的密钥字符串 | 和你用 `process.env.GITHUB_TOKEN` 调 GitHub API 一样，是你的身份凭证 |
| Attention (Mechanism) | 注意力机制 | Transformer 架构的核心，让模型在处理每个 token 时能"关注"到输入中所有其他 token 的信息 | 类似 React 的 Context——组件树中任意层级的组件都能直接访问到全局状态，不需要逐层传递 props |
| BPE (Byte Pair Encoding) | 字节对编码 | 一种将文本切分为 token 的算法，通过反复合并最频繁出现的字符对来构建词汇表 | 代码分割（Code Splitting）的文本版——把长文本按统计规律拆成更小的可复用单元 |
| Chain-of-Thought (CoT) | 思维链 | 一种 Prompt 技巧，让 AI 先展示推理过程再给出答案，显著提升推理类任务的准确率 | Code Review 时要求"写出你的分析过程"而不是只给结论——过程本身帮助思考者得出更好的结论 |
| Chatbot | 聊天机器人 | 只能被动对话、不能主动行动的 AI 系统，是 Agent 的前身 | 一个只有 `<textarea>` 和发送按钮的简单表单页面 |
| Chunk / Chunking | 分块 | 将长文档切分成适合检索和处理的小片段，是 RAG 流水线的关键步骤 | 就像 Webpack 的 Code Splitting——把一个大 bundle 拆成多个小 chunk，按需加载 |
| Completion | 补全/生成 | AI 模型基于输入文本生成后续文本的过程，也指 API 返回的生成结果 | 类似 IDE 的自动补全（IntelliSense），但生成的不只是代码片段，而是完整的文本内容 |
| Constrained Decoding | 受约束解码 | 在 AI 生成过程中，根据 Schema 约束屏蔽不合法的 token，从源头保证输出格式正确 | `<input type="number">` ——浏览器从键盘层面阻止你输入字母，而不是"输入后校验" |
| Context Window | 上下文窗口 | 模型单次能处理的最大 token 数量，包括输入和输出，超出会被截断 | 浏览器的 `localStorage` 容量限制——超了就存不进去，你得想办法管理空间 |
| Cosine Similarity | 余弦相似度 | 衡量两个向量方向一致性的度量方法，值域 [-1, 1]，越接近 1 表示语义越相似 | 比较两个 CSS 颜色值的"色相"是否接近——忽略亮度差异，只看颜色方向 |
| Cross-encoder | 交叉编码器 | 一种重排序模型，同时输入 query 和 document 进行关联打分，精度高但速度慢 | 类似 `Array.sort()` 的自定义比较函数——对每对元素做精确比较，O(n log n) 但结果准确 |
| Edge Runtime | 边缘运行时 | 在靠近用户的边缘节点上运行代码的环境，减少网络延迟 | Vercel Edge Functions / Cloudflare Workers——代码跑在离用户最近的节点上 |
| Embedding | 嵌入/向量化 | 将文本转换为高维数字向量的过程，使计算机能用数学方式理解语义相似性 | 就像 CSS 的 `rgb(135, 206, 235)` 把"天蓝色"编码为三个数字——Embedding 把一段话编码为几百到几千个数字 |
| Embedding Model | 嵌入模型 | 专门用于将文本转换为向量的模型，和 LLM 是两个不同的东西 | `JSON.stringify()` ——把对象编码成一种方便比较和存储的格式，不是用来"生成"内容的 |
| Evaluation | 评估 | 用量化指标（准确率、一致性等）衡量 AI 系统质量的过程 | 就像 Lighthouse 给你的网页打分——不靠主观感觉，用数据说话 |
| Few-shot (Learning) | 少样本学习 | 在 Prompt 中提供少量输入-输出示例，让模型"学会"你期望的模式 | 单元测试的 test cases——你不用长篇解释函数行为，几个 `expect(fn(x)).toBe(y)` 就说清楚了 |
| Fine-tuning | 微调 | 在预训练模型基础上用自己的数据继续训练，修改模型权重以学习新知识或行为 | 买了一辆标准配置的车，去改装店做定制改装——底子是原厂的，但外观和性能按你的需求改了 |
| Function Calling | 函数调用 | AI 决定需要调用某个外部函数时生成结构化调用请求的能力（OpenAI 术语，等同 Tool Use） | React 的事件系统——用户点击触发 SyntheticEvent，React 调度你注册的 handler |
| Generative UI | 生成式 UI | AI 不只返回文本，而是动态生成 UI 组件（如卡片、表格、图表）来展示结果 | React Server Components 的动态渲染——服务端根据数据动态决定返回什么组件 |
| Graph RAG | 图谱 RAG | 在传统 RAG 基础上引入知识图谱，利用实体间的关系来增强检索和推理能力 | GraphQL + REST——不只是取单条数据，还能顺着关系链查出关联数据 |
| Grounding | 接地/事实锚定 | 让 AI 的回答基于可验证的事实来源（如检索结果、数据库），而非仅靠训练记忆 | 就像前端渲染必须基于后端返回的真实数据，而不是用 mock 数据上线 |
| Guardrails | 护栏 | 对 AI 输入输出施加的安全约束和过滤规则，防止有害内容的生成或泄露 | 表单验证 + CSP（Content Security Policy）——前端校验输入合法性，安全策略阻止恶意内容 |
| Hallucination | 幻觉 | AI 编造看似合理但实际上不存在或不正确的信息 | 就像一个不靠谱的后端接口——返回格式正确的 JSON，但里面的数据是编的 |
| HNSW (Hierarchical Navigable Small World) | 分层可导航小世界 | 最主流的向量搜索索引算法，通过多层图结构实现高效的近似最近邻搜索 | 类似跳表（Skip List）——多层索引结构，顶层快速定位大致区域，底层精确搜索 |
| HyDE (Hypothetical Document Embeddings) | 假设文档嵌入 | 一种 RAG 优化技巧：先让 AI 生成一个"假设的理想答案"，用这个答案做检索而非用原始问题 | 有点像"先渲染一个骨架屏，再用真实数据替换"——先造一个近似结果来辅助查找 |
| In-Context Learning (ICL) | 上下文内学习 | 模型从 Prompt 中的示例提取模式并应用到新输入上的能力，不改变模型权重 | 就像看组件的 Storybook 示例就能理解组件用法，不需要阅读全部源码 |
| Inference | 推理 | 模型基于输入生成输出的过程（区别于训练），每次 API 调用都是一次推理 | 类似函数调用——训练是"定义函数"，推理是"执行函数" |
| JSON Mode | JSON 模式 | 模型提供的一种约束模式，保证输出是合法的 JSON，但不保证结构符合特定 Schema | `Content-Type: application/json` ——保证响应是 JSON，但具体字段是什么不确定 |
| Knowledge Base | 知识库 | 存储企业或领域专有知识的数据集合，供 RAG 系统检索使用 | 项目的 `docs/` 文件夹 + Notion 文档——团队的知识沉淀，新人入职要先翻一遍 |
| LLM (Large Language Model) | 大语言模型 | 在海量文本上训练的大规模神经网络模型，能理解和生成自然语言 | 一个超级灵活的 React 组件——什么都能渲染，但输出完全取决于你传入的 Props（Prompt） |
| LoRA (Low-Rank Adaptation) | 低秩自适应 | 一种参数高效的 Fine-tuning 技术，只训练模型中一小部分新增参数，大幅降低训练成本 | 就像给组件库写主题覆盖（theme override）而不是 fork 整个库重写——改动最小，效果显著 |
| Lost in the Middle | 中间遗忘 | LLM 对长文本中间部分的信息记忆和关注度明显低于开头和结尾的现象 | 类似用户浏览网页时的 F 型阅读模式——开头认真看，中间扫一眼，结尾再看看 |
| maxSteps | 最大步数 | Vercel AI SDK 中限制 Tool Call Loop 最大循环次数的参数，防止无限循环 | React 的 `useEffect` 依赖数组防止无限重渲染——没有限制就可能死循环 |
| MCP (Model Context Protocol) | 模型上下文协议 | Anthropic 提出的标准化协议，让 AI 模型能以统一方式连接外部工具和数据源 | 类似 USB-C 接口标准——不管什么设备，只要支持这个协议就能即插即用 |
| Mixture of Experts (MoE) | 混合专家 | 一种模型架构，包含多个"专家"子网络，每次推理只激活其中少数几个，提高效率 | 微前端架构——多个独立子应用，路由系统根据 URL 只加载当前需要的那个 |
| Multi-Agent | 多智能体 | 多个 Agent 协作完成复杂任务的系统架构，每个 Agent 负责不同的专业领域 | 微服务架构——每个服务有自己的职责，通过 API 互相协作完成业务流程 |
| Multimodal | 多模态 | AI 模型能同时处理多种类型的信息（文本、图片、音频、视频） | 浏览器从只能渲染纯文本 HTML 进化到能处理 `<img>`、`<audio>`、`<video>` |
| Negative Prompting | 负面提示 | 在 Prompt 中明确告诉 AI "不要做什么" | ESLint 规则中的 `"no-console": "error"` ——明确禁止某些行为 |
| Orchestration | 编排 | 协调多个 Agent 或工作流步骤的执行顺序和数据流转 | CI/CD Pipeline 的 Job 编排——定义哪些步骤并行、哪些串行、怎么传递中间结果 |
| Overlap | 重叠 | 分块时相邻 chunk 之间保留的重叠文本，防止关键信息在切割点丢失 | 就像轮播图相邻幻灯片的过渡区域——确保视觉上没有硬切割的断裂感 |
| Prompt | 提示词 | 发送给 AI 模型的输入文本，包含你的指令、上下文和期望 | 发给 AI 的"请求体"——不是随便聊天，而是一份结构化的指令，就像 API 的 request body |
| Prompt Caching | 提示词缓存 | 缓存相同或相似 Prompt 的处理结果，避免重复计算，降低成本和延迟 | HTTP 缓存（Cache-Control）——相同的请求直接返回缓存结果，不用每次都重新计算 |
| Prompt Chaining | 提示词串联 | 将复杂任务拆成多步 Prompt，每步的输出作为下一步的输入 | Redux Middleware Chain / RxJS pipe——每个操作符做一件事，串起来完成复杂任务 |
| Prompt Engineering | 提示词工程 | 设计和优化 Prompt 以获得最佳 AI 输出的工程实践 | 接口设计——你在定义一个函数的输入格式、约束条件和期望输出 |
| Prompt Injection | 提示词注入 | 恶意用户在输入中嵌入指令试图覆盖 System Prompt 的攻击方式 | SQL 注入的 AI 版——用户输入的"数据"被当成"指令"执行 |
| Prompt Template | 提示词模板 | 带变量占位符的 Prompt，用于批量处理不同输入的场景 | 字符串模板字面量（Template Literals）——结构固定，变量部分动态填充 |
| Provider | 模型提供商 | AI 模型的服务提供方（如 OpenAI、Anthropic、DeepSeek），Vercel AI SDK 通过 Provider 适配不同厂商 | 类似数据库驱动（Database Driver）——你的代码面向统一接口编程，底层切换不同的驱动实现 |
| QLoRA | 量化低秩自适应 | LoRA 的进一步优化版本，在量化（降低精度）的基础上做 Fine-tuning，大幅降低显存需求 | 在 LoRA 基础上再做一次"图片压缩"——质量损失极小，但资源消耗大幅降低 |
| RAG (Retrieval-Augmented Generation) | 检索增强生成 | 在 AI 回答前先检索相关文档，把检索结果作为参考资料放入 Prompt 的技术 | 就像你写代码时先搜 StackOverflow 再写，AI 也先"查资料"再回答——本质是开卷考试 |
| RAGAS | RAG 评估框架 | 一套用于评估 RAG 系统质量的开源框架，包含忠实度、相关性等多个维度的自动化指标 | 像 Lighthouse 之于网页性能——给你的 RAG 系统做全面的质量评分 |
| ReAct (Reasoning + Acting) | 推理与行动 | 一种 Agent 模式，让 AI 交替进行推理（Thought）和行动（Action），形成决策循环 | 类似 Redux 的 reducer 模式——先分析当前状态（Thought），再决定执行什么 action，观察新状态，循环往复 |
| Reranking | 重排序 | 对向量检索的初步结果用更精确的模型重新打分排序，提升最终检索质量 | 类似电商搜索的两阶段：先用 ElasticSearch 快速召回候选商品，再用推荐模型精排展示顺序 |
| Retrieval | 检索 | 从知识库或向量数据库中根据查询条件找出相关文档片段的过程 | 就像浏览器的 `Ctrl+Shift+F` 全项目搜索——但搜的是"语义相似"而不只是"文字匹配" |
| RLHF (Reinforcement Learning from Human Feedback) | 人类反馈强化学习 | 用人类对 AI 输出的评价来训练模型，使其行为更符合人类偏好 | 就像根据用户行为数据（点击、停留时间）来优化推荐算法——让模型的"审美"向人类靠齐 |
| Role Playing | 角色扮演 | 在 Prompt 中为 AI 设定详细的身份和性格，引导其生成特定风格的输出 | 给 React 组件传入一整套 theme props——同一个组件，不同的主题配置，渲染出不同的风格 |
| RRF (Reciprocal Rank Fusion) | 倒数排名融合 | 一种将多个检索结果列表融合为一个统一排序的算法，常用于混合检索场景 | 多个排序依据的加权合并——像电商的综合排序，同时考虑销量、评分、价格 |
| Semantic Caching | 语义缓存 | 根据查询的语义相似性（而非精确字符串匹配）来命中缓存的技术 | 类似 CDN 的智能缓存——不只匹配完全相同的 URL，还能识别"本质上是同一个请求"的变体 |
| Semantic Search | 语义搜索 | 基于文本含义（而非关键词）进行搜索的技术，通过 Embedding 向量实现 | Google 搜索 vs Ctrl+F——Google 能理解你的"意思"，Ctrl+F 只做字面匹配 |
| Serverless | 无服务器 | 不需要管理服务器的云计算模式，按调用次数计费，自动扩缩容 | Vercel 的部署模式——你只写代码，不管服务器 |
| SSE (Server-Sent Events) | 服务器推送事件 | 服务端向客户端单向推送数据流的 HTTP 协议，是 AI 流式输出的主要传输方式 | 和 WebSocket 的单向版——服务端"推"数据给客户端，用于实现打字机效果 |
| Streaming | 流式输出 | AI 模型逐个 token 生成并实时传输给客户端，而非等全部生成完毕再一次性返回 | 就像视频流播放 vs 下载完再播——用户不需要等 AI "想完"才能看到结果 |
| Structured Output | 结构化输出 | 让 AI 输出严格符合指定 Schema 的结构化数据（如 JSON），而非自由文本 | 给 AI 的输出加上 TypeScript 类型约束 + Zod 运行时校验——编译期和运行时都有保障 |
| System Prompt | 系统提示词 | 放在消息列表最前面的指令，定义 AI 的身份、行为规范和全局约束，用户通常不可见 | 应用的 `.env` 配置 / 全局配置文件——优先级高于用户输入，贯穿整个会话生命周期 |
| Temperature | 温度 | 控制 AI 输出随机性的参数，0 表示最确定（每次几乎相同），1 表示最随机（创造性高） | CSS 的 `opacity`——0 完全确定透明，1 完全随机不透明。或者说，低温度像 `as const`，高温度像 `any` |
| Token | 令牌 | LLM 处理文本的基本单位，一个 token 大约是 3/4 个英文单词或 1-2 个中文字 | 就像像素（px）是屏幕显示的基本单位，token 是 AI 理解文本的基本单位。计费也按 token 来 |
| Tool Call Loop | 工具调用循环 | AI 调用工具→执行→结果传回→AI 继续思考的多轮循环，是 Agent 运作的核心机制 | React 的 useEffect 数据获取模式——组件渲染→发现需要数据→fetch→数据回来→重新渲染 |
| Tool Use | 工具使用 | AI 通过调用外部工具（API、数据库、搜索等）来执行实际操作的能力 | 浏览器提供的 Web API（fetch、DOM、localStorage）——JS 引擎自身不能做的事，通过"工具"来完成 |
| Top-K | 前 K 个 | 向量检索中返回的最相似结果数量，K 太小可能漏掉相关内容，K 太大引入噪音 | 搜索结果分页中的 `pageSize`——一次返回多少条结果 |
| Top-P (Nucleus Sampling) | 核采样 | 另一种控制输出随机性的参数，只从累计概率达到 P 的最高概率 token 中采样 | 类似 CSS 的 `clamp()` 函数——限制在一个动态范围内取值 |
| Tracing | 追踪 | 记录 AI 系统每一步的执行过程（输入、输出、延迟、token 消耗），用于调试和优化 | 前端的 Performance API + console.trace()——追踪每一个操作的耗时和调用链路 |
| Transformer | 变换器 | 当前几乎所有 LLM 采用的神经网络架构，核心创新是自注意力（Self-Attention）机制 | 现代前端框架（React/Vue）之于网页开发——是当下最主流的"底层架构" |
| Vector Database | 向量数据库 | 专门为高维向量的存储和相似度搜索优化的数据库 | 专门为搜索优化的 ElasticSearch，但搜的不是关键词，而是"语义最相似的" |
| Vision (AI Vision) | AI 视觉 | 多模态模型理解和分析图片内容的能力，能回答关于图片的各种问题 | Chrome DevTools 的截图分析——你能看到布局、颜色、文字，AI 也能"看到"类似的信息 |
| Workflow | 工作流 | 预定义的确定性执行流程，每一步的逻辑是固定的（区别于 Agent 的自主决策） | CI/CD Pipeline——步骤是你写好的，顺序是你定的，不会自作主张 |
| Zero-shot | 零样本 | 不给任何示例，直接让模型完成任务的方式，依赖模型自身的通用能力 | 不写文档不写注释直接让新人上手——能行，但前提是他本身就很强 |
| Zod | Zod 验证库 | TypeScript 优先的 Schema 声明和运行时验证库，在 AI 开发中用于定义结构化输出的格式 | 你已经用它做表单验证了——在 AI 开发中，它变成了"AI 输出的表单验证" |

---

## 补充说明

### 关于术语的使用习惯

- **Function Calling** 和 **Tool Use** 在概念上完全等价。Function Calling 是 OpenAI 最初的叫法，Tool Use 是 Anthropic 和业界更通用的说法。Vercel AI SDK 统一使用 `tool`。
- **Prompt** 在不同语境下含义略有不同：广义的 Prompt 是整个输入（包括 system + user），狭义的 Prompt 特指 user message。本资料中根据上下文区分。
- **Agent** 和 **Chatbot** 的核心区别：Agent 能自主决策和行动（通过 Tool Use），Chatbot 只能被动对话。但在产品中，两者的界限往往是模糊的。

### 关于前端类比的局限性

前端类比是为了帮你快速建立直觉，但任何类比都不完美。当你深入学习后，请逐步建立 AI 领域自身的心智模型，而不是一直依赖前端类比。类比是入门的桥梁，不是终点。
