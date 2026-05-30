# Eous 核心接口定义

本文档定义平台最关键的 TypeScript 接口，按架构分层组织。

---

## 1. Data Source Layer

### 1.1 行情数据

```typescript
/** OHLCV 数据条 */
interface OHLCVBar {
  timestamp: number       // Unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 实时报价 */
interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  timestamp: number
}

/** 行情数据提供者抽象 */
interface MarketDataProvider {
  readonly name: string
  readonly supportedAssetTypes: AssetType[]

  getQuote(symbol: string): Promise<Quote>
  getKlines(params: {
    symbol: string
    interval: KlineInterval    // '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
    limit: number
    endTime?: number
  }): Promise<OHLCVBar[]>

  /** 订阅实时数据，返回取消订阅函数 */
  subscribeQuotes(symbols: string[], onQuote: (q: Quote) => void): () => void
}
```

**关于数据格式的设计决策**：抽象接口只定义所有数据源必定提供的核心字段（OHLCV 的五个值 + 时间戳）。各 Provider 的特有字段（如 Yahoo 的 dividend、Binance 的 number_of_trades）通过扩展字段承载，不污染核心类型。做到 P2 阶段时调研具体 API 后确定扩展方案。

### 1.2 新闻数据

```typescript
interface NewsArticle {
  id: string
  title: string
  summary: string          // 摘要（用于 LLM 上下文，节省 Token）
  content?: string         // 全文（可选，按需拉取）
  url: string
  source: string
  publishedAt: string
  language: string
  relatedSymbols?: string[]
}

interface NewsProvider {
  readonly name: string
  search(params: {
    query: string
    sources?: string[]
    language?: string
    maxResults: number
    fromDate?: string
  }): Promise<NewsArticle[]>
}
```

### 1.3 标的

```typescript
type AssetType = 'stock' | 'crypto' | 'forex' | 'etf' | 'index'

interface AssetRef {
  symbol: string           // 'AAPL' | 'BTCUSDT' | '600519.SH'
  type: AssetType
  exchange?: string        // 'NASDAQ' | 'Binance' | 'SSE'
  name?: string            // 'Apple Inc.'
}
```

---

## 2. Workflow 定义

### 2.1 工作流结构

```typescript
interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport?: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
}

interface WorkflowEdge {
  id: string
  source: string
  sourceHandle: string    // 'output-0'
  target: string
  targetHandle: string    // 'input-0'
}
```

### 2.2 节点类型

```typescript
type NodeType =
  // Source
  | 'source.price'
  | 'source.kline'
  | 'source.news'
  // Compute
  | 'compute.indicator'
  | 'compute.factor'
  | 'compute.python'
  // LLM
  | 'llm.signal'
  | 'llm.report'
  | 'llm.free'
  // Control
  | 'control.branch'
  | 'control.parallel'
  | 'control.cron'
  // Output
  | 'output.chart'
  | 'output.report'
  // Agent
  | 'agent.call'              // 调用 Agent，注入 Memory
```

### 2.3 节点基类

```typescript
interface NodeDataBase {
  label: string
  description?: string
  inputSchema?: InputHandleDef[]
  outputSchema?: OutputHandleDef[]
}

interface InputHandleDef {
  id: string                 // 'input-0'
  label: string              // '价格数据'
  expectedShape?: DataShape  // 编辑器提示用，非强制校验
}

interface OutputHandleDef {
  id: string                 // 'output-0'
  label: string              // '信号结果'
  shape?: DataShape
}

type DataShape =
  | { type: 'number' }
  | { type: 'string' }
  | { type: 'boolean' }
  | { type: 'array'; items: DataShape }
  | { type: 'object'; fields: Record<string, DataShape> }
  | { type: 'ohlcv' }
  | { type: 'signal' }
  | { type: 'report' }
```

### 2.4 各节点 Data 定义（摘要）

```typescript
// 数据源节点
interface SourceKlineNodeData extends NodeDataBase {
  symbol: string            // 支持 {{asset.symbol}} 变量
  interval: KlineInterval
  limit: number             // 如 200
  provider: string          // 'yahoo' | 'binance'
}

// 计算节点
interface ComputeIndicatorNodeData extends NodeDataBase {
  indicator: 'ma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'atr'
  params: Record<string, number>   // { period: 14 }
}

interface ComputePythonNodeData extends NodeDataBase {
  code: string              // Python 代码片段
  inputs: Record<string, string>  // 变量名 → handle 映射
}

// LLM 节点
interface LLMSignalNodeData extends NodeDataBase {
  model: string             // 'gpt-4o' | 'claude-sonnet-4' | 'deepseek-v3'
  systemPrompt: string
  userPromptTemplate: string  // 支持 {{nodeId.handleId.field}} 变量
  outputSchema: {            // 期望的 JSON 输出格式
    signal: 'string'         // 'long' | 'short' | 'neutral'
    confidence: 'number'     // 0.0 ~ 1.0
    reasoning: 'string'
  }
  temperature?: number        // 默认 0.3
}

interface LLMReportNodeData extends NodeDataBase {
  model: string
  systemPrompt: string
  reportTemplate: string      // Markdown 模板
}

// 控制节点
interface ControlBranchNodeData extends NodeDataBase {
  condition: string           // '{{upstream.output-0.signal}} === "long"'
}

interface ControlCronNodeData extends NodeDataBase {
  cronExpression: string      // '0 9 * * 1-5'
  timezone?: string
}

// 输出节点
interface OutputChartNodeData extends NodeDataBase {
  chartType: 'kline' | 'line' | 'bar'
  config: {
    xField: string            // OHLCV 数据用什么字段做 x 轴
    yFields: string[]
    overlays?: string[]       // 叠加指标
  }
}

// Agent 调用节点
interface AgentCallNodeData extends NodeDataBase {
  agentId: string
  /** 从 Agent Memory 注入哪些信息 */
  memoryKeys: string[]
  /** 给 Agent 的指令 */
  instruction: string         // 支持 {{}} 变量引用上游输出
}
```

---

## 3. Runtime Layer

### 3.1 Workflow 执行引擎

```typescript
type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

interface ExecutionContext {
  executionId: string
  workflowId: string
  userId: string
  emitter: ExecutionEventEmitter
}

interface ExecutionEventEmitter {
  emitNodeStart(nodeId: string): void
  emitNodeProgress(nodeId: string, message: string): void
  emitNodeComplete(nodeId: string, output: unknown): void
  emitNodeError(nodeId: string, error: string): void
  emitLLMStream(nodeId: string, chunk: string): void
  emitWorkflowComplete(executionId: string): void
}

/** 节点执行器基类 */
abstract class NodeExecutor<TData extends NodeDataBase = NodeDataBase> {
  abstract readonly nodeType: NodeType

  abstract execute(
    data: TData,
    inputs: Record<string, unknown>,     // handleId → 上游输出
    ctx: ExecutionContext
  ): Promise<unknown>

  async validate?(data: TData): Promise<{ valid: boolean; errors?: string[] }>
}

/** DAG 执行器 */
interface DAGExecutor {
  execute(workflow: WorkflowDefinition, ctx: ExecutionContext): Promise<ExecutionRecord>
  rerunFrom(workflow: WorkflowDefinition, nodeId: string, ctx: ExecutionContext): Promise<ExecutionRecord>
  cancel(executionId: string): Promise<void>
}
```

调度策略：拓扑分层。计算每个节点的入度，入度 0 的为第 0 层。同层并行执行（受 `maxParallelNodes` 限制），层间串行。LLM 节点单独限流（`maxParallelLLM`），防止 API rate limit。

### 3.2 变量插值

```typescript
/**
 * 解析模板中的 {{}} 变量
 *
 * 语法：
 *   {{nodeId.handleId}}             → 整个输出
 *   {{nodeId.handleId.field}}       → 对象字段
 *   {{nodeId.handleId[0:10]}}       → 数组切片
 *   {{nodeId.handleId[-1]}}         → 数组最后一项
 *   {{asset.symbol}}                → 执行上下文的标的
 *   {{executionTime}}               → 当前时间
 */
function resolveTemplate(
  template: string,
  inputs: Record<string, unknown>,
  ctx: ExecutionContext
): string
```

### 3.3 LLM Provider

```typescript
interface LLMCompletionParams {
  model: string
  messages: { role: 'system' | 'user'; content: string }[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: 'json_object'; schema?: Record<string, unknown> }
}

interface LLMCompletionResult {
  content: string
  json?: unknown
  usage: { promptTokens: number; completionTokens: number }
  model: string
}

interface LLMProvider {
  readonly name: string
  readonly supportedModels: string[]
  complete(params: LLMCompletionParams): Promise<LLMCompletionResult>
  completeStream(params: LLMCompletionParams, onChunk: (c: { content: string; done: boolean }) => void): Promise<LLMCompletionResult>
}
```

---

## 4. 通信层

### 4.1 ApiClient 接口

```typescript
// @eous/api-client
interface ApiClient {
  // Data
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: KlineParams): Promise<OHLCVBar[]>
  searchNews(params: NewsParams): Promise<NewsArticle[]>

  // Workflow
  listWorkflows(): Promise<WorkflowSummary[]>
  getWorkflow(id: string): Promise<WorkflowDefinition>
  saveWorkflow(wf: WorkflowDefinition): Promise<void>
  deleteWorkflow(id: string): Promise<void>
  executeWorkflow(id: string): Promise<ExecutionRecord>
  cancelExecution(id: string): Promise<void>
  getNodeResult(executionId: string, nodeId: string): Promise<NodeResult>

  // Assets
  getWatchedAssets(): Promise<Asset[]>
  addAsset(asset: AssetRef): Promise<void>
  removeAsset(id: string): Promise<void>

  // Real-time
  subscribeExecution(id: string, onEvent: (e: ExecutionEvent) => void): () => void
  subscribeQuote(symbol: string, onQuote: (q: Quote) => void): () => void
}
```

### 4.2 CS 模式实现

```typescript
// @eous/api-client-http
function createHttpClient(baseURL: string, getToken: () => string | null): ApiClient {
  // fetch 封装，自动注入 Authorization header
}
```

### 4.3 Electron 模式实现

```typescript
// @eous/api-client-electron
function createElectronClient(): ApiClient {
  // 本地 Hono，JWT 由 main process 启动时自动签发
}
```

### 4.4 API 路由

```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me

GET    /api/workflows
POST   /api/workflows
GET    /api/workflows/:id
PUT    /api/workflows/:id
DELETE /api/workflows/:id
POST   /api/workflows/:id/execute
GET    /api/workflows/:id/executions

GET    /api/executions/:id
POST   /api/executions/:id/cancel

GET    /api/assets
POST   /api/assets
DELETE /api/assets/:id

GET    /api/data/quote?symbol=AAPL
GET    /api/data/kline?symbol=AAPL&interval=1d&limit=200
GET    /api/data/news?query=AAPL&max=20

GET    /api/providers           # 已配置的 Provider 列表
POST   /api/providers           # 添加 Provider API Key
DELETE /api/providers/:id

WS     /ws/execution/:id        # 执行状态实时推送
```

### 4.5 WebSocket 协议

```
Server → Client:
  { type: 'node:start',    nodeId, timestamp }
  { type: 'node:complete', nodeId, output }
  { type: 'node:error',    nodeId, error }
  { type: 'llm:stream',    nodeId, chunk, done }
  { type: 'workflow:complete', executionId }

Client → Server:
  { type: 'subscribe', executionId }
```

---

## 5. Infrastructure Layer

```typescript
// Provider 配置管理
interface ProviderConfig {
  id: string
  type: 'llm' | 'market' | 'news'
  name: string              // 'openai' | 'yahoo' | 'newsapi' ...
  baseURL?: string
  createdAt: string
}

interface LLMProviderConfig extends ProviderConfig {
  type: 'llm'
  models: string[]          // ['gpt-4o', 'gpt-4o-mini']
}

interface MarketProviderConfig extends ProviderConfig {
  type: 'market'
  supportedAssetTypes: AssetType[]
}

// API Key 管理
interface ProviderKeyService {
  addKey(userId: string, provider: ProviderConfig, apiKey: string): Promise<void>
  getKey(userId: string, providerType: string): Promise<string>  // 解密后返回
  removeKey(userId: string, providerType: string): Promise<void>
  listProviders(userId: string): Promise<ProviderConfig[]>
}
```
