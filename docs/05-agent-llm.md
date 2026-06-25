# Agent 与 LLM

## LLM 服务

LLM service 位于 `apps/server/src/services/llm/llm.service.ts`，基于 `@earendil-works/pi-ai`。

当前支持：

- 从用户 Provider 解密 API Key。
- 将 `Provider.kind` 映射为 pi-ai provider。
- 使用 Provider `baseUrl` 支持 custom / Ollama 兼容 OpenAI API 的场景。
- `streamChat()` 返回异步事件流。
- Agent Memory 可追加到 system prompt，并明确作为上下文而非高优先级指令。
- `parseJsonWithTolerance()` 对 LLM JSON 输出做容错解析。

当前 `Provider.kind` 映射：

```ts
openai -> openai
anthropic -> anthropic
deepseek -> deepseek
ollama -> openai
custom -> openai
```

## Agent Runtime 目标架构

后续 Agent runtime 使用 Mastra，但 Mastra 只负责运行时能力，不接管 Eous 的产品数据模型。

职责边界：

| 领域                | 所属方           | 说明                                                   |
| ------------------- | ---------------- | ------------------------------------------------------ |
| Agent runtime       | Mastra           | Agent 执行、模型调用、tool/MCP 调度抽象                |
| Model provider 调用 | Mastra           | 替换当前 `@earendil-works/pi-ai` 的 provider 调用层    |
| Eous Workflow       | Eous             | 继续使用现有 React Flow definition、runner、执行记录   |
| Agent 配置          | Eous DB          | `agents.instructions/providerId/modelId/toolScope`     |
| Session/Message     | Eous DB          | `agent_sessions`、`agent_messages` 是唯一事实源        |
| Memory/Experience   | Eous DB          | 自动提取、手动维护、设置页查看与启停                   |
| Knowledge Base      | Eous DB + Vector | 文档、片段、embedding、检索结果由 Eous 管理            |
| Skills/MCP 配置     | Eous DB          | 用户可安装 Skills、启用/禁用 MCP server/tool           |
| Chat UI             | Eous Web         | Markdown、tool call block、tool result block、MCP view |

Mastra Workflow 不接入。Eous Workflow 是产品核心编排层，Mastra 不能成为第二套 workflow runtime。

运行链路：

```text
Chat / Agent API
  -> Eous Agent Service
    -> Eous DB: agents / sessions / messages / memories / experiences / knowledge
    -> Prompt assembly: instructions + retrieved context + session summary
    -> Mastra Agent runtime
      -> model provider
      -> enabled tools / MCP / skills
    -> Eous DB: assistant message + tool events + extracted memory/experience + title/summary
    -> SSE: session/text_delta/tool_call/tool_result/session_updated/done
```

数据库方向：

- 当前 SQLite 适合早期本地开发，但不适合作为长期 Memory、Experience 和 Knowledge Base 的最终存储。
- 最终建议切换 PostgreSQL，并启用 pgvector 或兼容向量扩展。
- 第一阶段先保持现有 SQLite，补齐 runtime 抽象、数据模型和 UI；切库作为单独迁移批次执行。
- 向量检索接口先抽象为 Eous-owned retrieval service，避免被 Mastra storage 绑定。

Memory / Experience：

- Memory：用户偏好、长期事实、固定上下文。
- Experience：复盘结论、有效方法、失败案例、可复用分析规则。
- Chat 页面不直接展示 Memory / Experience 管理入口，只无感使用检索结果。
- Settings 的 Agent 页面负责查看、编辑、启用/禁用 Memory、Experience、Skills 和 MCP。

Skills / MCP：

- Skill 是可安装、可版本化的能力包，属于用户空间配置。
- MCP server/tool 可由用户定义并自行启动，Eous 保存连接配置、权限和启用状态。
- 项目内置能力可先作为内置 MCP tools 暴露，例如 Workflow 查询、编辑、运行相关工具。

Chat 渲染：

- Assistant 文本至少支持 Markdown。
- Tool/MCP 调用必须作为结构化 tool block 渲染，而不是混入普通文本。
- Agent View 右侧面板用于承载 tool/MCP 打开的 workflow、iframe、图表、报告等 view。

## Workflow LLM 节点

当前 LLM 节点在 `packages/nodes/src/nodes`：

| 节点         | 输出                                | 说明                        |
| ------------ | ----------------------------------- | --------------------------- |
| `llm.free`   | `content`                           | 自由文本生成                |
| `llm.signal` | `signal`、`confidence`、`reasoning` | 交易信号 JSON，使用容错解析 |
| `llm.report` | `report`                            | Markdown 报告               |

三个节点都支持：

- `providerId`
- `modelId`
- `systemPrompt`
- `userPrompt`
- `temperature`
- `maxTokens`
- 可选注入 Agent Memory：`injectMemory`、`memoryAgentId`、`memoryQuery`

## Agent 数据模型

Agent 相关表：

| 表                | 说明                                                     |
| ----------------- | -------------------------------------------------------- |
| `agents`          | Agent 配置，包括名称、描述、instructions、provider/model |
| `agent_sessions`  | 对话 Session，可关联 workflow                            |
| `agent_messages`  | 用户/助手/系统/tool 消息                                 |
| `agent_summaries` | 长对话摘要                                               |
| `agent_memories`  | 长期记忆                                                 |

`AgentMemory` 当前字段包括：

- `scope`
- `targetId`
- `kind`
- `content`
- `tags`
- `importance`
- `confidence`

## Agent 服务

核心文件：

- `apps/server/src/routes/agent.ts`
- `apps/server/src/services/agent.service.ts`
- `apps/server/src/repositories/agent.repo.ts`
- `apps/web/src/hooks/use-agent-stream.ts`
- `apps/web/src/pages/(auth)/agents/page.tsx`

当前能力：

- 自动创建默认 `Eous Analyst`。
- Agent CRUD：创建、更新、列表。
- Session CRUD：创建、列表、读取消息。
- Message 持久化。
- SSE 流式对话：`session`、`text_delta`、`error`、`done`。
- 近期消息窗口。
- 超过阈值后生成 fallback summary 并写入 `agent_summaries`。
- Memory 列表、手动新增、按 query/agent/session 检索。
- Agent 页面当前仍临时展示 Agent 设置；后续会迁移到 Settings。

## 当前页面能力

`/agents` 页面已有三栏：

- 左侧：Agent 列表和 Session 列表。
- 中间：对话消息流和输入框。
- 右侧：Agent 设置、Session summary、Memory 新增与列表。

当前消息渲染是纯文本 `white-space: pre-wrap`，不是完整 Markdown 渲染。

## Agent 设置与模板化方向

Agent 的创建和配置应从 `/agents` 对话页迁移到 Settings。对话页只负责选择 Agent、选择 Session、发送消息和查看结果；Agent 的生命周期管理、默认模型、模板初始化和长期配置统一放在设置页。

目标页面：

```text
/settings/agents
  - Agent 列表
  - New Agent from Template
  - Agent instructions 编辑
  - 默认 Provider / Model
  - Memory / Experience 管理入口
  - Tool Scope 预留
```

### Agent Instructions

前端不再把 Agent 的核心设定称为 `System Prompt`。虽然运行时最终仍会渲染成 system prompt，但产品概念应是 Agent instructions：一段类似角色说明文档的多行文本配置。它不需要对应真实文件，也不要求使用 Markdown 编辑器；第一版使用普通多行文本编辑即可。

建议结构：

```md
# 简介

说明这个 Agent 的身份、职责和领域边界。

# 能力范围

列出这个 Agent 擅长处理的问题和不负责的问题。

# 工作方式

说明分析步骤、输出格式、工具使用原则和需要追问的情况。

# Memory

长期记忆入口，保存用户偏好、固定上下文和长期关注事项。

# Experience

经验入口，保存历史复盘、有效方法、失败案例和已验证规则。

# Tool Scope

声明允许使用的工具组和禁止使用的工具组。

# Constraints

风险约束、合规提醒、禁止确定性收益承诺、数据不足时的处理方式。
```

数据库字段使用 `agents.instructions`，不再保留 `systemPrompt` 作为 API 字段。历史 `system_prompt` 列通过迁移转为 `instructions` 后删除。

运行时 prompt 渲染应由后端统一完成：

```text
Agent instructions
  + retrieved AgentMemory
  + retrieved Agent Experience
  + session summary
  + current tool scope
  -> final system prompt
```

Memory 和 Experience 不应被当作高优先级指令。它们是上下文和历史经验，优先级低于系统约束和用户当前请求。

### Agent 模板

Agent 模板用于创建起始 Agent。用户选择模板后自动填充 instructions、默认名称、描述、建议工具范围和默认模型配置，之后可以自由修改。

模板不作为 Agent 的持久身份保存。创建 Agent 时选择模板，只是把模板内容写入 `instructions`。如果后续支持切换模板，切换动作会覆盖当前已编辑的 instructions，并把覆盖后的内容保存到数据库。

第一批建议模板：

| 模板                       | 说明                                             |
| -------------------------- | ------------------------------------------------ |
| `Blank Agent`              | 空白 Agent，只提供基础结构                       |
| `Technical Analyst`        | 技术指标、趋势、支撑阻力、量价关系               |
| `Fundamental Analyst`      | 财务、估值、成长性、公司质量                     |
| `Capital Flow Analyst`     | 主力资金、资金流向、板块资金、量价背离           |
| `News & Sentiment Analyst` | 新闻事件、公告、舆情、短中长期影响               |
| `Risk Manager`             | 解禁、减持、监管、财务异常、仓位和止损风险       |
| `Sector Rotation Analyst`  | 板块强弱、热点持续性、行业景气度、板块资金轮动   |
| `Chief Analyst`            | 汇总多个分析结论，形成综合判断、风险点和观察条件 |
| `Workflow Architect`       | 设计、解释和修改 TradingFlow Workflow            |

模板来源是产品化借鉴，不直接照搬外部项目：

- TradingAgents：适合作为多 Agent 分工和流程参考，例如 analyst、researcher、trader、risk、portfolio manager。
- `oficcejo/aiagents-stock`：适合作为中文股票分析角色模板参考，例如技术面、基本面、资金面、新闻、宏观、板块和风险角色。
- `ArvinLovegood/go-stock`：适合作为股票 AI 产品机制参考，例如提示词模板管理、工具分组、复杂任务模式和技能注入。

### Provider / Model

每个 Agent 应在 Settings 中设置默认 Provider 和 Model。对话页不负责编辑这些配置，只展示当前 Agent 使用的模型。

后续可以支持：

- Agent 默认模型。
- Quick / Deep 两档模型。
- 简单问答使用 quick model。
- 复杂分析、workflow 修改、综合决策使用 deep model。

### Tool Scope 与 MCP 工具方向

Agent 应通过 Tool Scope 控制可用工具，而不是所有 Agent 默认拥有全部工具。Tool Scope 可以先作为 instructions 中的声明和数据库预留字段，后续接入真正 tool calling / MCP runtime。

建议工具域：

| 工具域               | 示例能力                                             |
| -------------------- | ---------------------------------------------------- |
| `market_data`        | quote、kline、intraday、index quote                  |
| `technical_analysis` | MA、MACD、RSI、趋势总结、支撑阻力                    |
| `fundamental_data`   | 财务摘要、估值指标、股东信息、盈利预测、研报         |
| `capital_flow`       | 主力资金、板块资金、北向资金、融资融券、量价背离     |
| `news_research`      | 公司新闻、公告、财经日历、热点事件、事件影响总结     |
| `sector_analysis`    | 板块排行、板块成分、板块轮动、强弱对比               |
| `screening`          | 指标选股、资金流选股、板块选股、自然语言筛选         |
| `risk`               | 解禁、减持、监管处罚、退市/ST 风险、组合风险         |
| `workflow`           | 读取、创建、局部编辑、校验、运行 Workflow 或单个节点 |

不同模板的默认工具范围示例：

| Agent 模板                 | 默认工具范围                                     |
| -------------------------- | ------------------------------------------------ |
| `Technical Analyst`        | `market_data`、`technical_analysis`              |
| `Fundamental Analyst`      | `fundamental_data`、`news_research`              |
| `Capital Flow Analyst`     | `capital_flow`、`sector_analysis`、`market_data` |
| `News & Sentiment Analyst` | `news_research`、`market_data`                   |
| `Risk Manager`             | `risk`、`fundamental_data`、`capital_flow`       |
| `Sector Rotation Analyst`  | `sector_analysis`、`capital_flow`、`market_data` |
| `Workflow Architect`       | `workflow`                                       |

第一批真实工具建议优先做：

1. `workflow` 工具：复用 `WorkflowEditService`，包括 read、apply ops、run node。
2. `market_data` 工具：复用现有 data source / kline / quote 能力。
3. `news_research` 工具：复用已有 news API 能力。
4. 后续再接资金流、板块、公告、财务等更依赖外部数据源的工具。

## Agent 编辑 Workflow / MCP 工具

Agent 编辑 Workflow 是 Agent 工具能力的一部分，不单独作为产品线维护。目标是让 Agent 通过受控工具创建、读取、修改和运行 Workflow，而不是直接输出整份 JSON 或绕过后端校验。

当前已具备的基础：

- Workflow 仍以 `workflows.definition` JSON 存储，暂不拆节点/边表。
- `WorkflowEditService` 已提供局部编辑入口。
- `PATCH /api/workflows/:id` 已接入 `WorkflowEditOp[]`。
- `WorkflowEditOp` 已覆盖 rename、node add/update/delete、edge add/update/delete、insertBetween。
- 服务端校验 node type、edge 合法性、DAG 环、locked node、乐观并发冲突。

待实现的 Agent/MCP tools 应复用同一个 service 层，不直接改数据库，也不通过本机 HTTP 绕一圈：

```text
Agent tool / MCP tool
  -> workflow-edit.service.ts
  -> workflow.repo.ts
  -> prisma.workflow
```

建议工具分组：

| 工具                           | 说明                              |
| ------------------------------ | --------------------------------- |
| `workflow_list`                | 列出用户 Workflow                 |
| `workflow_get`                 | 获取 Workflow definition          |
| `workflow_create`              | 创建 Workflow，可带初始节点和边   |
| `workflow_rename`              | 修改名称和描述                    |
| `workflow_validate`            | 校验结构、节点配置和 DAG          |
| `workflow_run`                 | 运行 Workflow                     |
| `workflow_add_node`            | 添加节点，server 生成默认 data/id |
| `workflow_update_node`         | 修改节点 data、position、meta     |
| `workflow_delete_node`         | 删除节点并自动删除相关边          |
| `workflow_insert_node_between` | 在已有 edge 中插入节点            |
| `workflow_connect_nodes`       | 添加连线                          |
| `workflow_update_edge`         | 修改连线                          |
| `workflow_delete_edge`         | 删除连线                          |

工具约束：

- 写工具必须经过用户授权或清晰的 UI 确认。
- 不暴露“直接覆盖整份 definition”的工具给 Agent。
- 写操作必须支持 `baseUpdatedAt`，避免覆盖用户刚刚做的编辑。
- 后续需要审计日志记录 Agent 修改了哪些节点和边。

## 待实现

Agent 相关后续需求统一放入路线图和 Backlog，当前优先级较高的是：

- 将 Agent 创建和配置从 `/agents` 迁移到 `/settings/agents`。
- 将 UI 概念从 `System Prompt` 调整为 Agent instructions / Agent Profile。
- 增加 Agent Template，并支持选择模板后自动填充 instructions。
- 对话页移除 Agent 创建和设置表单，只保留 Agent/Session 选择和聊天能力。
- Provider / Model 改为在 Settings 中配置，聊天页只展示当前模型。
- Tool calling：查看 K 线、搜索新闻、运行 Workflow、读关注列表。
- Agent 分屏视图：对话右侧打开 Kline/News/Workflow 结果。
- `agent.call` Workflow 节点。
- Agent 编辑 Workflow 的 MCP tools。
- 更正式的 Memory 摘要、检索和遗忘机制。
- 对话停止/abort 与 token/cost 统计。
