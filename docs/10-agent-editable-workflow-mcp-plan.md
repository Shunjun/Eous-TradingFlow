# Agent 可编辑 Workflow 与 MCP 工具设计方案

> 状态：设计确认，待实施
> 关联：`docs/04-node-system.md`、`docs/09-p7-agent-impl-plan.md`

## 1. 背景与目标

当前 Workflow 以整份 `definition` JSON 存储：

```ts
{
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
```

前端保存时通过 `PUT /api/workflows/:id` 整体提交。这个模型适合普通编辑器保存，但不适合作为 Agent/MCP 的编辑边界：Agent 修改一个节点也需要读写整份 JSON，容易覆盖用户或其他 Agent 的并发修改，也难以做精细校验、权限控制、审计和工具级约束。

目标是让 Agent 可以安全地编辑 Workflow，包括：

- 创建新的 Workflow
- 添加节点
- 修改节点配置、位置、元信息
- 删除节点
- 添加、修改、删除连线
- 插入节点到已有连线中
- 校验 Workflow
- 运行整个 Workflow 或单个节点

## 2. 核心决策

### 2.1 短期不拆节点/连线表

短期仍保留 `workflows.definition` 作为 Workflow 的主存储，不新增 `workflow_nodes` / `workflow_edges` 表。

原因：

- 当前 runner、version、前端 editor 都以 `{ nodes, edges }` 为主要结构
- 局部编辑可以在 server 里通过 patch service 安全完成
- 避免一次性重写执行器、发布版本、前端 store 和 API client
- 当前规模尚未要求节点级查询、节点级权限或实时多人协作

后续满足以下条件时再考虑拆表：

- 多用户或多 Agent 高频协作编辑
- 需要逐节点审计、权限、检索
- Workflow 规模达到数百/上千节点
- 需要 CRDT/OT 级实时协作

### 2.2 新增 WorkflowEditService 作为唯一编辑入口

新增 `workflow-edit.service.ts`，集中处理所有局部编辑：

- 读取当前 definition
- 解析并迁移 schema
- 校验 ops
- 应用 ops
- 检查 DAG 环、重复 id、节点类型、连线合法性
- 写回 definition

HTTP API 和 MCP tools 都调用同一个 service，不各自实现编辑逻辑。

### 2.3 MCP 不直接改数据库，也不绕 HTTP

Agent 运行在 server 端，MCP tools 应直接调用 service 层，而不是通过 HTTP 请求本机 API，也不能直接改 Prisma 表。

推荐调用链：

```txt
MCP tool
  -> workflow-edit.service.ts
  -> workflow.repo.ts
  -> prisma.workflow

HTTP route
  -> workflow-edit.service.ts
  -> workflow.repo.ts
  -> prisma.workflow
```

这样可以保证：

- 前端 API 和 Agent 工具共享同一套校验
- 不重复鉴权、序列化、错误处理
- 不给 Agent 暴露整份 JSON 覆盖能力

## 3. Definition Schema

将 definition 标准化为版本化结构：

```ts
interface WorkflowDefinitionDocument {
  schemaVersion: 1
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}
```

兼容旧格式：

```ts
{
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
```

解析时如果没有 `schemaVersion`，按 v1 处理并在下次保存时补齐。

### 3.1 Node

```ts
interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  meta?: {
    locked?: boolean
    createdBy?: 'user' | 'agent'
    updatedBy?: string
  }
}
```

说明：

- `type` 必须存在于 `@eous/nodes/server` registry
- `data` 应尽量只包含该节点 `executeInput` 定义的字段，以及 UI 需要的 `label`、`color`、`status`
- `locked` 节点默认禁止 Agent 修改，除非 tool 明确传 `force`

### 3.2 Edge

```ts
interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}
```

规则：

- `source` / `target` 必须引用存在的 node
- 删除 node 时自动删除相关 edge
- 添加或修改 edge 后必须检测 DAG 是否成环

## 4. Edit Ops

局部编辑使用 operation list。一次请求可以提交多个 op，并作为一个原子变更处理：任意 op 校验失败，整批不写回。

```ts
type WorkflowEditOp =
  | { type: 'workflow.rename'; name: string; description?: string }
  | { type: 'node.add'; node: WorkflowNode }
  | {
      type: 'node.update'
      nodeId: string
      dataPatch?: Record<string, unknown>
      position?: { x: number; y: number }
      metaPatch?: Record<string, unknown>
    }
  | { type: 'node.delete'; nodeId: string }
  | { type: 'edge.add'; edge: WorkflowEdge }
  | { type: 'edge.update'; edgeId: string; patch: Partial<WorkflowEdge> }
  | { type: 'edge.delete'; edgeId: string }
  | {
      type: 'node.insertBetween'
      edgeId: string
      node: WorkflowNode
      sourceToNewEdge?: Partial<WorkflowEdge>
      newToTargetEdge?: Partial<WorkflowEdge>
    }
```

请求形态：

```ts
interface ApplyWorkflowOpsRequest {
  baseUpdatedAt?: string
  ops: WorkflowEditOp[]
}
```

`baseUpdatedAt` 用于乐观并发控制。如果请求携带的时间和数据库当前 `updatedAt` 不一致，默认返回 conflict，避免覆盖用户刚刚做的编辑。

## 5. HTTP API

保留现有全量接口：

```http
PUT /api/workflows/:id
```

新增局部编辑接口：

```http
PATCH /api/workflows/:id
```

请求：

```json
{
  "baseUpdatedAt": "2026-06-23T06:00:00.000Z",
  "ops": [
    {
      "type": "node.update",
      "nodeId": "source.kline-1",
      "dataPatch": { "symbol": "AAPL" }
    }
  ]
}
```

响应：

```ts
{
  workflow: Workflow
  appliedOps: number
  warnings: string[]
}
```

## 6. MCP 工具设计

MCP tools 不暴露“写整份 JSON”的能力，只暴露结构化工具。

### 6.1 Workflow 级工具

| Tool                | 说明                                  |
| ------------------- | ------------------------------------- |
| `workflow_create`   | 创建新的 workflow，可带初始节点和连线 |
| `workflow_get`      | 获取 workflow definition              |
| `workflow_list`     | 列出用户 workflow                     |
| `workflow_rename`   | 修改 workflow 名称和描述              |
| `workflow_validate` | 校验 workflow 结构、节点配置和 DAG    |
| `workflow_run`      | 运行整个 workflow                     |

`workflow_create` 参数建议：

```ts
interface WorkflowCreateToolInput {
  name: string
  description?: string
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
}
```

### 6.2 Node 工具

| Tool                           | 说明                                |
| ------------------------------ | ----------------------------------- |
| `workflow_list_nodes`          | 列出节点摘要                        |
| `workflow_add_node`            | 添加节点，server 生成默认 data / id |
| `workflow_update_node`         | 修改节点 data、position、meta       |
| `workflow_delete_node`         | 删除节点并自动删除相关连线          |
| `workflow_insert_node_between` | 在已有 edge 中插入节点              |
| `workflow_run_node`            | 运行单个节点                        |

`workflow_add_node` 不要求 Agent 自己拼完整 React Flow node：

```ts
interface WorkflowAddNodeToolInput {
  workflowId: string
  type: string
  data?: Record<string, unknown>
  position?: { x: number; y: number }
  connectFrom?: string
  connectTo?: string
}
```

### 6.3 Edge 工具

| Tool                     | 说明                   |
| ------------------------ | ---------------------- |
| `workflow_connect_nodes` | 添加连线               |
| `workflow_update_edge`   | 修改连线 handle 等信息 |
| `workflow_delete_edge`   | 删除连线               |

## 7. Server 校验规则

WorkflowEditService 至少包含以下校验：

- workflow 存在且属于 user
- node type 存在于 registry
- node id / edge id 不重复
- edge source / target 节点存在
- 删除节点时同步删除关联 edge
- 添加或修改 edge 后保持 DAG 无环
- `dataPatch` 字段应符合 node def 的 `executeInput`
- locked node 默认禁止 Agent 修改
- `baseUpdatedAt` 不一致时返回 conflict
- op list 为空时返回 400

## 8. 实施步骤

| 阶段 | 状态   | 内容                                                                   | 验收                                                   |
| ---- | ------ | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | 已完成 | 定义共享类型：`WorkflowDefinitionDocument`、`WorkflowEditOp`           | 类型可被 server / api-client 复用                      |
| 2    | 已完成 | 实现 `workflow-edit.service.ts`：parse、serialize、validate、apply ops | 单元测试覆盖 add/update/delete/connect/insert/conflict |
| 3    | 已完成 | 新增 `PATCH /api/workflows/:id`                                        | 前端或 curl 可局部修改 workflow                        |
| 4    | 已完成 | api-client 增加 `applyWorkflowOps`                                     | web 端可调用 patch API                                 |
| 5    | 待开始 | 前端逐步接入局部编辑 API                                               | 添加/删除/连线可局部保存                               |
| 6    | 待开始 | MCP tools 接入 service                                                 | Agent 可创建 workflow、添加节点、连线、修改节点        |
| 7    | 待开始 | Agent prompt / skill 文档补充工具使用约束                              | Agent 不直接输出整份 JSON，优先调用工具                |
| 8    | 待开始 | 完善审计与冲突提示                                                     | UI 可展示 conflict 并要求刷新或合并                    |

## 9. 当前进度

- [x] 设计方向确认：保留 JSON 存储，新增局部编辑 service
- [x] 明确 MCP 不直接改 DB、不绕 HTTP，调用 service 层
- [x] 将 `workflow_create` 纳入 MCP 工具范围
- [x] 实现共享类型
- [x] 实现 WorkflowEditService
- [x] 实现 PATCH API
- [x] api-client 增加 `applyWorkflowOps`
- [x] `WorkflowEditService` 从 `@eous/nodes/server` registry 动态读取节点类型和默认配置，不写死节点清单
- [ ] 实现 MCP tools
- [ ] 前端接入局部编辑
- [x] 补充 server 单元测试

## 10. 开放问题

1. locked node 是否允许用户强制解锁后让 Agent 修改？
2. Agent 修改 workflow 是否需要单独的审计日志表？
3. 局部编辑后是否立即 invalid node execution cache，还是沿用当前 node definition hash 自动失效？
4. `workflow_run` 是运行完整 DAG，还是沿用当前 run-to-node 语义扩展？
5. MCP tools 是否要区分只读工具和写工具，允许用户逐项授权？
