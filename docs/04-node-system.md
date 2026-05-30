# Eous 节点系统设计

## 1. 节点分类

| 类别 | 节点 | 说明 |
|------|------|------|
| **Source** | 实时价格、历史K线、新闻源 | 从 Data Source Layer 获取数据，无输入只有输出 |
| **Compute** | 技术指标、因子计算、Python 代码 | 纯计算，输入数据输出结果 |
| **LLM** | 信号分析、报告生成、自由对话 | 调用 LLM，上游数据 + Prompt 模板 → 结构化输出 |
| **Control** | 条件分支、并行分发、定时触发 | 控制流程走向 |
| **Output** | 图表渲染 | 终端节点，消费数据渲染可视化 |
| **Agent** | Agent 调用 | 调用 Agent 并注入 Memory 到分析上下文 |

## 2. 节点生命周期

```
idle ──▶ pending ──▶ running ──▶ completed
                │          │
                │          └──▶ failed
                │
                └──▶ cancelled（仅当未进入 running）
```

- `idle → pending`：依赖节点全部完成，引擎将其入队
- `pending → running`：引擎分配执行槽
- `running → completed`：执行成功，输出写入结果
- `running → failed`：执行异常，错误信息写入；默认阻塞下游
- `pending → cancelled`：用户取消，不执行

## 3. 执行调度

### 3.1 拓扑分层并行

```
           [定时触发]
               │
       ┌───────┼───────┐
       │       │       │
  [实时价格] [历史K线] [新闻源]    ← 第1层：无依赖，并行
       │       │       │
       └───┬───┘       │
           │           │
      [技术指标]       │              ← 第2层：依赖第1层
           │           │
           └─────┬─────┘
                 │
           [LLM 信号分析]             ← 第3层：依赖第2层
                 │
         ┌───────┴───────┐
         │               │
    [图表渲染]   [Agent 调用]        ← 第4层：依赖第3层，并行
```

规则：
- 同层无依赖 → 并行执行
- 层间串行：上层全部完成后下层开始
- LLM 节点受 `maxParallelLLM` 单独限流
- 条件分支节点：只执行匹配路径，未走到的节点标记 `skipped`

### 3.2 限流配置

```typescript
interface SlotConfig {
  maxParallelNodes: number    // 默认 5
  maxParallelLLM: number      // 默认 2
  nodeTimeout: number         // 默认 300_000 ms
}
```

## 4. 数据传递

### 4.1 变量引用语法

```
{{nodeId.handleId}}              → 整个输出
{{nodeId.handleId.field}}        → 对象字段
{{nodeId.handleId[0:10]}}        → 数组切片
{{nodeId.handleId[-1]}}          → 数组最后一项
{{asset.symbol}}                 → 执行上下文
{{executionTime}}                → 当前时间
```

### 4.2 使用示例

LLM 信号分析节点的 `userPromptTemplate`:

```text
标的: {{asset.symbol}}
当前价格: {{price.output-0.price}}
RSI(14): {{rsi.output-0[-1]}}
近7日动量因子: {{momentum.output-0}}
相关新闻（前5条）: {{news.output-0[0:5]}}

请判断短期多空信号。只输出 JSON:
{"signal": "long|short|neutral", "confidence": 0.0-1.0, "reasoning": "..."}
```

引擎执行时自动解析变量、取值、替换，生成最终 Prompt。

大数据截断策略：新闻源输出可能是 50 条新闻，变量引用 `{{news.output-0[0:5]}}` 只取前 5 条，避免 Token 浪费。

## 5. 错误处理

| 场景 | 策略 |
|------|------|
| 数据源不可达 | 重试 3 次（指数退避），仍失败 → failed |
| LLM 返回非 JSON（信号节点） | 重试 1 次并追加 "Respond with valid JSON only" |
| Python 代码异常 | 捕获 stderr，写入 error |
| 节点超时 | 自动标记 failed |

节点失败后，下游行为可配置：
- `stop`（默认）：终止整个工作流
- `continue`：仅标记当前节点失败，不阻塞不依赖它的下游

## 6. 节点扩展

新增节点类型需要：

1. 在 `packages/types` 中定义 NodeData 类型
2. 在后端实现 `NodeExecutor` 子类
3. 在前端注册节点元信息（`NodeTypeMeta`）和自定义渲染组件
4. 在 `NodeTypeRegistry` 注册

```typescript
// 节点元信息（前端注册）
interface NodeTypeMeta {
  type: NodeType
  category: 'source' | 'compute' | 'llm' | 'control' | 'output' | 'agent'
  label: string
  description: string
  icon: string
  defaultData: () => NodeData
}
```
