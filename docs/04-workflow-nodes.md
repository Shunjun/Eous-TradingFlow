# Workflow 与节点系统

## Workflow Definition

Workflow 主存储仍是 `workflows.definition` JSON 字符串。标准结构：

```ts
interface WorkflowDefinitionDocument {
  schemaVersion: 1
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

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

interface WorkflowEdge {
  id: string
  source: string
  sourceHandle?: string
  target: string
  targetHandle?: string
}
```

旧格式 `{ nodes, edges }` 仍兼容，保存时由服务端归一化。

## 编辑入口

保留两类 API：

- `PUT /api/workflows/:id`：整份保存。
- `PATCH /api/workflows/:id`：局部编辑，推荐给前端保存、Agent/MCP tools 使用。

局部编辑请求：

```ts
interface ApplyWorkflowOpsRequest {
  baseUpdatedAt?: string
  ops: WorkflowEditOp[]
}
```

支持的 op：

- `workflow.rename`
- `node.add`
- `node.update`
- `node.delete`
- `edge.add`
- `edge.update`
- `edge.delete`
- `node.insertBetween`

`WorkflowEditService` 是局部编辑唯一入口，负责：

- workflow 权限校验。
- schema parse/serialize。
- node/edge id 去重。
- node type 必须存在于 `@eous/nodes/server` registry。
- edge source/target 必须存在。
- 删除节点时同步删除相关边。
- 添加/修改边后检查 DAG 无环。
- `baseUpdatedAt` 乐观并发冲突检查。
- locked node 默认禁止修改，除非 op 显式 `force`。

## 前端编辑器

实现位于 `apps/web/src/components/workflow`。

主要结构：

| 目录         | 说明                                            |
| ------------ | ----------------------------------------------- |
| `canvas/`    | React Flow 画布、toolbar、context menu、overlay |
| `nodes/`     | 节点视觉组件、handle、selector、node types      |
| `panels/`    | 右侧配置、执行历史、输出配置、全局日志          |
| `variables/` | 变量 inspector / picker / selector              |
| `store/`     | Workflow 文档、UI、状态、history slice          |
| `utils/`     | definition、draft storage、layout 工具          |

编辑器已支持 patch-based history，本地 undo/redo 和保存都围绕 `WorkflowEditOp`。

## 节点注册

`packages/nodes` 同时提供前端和服务端注册。

每个节点目录通常包含：

```text
def.ts      节点元信息、输入配置、输出声明
canvas.ts  前端 canvas 展示模型
server.ts  服务端 executor
types.ts   节点私有类型
```

服务端导出：

```ts
import { executors, nodeRegistry } from '@eous/nodes/server'
```

前端导出：

```ts
import { allNodeMetas, getNodeDef, getNodeOutputs } from '@eous/nodes'
```

## 当前节点

| 类型               | 类别    | 状态                                             |
| ------------------ | ------- | ------------------------------------------------ |
| `trigger.start`    | trigger | 已实现，手动启动                                 |
| `trigger.schedule` | trigger | 已实现节点定义和执行；调度器能力仍需继续完善     |
| `source.price`     | source  | 已实现，从 DataSourceInstance 获取报价           |
| `source.kline`     | source  | 已实现，从 DataSourceInstance 获取 K 线          |
| `control.branch`   | control | 已实现条件分支                                   |
| `llm`              | llm     | 已实现，可配置文本、Markdown 或 JSON Schema 输出 |

未实现或待增强：

- compute 节点，如指标/因子/Python。
- output 节点，如报告视图、图表输出。
- `agent.call` 节点。
- Loop、merge、sub-workflow。

## Runner

服务端 Runner 位于 `services/server/src/modules/workflow/workflow-runner.service.ts`。

当前能力：

- 拓扑排序。
- 从单节点运行：执行目标节点及其上游。
- 全图执行：默认从 `trigger.start` 可达节点开始，否则执行全部节点。
- `control.branch` 根据选中分支跳过非激活下游。
- 节点输入递归解析变量。
- 节点输出支持 custom outputs。
- 单节点执行记录写入 `workflow_node_executions`。
- 对非 trigger 节点可按 definition hash 复用缓存。

当前限制：

- Runner 目前按拓扑顺序串行执行，不是分层并行。
- 没有独立 workflow execution 表。
- Workflow 执行事件 WebSocket/SSE 推送仍待增强。
- 失败后的下游处理策略还比较基础。

## 变量语法

变量解析由 `services/server/src/lib/var-resolver.ts` 实现。

典型写法：

```text
{{K线数据.bars}}
{{实时报价.price}}
{{Start.userInput}}
```

当字符串整体是一个变量表达式时返回原始值；当变量嵌在普通字符串中时返回替换后的字符串。
