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

| 表                | 说明                                                      |
| ----------------- | --------------------------------------------------------- |
| `agents`          | Agent 配置，包括名称、描述、system prompt、provider/model |
| `agent_sessions`  | 对话 Session，可关联 workflow                             |
| `agent_messages`  | 用户/助手/系统/tool 消息                                  |
| `agent_summaries` | 长对话摘要                                                |
| `agent_memories`  | 长期记忆                                                  |

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
- Agent 页面可配置 Agent 的 Provider、Model、System Prompt。

## 当前页面能力

`/agents` 页面已有三栏：

- 左侧：Agent 列表和 Session 列表。
- 中间：对话消息流和输入框。
- 右侧：Agent 设置、Session summary、Memory 新增与列表。

当前消息渲染是纯文本 `white-space: pre-wrap`，不是完整 Markdown 渲染。

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

- Tool calling：查看 K 线、搜索新闻、运行 Workflow、读关注列表。
- Agent 分屏视图：对话右侧打开 Kline/News/Workflow 结果。
- `agent.call` Workflow 节点。
- Agent 编辑 Workflow 的 MCP tools。
- 更正式的 Memory 摘要、检索和遗忘机制。
- 对话停止/abort 与 token/cost 统计。
