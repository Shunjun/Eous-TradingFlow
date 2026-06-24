# Eous 总览与现状

## 产品定位

Eous TradingFlow 是低代码交易分析平台：用户通过可视化节点编排，把数据源、技术处理、LLM 分析、Agent 记忆和输出视图连接成可运行的分析流程。

当前阶段聚焦交易分析、预测和研究流程编排：

- 数据源配置和标的数据读取。
- 可复用 K 线视图、工作区布局和 Workflow 画布。
- 节点化执行，包括 source、trigger、control、LLM 节点。
- Agent 对话、Session、Memory 与 LLM 流式回复。

回测、通知、自动化执行、交易下单等能力不排除在产品边界之外；它们更适合在基础分析链路稳定后，以 Workflow 节点、Agent 工具或外部集成的方式逐步加入。

## 核心边界

### 数据源、视图、运行时解耦

同一个 DataSourceInstance 可被视图层和运行时层同时消费：

```text
Data Source Layer
  ├─ View Layer      KlineChart、Watchlist、Workspace panel
  └─ Runtime Layer   Workflow Runner、Source 节点、LLM 上下文
```

视图组件只负责展示和交互；Workflow 节点负责计算、取数、推理和输出；二者通过 API 与共享 DTO 连接。

### LLM 是节点，也是 Agent runtime 的能力

LLM 在 Workflow 中是普通节点：`llm.free`、`llm.signal`、`llm.report`。LLM 也被 Agent 服务用于对话流式回复和 Memory 注入。两者共用 server 端 LLM service。

### Agent 是独立实体

Agent 不等同于 Workflow Node。当前已经有独立的 Agent、Session、Message、Summary、Memory 数据模型和页面。Agent 可拥有 Provider/Model/System Prompt 配置，也可在 LLM 节点中作为 Memory 来源。

后续目标是让 Agent 调用工具查看 K 线、搜索新闻、运行/编辑 Workflow。

### Workspace 是容器，不是业务逻辑

当前工作区实现使用 Dockview。Workspace panel 负责装载视图，例如 K 线视图和 Workflow 视图；具体业务状态由各视图和 store 管理。

## 当前模块

| 模块        | 当前状态                                                                          |
| ----------- | --------------------------------------------------------------------------------- |
| Auth        | 已实现注册/登录/登出/me，认证态路由由 loader 保护                                 |
| Provider    | 已实现 LLM Provider CRUD、API Key 加密、model 管理、测试/同步                     |
| Data Source | 已实现 DataSourceProvider 接口、Yahoo Finance、CCXT、实例配置、标的搜索、K 线读取 |
| Chart       | 已实现 `@eous/chart`，支持 K 线、指标、画线、周期设置、绘图保存                   |
| Workspace   | 已实现 Dockview 工作区、布局保存、多 layout、Kline/Workflow panel                 |
| Workflow    | 已实现列表、创建、编辑器、局部 patch、版本、节点执行、全图执行、变量缓存          |
| Nodes       | 已实现 trigger、source、control.branch、llm.\* 节点注册和执行                     |
| Agent       | 已实现 Agent/Session/Message/Memory、SSE 流式对话、手动 Memory 管理               |
| Realtime    | 已有 market data socket；Workflow 执行事件推送仍待增强                            |

## 重要实现事实

- 当前没有 `packages/types`、`api-client-http`、`api-client-electron`、`apps/desktop` 独立包。共享 DTO 和 HTTP client 在 `packages/api-client`。
- 当前工作区不是 `react-mosaic`，而是 `dockview`。
- 当前 LLM 接入不是 Vercel AI SDK，而是 `@earendil-works/pi-ai`。
- 当前 Workflow definition 仍以 JSON 字符串存储在 `workflows.definition`，节点和边暂不拆表。
- 当前节点执行记录按节点写入 `workflow_node_executions`，全图执行返回聚合结果，但没有独立 workflow execution 表。
- 当前 Agent 工具调用、MCP tools、Agent 分屏视图还未落地。
