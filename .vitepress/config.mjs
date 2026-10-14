import { defineConfig } from 'vitepress'

// GitHub Pages 部署在 https://<user>.github.io/<repo>/ 子路径下
const base = '/ai-agent-learning/'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AI Agent 开发学习指南',
  description: '面向前端开发者的 AI Agent 开发完整学习路径',
  base,
  cleanUrls: true,
  lastUpdated: true,
  // 根目录的 README.md 不作为独立页面
  srcExclude: ['README.md'],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: 'GitHub', link: 'https://github.com/baily90/ai-agent-learning' }
    ],

    sidebar: [
      {
        text: '01 · 基础篇',
        collapsed: false,
        items: [
          { text: 'AI 与大语言模型基础', link: '/01-基础篇/01-AI与大语言模型基础' },
          { text: '开发环境搭建 & 第一次 API 调用', link: '/01-基础篇/02-开发环境搭建与第一次API调用' },
          { text: 'Prompt Engineering', link: '/01-基础篇/03-Prompt工程' },
          { text: '流式输出与前端集成', link: '/01-基础篇/04-流式输出与前端集成' },
          { text: '结构化输出', link: '/01-基础篇/05-结构化输出' },
          { text: '模型选择与多模型策略', link: '/01-基础篇/06-模型选择与多模型策略' }
        ]
      },
      {
        text: '02 · 能力篇',
        collapsed: false,
        items: [
          { text: 'Function Calling / Tool Use', link: '/02-能力篇/07-Function-Calling工具调用' },
          { text: '对话记忆与上下文管理', link: '/02-能力篇/08-对话记忆与上下文管理' },
          { text: 'RAG 基础', link: '/02-能力篇/09-RAG基础' },
          { text: 'RAG 进阶', link: '/02-能力篇/10-RAG进阶' },
          { text: '多模态能力', link: '/02-能力篇/11-多模态能力' }
        ]
      },
      {
        text: '03 · Agent 篇',
        collapsed: false,
        items: [
          { text: 'Agent 核心模式', link: '/03-Agent篇/12-Agent核心模式' },
          { text: 'Multi-step Agent', link: '/03-Agent篇/13-Multi-step-Agent' },
          { text: 'MCP 协议', link: '/03-Agent篇/14-MCP协议' },
          { text: 'Multi-Agent 协作', link: '/03-Agent篇/15-Multi-Agent协作' },
          { text: 'Workflow vs Agent', link: '/03-Agent篇/16-Workflow与Agent' }
        ]
      },
      {
        text: '04 · 体验篇',
        collapsed: false,
        items: [
          { text: 'Agent UI/UX 设计模式', link: '/04-体验篇/17-Agent-UI-UX设计' },
          { text: '生成式 UI', link: '/04-体验篇/18-生成式UI与流式渲染' },
          { text: '错误处理与容错', link: '/04-体验篇/19-错误处理与容错' }
        ]
      },
      {
        text: '05 · 生产篇',
        collapsed: false,
        items: [
          { text: '安全与防护', link: '/05-生产篇/20-安全与防护' },
          { text: '评估与测试', link: '/05-生产篇/21-评估与测试' },
          { text: '可观测性与调试', link: '/05-生产篇/22-可观测性与调试' },
          { text: '性能优化与成本控制', link: '/05-生产篇/23-性能优化与成本控制' },
          { text: '部署与架构', link: '/05-生产篇/24-部署与架构' }
        ]
      },
      {
        text: '附录',
        collapsed: false,
        items: [
          { text: 'A · 术语表', link: '/附录/A-术语表' },
          { text: 'B · Fine-tuning 概览', link: '/附录/B-微调概览' },
          { text: 'C · 主流框架横向对比', link: '/附录/C-框架对比' },
          { text: 'D · 推荐资源与社区', link: '/附录/D-推荐资源' }
        ]
      }
    ],

    outline: {
      label: '本页目录',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一章',
      next: '下一章'
    },

    lastUpdated: {
      text: '最后更新'
    },

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/baily90/ai-agent-learning' }
    ]
  }
})
