# Eous

低代码的交易标的分析平台。通过可视化节点编排来定义 Agent 的分析与决策执行逻辑，让数据获取、处理、LLM 分析、信号生成的整条链路变得可见、可干预、可复用。

Eous 不是交易终端，也不是量化回测框架。它是一张画布——你把数据源、计算逻辑、LLM 推理、输出展示像搭积木一样连起来，一键运行，全程透明。

## 文档

| 文档 | 内容 |
|------|------|
| [01 - 产品定位与架构总览](./docs/01-overview.md) | 定位、分层架构、模块划分、设计决策 |
| [02 - 技术架构](./docs/02-architecture.md) | 技术选型、目录结构、数据模型、通信机制 |
| [03 - 核心接口定义](./docs/03-core-interfaces.md) | TypeScript 接口：工作流、节点、执行引擎、Provider |
| [04 - 节点系统设计](./docs/04-node-system.md) | 节点类型、生命周期、调度策略、数据传递 |
| [05 - LLM 集成方案](./docs/05-llm-integration.md) | LLM 节点的 Prompt 工程、多模型、流式输出 |
| [06 - 参考项目分析](./docs/06-reference-projects.md) | GitHub 同类项目调研与差异化分析 |
| [07 - 实现路线图](./docs/07-roadmap.md) | 按依赖关系分阶段的功能点（57 项） |
| [08 - 功能待办](./docs/08-backlog.md) | V1 之后的跟进功能清单 |

## 技术栈

```
前端:    Vite + React 19 + TypeScript + React Flow + react-mosaic
后端:    Hono + Node.js + TypeScript
数据库:  SQLite（Prisma ORM，零安装，CS 与 Electron 统一）
UI:      Tailwind CSS v4 + shadcn/ui（packages/tailwind + packages/ui）
AI:      Vercel AI SDK（OpenAI / Anthropic / DeepSeek / Ollama）
桌面:    Electron（可选，不替代 CS 架构）
工程:    Turborepo + pnpm workspaces
```

## 架构分层

```
Application Shell（导航、路由）
├── Modules（标的详情、工作台、Agent 对话...）
│     │
├── View Layer（K线图、新闻列表、报告渲染...共享视图组件）
│     │
├── Runtime Layer（Workflow 引擎、LLM 执行器、Agent 运行时）
│     │
├── Data Source Layer（行情、新闻、链上数据...Provider 抽象）
│     │
└── Infrastructure（Provider 配置、API Key 管理、认证、设置）
```

**通信层抽象**：`@eous/api-client` 定义接口，`api-client-http` 和 `api-client-electron` 分别实现 CS 和桌面模式，前端代码只依赖接口不依赖实现。

## 当前状态

P0 架构骨架已完成，包含类型定义、数据库、通信层、UI 组件库。
下一阶段：P1 基础设施（认证、Provider 配置）。
