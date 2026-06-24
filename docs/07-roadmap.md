# 路线图

状态按当前仓库实现校准。若旧文档和代码不一致，以代码为准。

## 状态图例

| 状态     | 含义                               |
| -------- | ---------------------------------- |
| 已完成   | 主路径已落地，可继续迭代完善       |
| 部分完成 | 有可用实现，但仍缺关键能力         |
| 未开始   | 当前仓库没有主体实现               |
| 规划中   | 已有设计或方向，但还未进入稳定实现 |

## P0 - 架构骨架

状态：已完成

- Monorepo：pnpm workspaces + Turborepo。
- 应用：`apps/web`、`apps/server`、`apps/docs`。
- 包：`api-client`、`db`、`data-sources`、`nodes`、`chart`、`ui`、`tailwind`、`stores`。
- TypeScript、Vite、Hono、Prisma、SQLite 基础链路已可用。

说明：旧文档中的 `packages/types`、`api-client-http`、`api-client-electron`、`apps/desktop` 当前不存在，不再记为已完成。

## P1 - 基础设施

状态：已完成 / 部分完成

已完成：

- 用户注册、登录、登出、`me`。
- Cookie/Session 认证。
- LLM Provider CRUD。
- API Key AES 加密存储。
- Provider model 管理、测试、同步。
- Settings 页面入口。
- Data Source Provider 配置入口。

待完善：

- 通用系统设置，如语言、时区、默认模型策略。
- Provider 级成本字段覆盖和成本展示。

## P2 - 数据源层

状态：部分完成

已完成：

- `DataSourceProvider` 抽象。
- DataSourceInstance 配置、测试、删除。
- 标的搜索和 tracked symbols。
- Yahoo Finance Provider。
- CCXT Provider。
- K 线和 Quote 基础读取。
- 周期支持查询和派生周期能力。
- Market data socket 基础设施。

待完善：

- 新闻 Provider。
- 历史数据缓存层。
- 更完整的实时 quote/kline 订阅体验。
- 更多数据源，如东方财富、同花顺、Polygon、Wind、Bloomberg。

## P3 - 共享视图组件

状态：部分完成

已完成：

- `@eous/chart` K 线组件。
- 技术指标系统。
- 画线工具。
- Workspace Kline view。
- 图表画线保存和用户图表配置。

待完善：

- 新闻列表视图。
- Markdown 报告视图。
- 通用数据表格视图。
- 多标的同屏对比。
- 回测/绩效/资金流视图。

## P4 - Workflow 引擎

状态：部分完成

已完成：

- `@eous/nodes` 节点注册表。
- trigger/source/control/LLM 节点。
- Node executor 接口。
- Workflow Runner。
- 拓扑排序、变量解析、branch 跳过。
- 节点执行记录持久化。
- 单节点运行、全图执行、变量缓存。
- LLM 节点接入 pi-ai。

待完善：

- 分层并行和限流。
- 独立 workflow execution 表。
- 执行状态实时推送到前端。
- compute 节点。
- output 节点。
- 失败处理策略配置。
- 定时调度器生产化。

## P5 - Workflow 编辑器

状态：部分完成

已完成：

- React Flow 画布。
- 节点选择器。
- 自定义节点渲染。
- 连线、配置面板、变量面板。
- Workflow CRUD。
- 局部 patch API。
- Patch-based history、undo/redo。
- 保存冲突对话框基础能力。
- 执行历史和节点输出查看。

待完善：

- 前端完整接入局部编辑 API 的所有路径。
- 更明确的冲突合并体验。
- 模板变量输入提示继续增强。
- 从节点重跑下游。
- Workflow 模板/复制/导入导出。

## P6 - 工作区

状态：已完成 / 部分完成

已完成：

- Dockview 工作区。
- 多 layout。
- 布局持久化。
- Kline 和 Workflow panel。
- Sidebar 直出 Workflow 列表。

待完善：

- 面板间事件通信。
- 更多 panel 类型。
- Agent 视图面板接入。
- layout 冲突或远端保存失败体验。

## P7 - Agent 对话

状态：部分完成

已完成：

- Agent、Session、Message、Summary、Memory 数据表。
- Agent CRUD 和配置。
- Session 列表/读取/创建。
- SSE 流式对话。
- 页面三栏布局。
- 手动 Memory 管理。
- LLM 节点可注入 Agent Memory。

待完善：

- Tool calling。
- Agent 分屏打开视图。
- 搜索新闻、查看 K 线、运行 Workflow 工具。
- `agent.call` 节点。
- Agent 设计/编辑 Workflow，包括 MCP tools 接入 `WorkflowEditService`。
- 工具权限、用户确认和审计。
- 对话 abort、token/cost 统计。
- 更强的 Memory 摘要与检索。

## P8 - 标的管理

状态：部分完成

已完成：

- Watchlist 页面入口。
- DataSourceInstance 下 tracked symbols。
- Kline view 可选标的。

待完善：

- 独立标的详情页。
- 价格提醒。
- 自定义字段和分组。
- 标的关联关系图谱。
