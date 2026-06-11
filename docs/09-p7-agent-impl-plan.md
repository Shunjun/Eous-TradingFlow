# P7 Agent 对话 — 实现方案

> 状态：第 1 批开工中
> 关联：`docs/01-overview.md` §核心设计理念 3、§模块划分；`docs/07-roadmap.md` P7；`docs/05-llm-integration.md`；`docs/08-backlog.md` Agent

## 1. 范围

按 roadmap，P7「Agent 对话」共 8 个功能点：

| ID    | 功能点           | 说明                                               | 优先级        |
| ----- | ---------------- | -------------------------------------------------- | ------------- |
| P7-01 | Agent 对话界面   | 聊天气泡 UI + Markdown 渲染 + 流式回复             | P0，第 1-2 批 |
| P7-02 | Agent 分屏布局   | 对话区 + 右侧视图区（Mosaic）                      | P0，第 5 批   |
| P7-03 | Memory 系统      | 短期上下文 + 长期记忆持久化                        | P0，第 3 批   |
| P7-04 | 工具：查看 K 线  | 自然语言 → 右侧展开 K 线视图                       | P1，第 4 批   |
| P7-05 | 工具：搜索新闻   | 调用 NewsProvider，新闻卡片展示                    | P1，第 4 批   |
| P7-06 | 工具：运行工作流 | "用日报模板分析 AAPL" → 调用 Runner                | P1，第 4 批   |
| P7-07 | Agent 调用节点   | Workflow 中放置，把 Agent Memory 注入下游 LLM 节点 | P1，第 5 批   |
| P7-08 | Agent 设计工作流 | 自然语言 → Workflow JSON 加载到编辑器              | P2，第 5 批   |

P7-07 在 `NodeType` 枚举里已经预留了 `agent.call`，但完全没实现。

## 2. 现状盘点

### 2.1 已就绪的底子

- `packages/types`：`NodeType` 枚举（含 `agent.call`）、Workflow / Execution / Node / AssetRef 等类型齐备
- `packages/db` Prisma：User / Workflow / WorkflowNodeExecution / Provider / ProviderModel / DataSourceInstance / TrackedSymbol 等表已建
- `packages/nodes`：`source.kline` / `source.price` / `control.branch` 三个节点的 def+canvas+server 三件套
- `packages/data-sources`：yahoo-finance、ccxt 两个 Provider
- `apps/server`：Hono 路由、JWT 中间件、AES 加密、Workflow Runner（拓扑排序、变量插值、执行缓存、definitionHash 失效）
- `apps/web`：React Flow 编辑器、Mosaic 工作台、节点选择器、配置面板、全局日志面板
- 路由已挂 `/agents`，sidebar `BUILD` 分组有 Agents 入口
- 页面是 "coming soon" 占位

### 2.2 完全没有的部分

- 无 LLM 节点实现（`llm.signal` / `llm.report` / `llm.free`）
- 无 LLM 调用库（**0 LLM 依赖**——这次引入 `@earendil-works/pi-ai`）
- 无流式输出（SSE / WebSocket 都没接）
- 无 chat bubble / message 组件
- 无 markdown 流式渲染
- 无 agent 相关后端代码、API、类型、Memory 表
- `node-selector.tsx` 和 `workflow-editor.tsx` 的 `NODE_DEFAULTS/LABELS/COLORS` 硬编码只支持 3 个节点

## 3. 协作边界

助手：需求拆解 + 工单起草 + 验收
Claude（CLI）：写代码

> 原因：P7 跨 4 个包、改数据库表、引入新依赖，单工单必超时。Claude 写代码更稳，助手负责不越界、把好验收关。

## 4. 已拍板的关键决策

### 4.1 技术选型

| 决策                                           | 拍板                                                             | 理由                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Provider 兼容层**                            | `@earendil-works/pi-ai` (MIT)                                    | 30+ providers、内置 cost 追踪、TypeBox tool、Context 序列化、stop reasons 统一、流式 partial JSON |
| **不引入** `pi-agent-core` / `pi-coding-agent` | ✓                                                                | 是 CLI 单进程设计，与 web 多用户场景不匹配                                                        |
| **不引入** Vercel AI SDK                       | ✓                                                                | 被 pi-ai 替代                                                                                     |
| **Agent runtime**                              | 全部自己写                                                       | pi-coding-agent SDK 不适合 web 服务；session / memory / 多用户隔离都得自己造                      |
| **范围**                                       | P4 三个 LLM 节点（`llm.signal` / `report` / `free`）和 P7 一起做 | 复用同一套 LLM service，避免重复                                                                  |
| **流式协议**                                   | SSE                                                              | Hono 4.6 一等公民支持、Agent 对话单向、SSE 比 WS 简单                                             |

### 4.2 产品决策

| 决策                                  | 拍板                                                                                         | 理由                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Ollama 不支持 tool calling 的模型** | UI 明确显示"该模型不支持 Agent"，不在该 session 启用                                         | pi-ai 强制 tool calling，强行降级坑太多 |
| **成本表**                            | V1 用 pi-ai 内置价格；`ProviderModel` 加 `costPerInputToken` / `costPerOutputToken` 字段覆盖 | 内置价格 V1 够用，字段保留覆盖能力      |
| **API Key 复用**                      | P1 已有 AES-256-GCM；session 启动时解密，**只存活在请求上下文，不落盘**                      | 复用 P1 加密、解密 key 一次性           |

## 5. 数据库变更

```prisma
// 已有 ProviderModel 加 2 个字段（覆盖 pi-ai 内置价格）
model ProviderModel {
  // ... 已有字段
  costPerInputToken  Float?  @map("cost_per_input_token")
  costPerOutputToken Float?  @map("cost_per_output_token")
}

// 新增 4 张表（Agent 相关）
model AgentSession {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title             String
  providerId        String
  modelId           String
  systemPrompt      String?
  temperature       Float    @default(0.7)
  maxTokens         Int?
  toolConfig        String   @default("{}")          // JSON: enabledTools[]
  memoryScope       String   @default("session")     // 'session' | 'user'
  status            String   @default("active")      // 'active' | 'archived'
  compactionCursor  String?  @map("compaction_cursor") // 已压缩到的 message id
  totalInputTokens  Int      @default(0)
  totalOutputTokens Int      @default(0)
  totalCostUsd      Float    @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  messages          AgentMessage[]
  memories          AgentMemory[]

  @@index([userId, status])
  @@map("agent_sessions")
}

model AgentMessage {
  id              String   @id @default(cuid())
  sessionId       String
  session         AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role            String                                 // 'user' | 'assistant' | 'tool' | 'system'
  content         String                                 // markdown / 文本
  toolCalls       String?                                // JSON: [{ id, name, args }]
  toolCallId      String?                                // role=tool 时关联 assistant 的 tool_call
  toolName        String?
  parentMessageId String?  @map("parent_message_id")     // 给 tree session 留扩展位
  status          String   @default("completed")         // 'streaming' | 'completed' | 'failed' | 'aborted'
  error           String?
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  costUsd         Float    @default(0)
  durationMs      Int?
  createdAt       DateTime @default(now())
  finishedAt      DateTime?

  @@index([sessionId, createdAt])
  @@map("agent_messages")
}

model AgentMemory {
  id          String   @id @default(cuid())
  sessionId   String?  // null = user 级
  session     AgentSession? @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String   // 始终冗余，方便 user 级检索
  kind        String   // 'fact' | 'preference' | 'observation' | 'summary'
  content     String
  tags        String   @default("[]")  // JSON 标签数组
  source      String   // 'user' | 'assistant' | 'extracted'
  importance  Int      @default(5)     // 1-10
  expiresAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, kind])
  @@index([sessionId])
  @@map("agent_memories")
}

model AgentToolCall {
  id          String   @id @default(cuid())
  messageId   String
  toolName    String
  args        String   // JSON
  result      String?  // JSON
  error       String?
  durationMs  Int?
  status      String   // 'pending' | 'running' | 'success' | 'failed' | 'timeout'
  createdAt   DateTime @default(now())
  finishedAt  DateTime?

  @@index([messageId])
  @@map("agent_tool_calls")
}
```

## 6. 实现路径

按依赖关系分 5 批派单，每批内部独立可验收：

### 第 1 批：基础设施（地基）

依赖：**无前置**。本次开工。

- 装依赖：`@earendil-works/pi-ai`（仅 server），不动其他包
- 落点：`apps/server/src/services/llm/`
  - `pi-ai-adapter.ts` — 薄包装，解密 Provider.apiKey、调 `getModel()`、提供 `streamText()` 入口
  - `model-mapper.ts` — `Provider.kind` → pi-ai provider 字符串（OpenAI/Anthropic/DeepSeek/Ollama/Custom）
  - `json-parse.ts` — JSON 容错链（`JSON.parse` → ` ` ```→`{...}` → 重试）
- LLM 节点实现（`packages/nodes/src/`）
  - `llm.signal/` — def + canvas + server，输入 prompt + 上游数据，输出 `{signal, confidence, reasoning}` JSON
  - `llm.report/` — def + canvas + server，输入 prompt + 上游数据，输出 Markdown 报告
  - `llm.free/` — def + canvas + server，输入 userPrompt + 可选 systemPrompt + 工具，输出自定义结构
- 自动注册机制：把 `apps/web/src/components/workflow/node-selector.tsx` 和 `workflow-editor.tsx` 里硬编码的 `NODE_DEFAULTS/LABELS/COLORS` 改成从 `@eous/nodes` 自动收集
- SSE 协议：server 端 `lib/sse.ts`（封装 `streamSSE` + 心跳 + 关闭检测），api-client 加 `streamChat(method, body)` 方法，web 端 `useAgentStream` hook

**验收**：

1. 在工作流里放一个 `llm.free` 节点，配置 Provider + prompt + 数据源节点喂入，**运行后能看到流式输出（SSE 推到浏览器）**
2. `llm.signal` 节点能解析出 `{signal, confidence, reasoning}` JSON（即使 pi-ai 内置 JSON 解析失败也能走容错链拿到结构化结果）
3. `llm.report` 节点输出 Markdown 文本
4. 后续再加新节点，**只用在 `packages/nodes` 加 def+canvas+server 三件套，前端零改动**

### 第 2 批：Agent 对话最小可用

依赖：第 1 批（pi-ai、sse、自动注册）

- 数据库加 4 张 Agent 表（Prisma schema + migration）；`ProviderModel` 加 2 个价格字段
- `apps/server` 新建 `services/agent/`
  - `session.service.ts` — session CRUD（含 list/get/create/update/archive）
  - `message.service.ts` — message 追加、查询、分页
  - `runtime.ts` — AgentRuntime 主循环（基于 pi-ai stream，**自己写**，不引入 pi-agent-core）
  - `context-builder.ts` — 上下文组装（system + 近期消息 + 工具）
  - `tool-registry.ts` — 工具注册表（V1 空，实现接口就行）
- `apps/server` 新建 `routes/agent.ts`
  - `GET /api/agent/sessions` / `POST` / `GET /:id` / `PATCH /:id` / `DELETE /:id` / `POST /:id/archive`
  - `GET /api/agent/sessions/:id/messages?cursor=...`
  - `POST /api/agent/sessions/:id/messages` → SSE 流式
  - `POST /api/agent/sessions/:id/messages/:mid/abort`
- `apps/web/src/pages/(auth)/agents/page.tsx` 改成对话界面
  - session 列表（左侧栏）
  - 消息流（中间区，chat bubble）
  - 输入框（底部，Enter 发送、Shift+Enter 换行）
  - **流式 markdown 渲染**（用 `marked` + 手动 setState，不用 react-markdown）
  - 创建 session 时选 Provider + Model

**验收**：

1. 登录 → Agents → 选 Provider / Model → 创建 session
2. 输入"用一句话介绍你自己"→ 看到逐字流式回复
3. 刷新页面历史消息还在
4. 切换 session 不串消息
5. 对话中点"停止"能 abort 流式生成

### 第 3 批：Memory 系统

依赖：第 2 批

- 短期上下文：滑动窗口（按 token 数截断、pi-ai 的 usage 拿到精确值）
- 长期记忆：`AgentMemory` 表结构化 JSON
- 写入策略：每 5 轮 / 每 5 分钟调 LLM 摘要，提取 fact/preference/observation
- 召回策略：当前消息关键词 → SQLite FTS5 虚拟表检索相关记忆 → 拼进 system prompt
- session 切换时加载 user 级 memory
- 工具 `save_memory` / `search_memory` / `forget_memory` 让 Agent 主动管理

**验收**：

1. 连续 10 轮对话让 Agent 记住"我最近看多 BTC"
2. 新 session 开头"我之前说过什么"能召回
3. 让 Agent 主动存"以后所有分析都关注大盘相关性"，下次开 session 默认遵守

### 第 4 批：工具调用

依赖：第 3 批

- 工具协议：Agent 推理出 tool_call（pi-ai TypeBox）→ runtime 解析 → 调对应 service → 结果回注 → 继续生成
- 工具实现：
  1. `view_kline` — 返回右侧视图事件（SSE 事件 `view:open`）
  2. `search_news` — 直接调 NewsProvider
  3. `run_workflow` — 调 Workflow Runner（同步等结果）
  4. `list_workflows` / `get_workflow_meta` — 备选工作流
  5. `read_watchlist` — 用户关注列表
  6. `save_memory` / `search_memory`（从第 3 批）
- session.toolConfig JSON 存 enabledTools 列表
- LLM 节点的"上游数据"和"工具调用结果"在 system prompt 里用统一格式注入

**验收**：

1. 对话中输入"看 BTC 的 K 线"→ 触发 `view_kline` → 右侧 K 线视图打开（第 5 批接 Mosaic）
2. "最近 BTC 有什么新闻"→ 触发 `search_news` → 嵌入新闻列表
3. "用日报模板分析 BTC"→ 触发 `run_workflow` → 展示工作流结果

### 第 5 批：Mosaic 分屏 + Workflow 集成 + Agent 设计

依赖：第 4 批

- **P7-02**：`apps/web/src/pages/(auth)/agents/page.tsx` 加右侧 Mosaic 视图区，监听 SSE `view:open` 事件
- **P7-07**：`packages/nodes/src/agent.call/` def+canvas+server
  - 输入：上游（已运行过的 Agent session id）
  - 执行：runtime 调 session 拿记忆 → 注入下游 LLM 节点 prompt
- **P7-08**：工具 `design_workflow`（Agent 返回 Workflow JSON）→ 跳转编辑器时把 JSON 灌进 `useWorkflowStore`

**验收**：

1. Workflow 中放 `agent.call` 节点 + 下游 `llm.report` 节点，运行时把当前对话记忆传给 LLM
2. 对话中说"帮我搭一条每日 BTC 扫描流程"→ 编辑器里出现节点图

## 7. 风险点

| 风险                             | 应对                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| 大型工单超时（1200s/339 步上限） | 严格 5 批拆、每批只 1 个核心目标                                               |
| 流式 Markdown 渲染               | `marked` + 手动 setState，不上 react-markdown（流式场景下组件 remount 丢状态） |
| pi-ai 内置价格可能过时           | V1 接受，后续用 `ProviderModel` 字段覆盖                                       |
| Ollama 小模型无 tool calling     | UI 明确显示，不强行降级                                                        |
| Memory 写入频率                  | "每 5 轮 / 每 5 分钟" 批量写 + 用户主动 `save_memory` 工具双轨                 |
| 流式中断颗粒度                   | abort 后已生成 token 仍记入 cost（模型真生成过了）                             |
| API Key 落盘                     | 永不落盘，request 上下文一次性的；用完即丢                                     |
| `markClean()` 这类 edit 越界     | 不动 editor 已有逻辑，**只把硬编码 list 改成自动注册**                         |

## 8. 文件落点

```
apps/server/src/services/
  llm/
    pi-ai-adapter.ts        # 薄包装：解密 key → getModel → stream()
    model-mapper.ts         # Provider.kind → pi-ai provider 字符串
    json-parse.ts           # JSON 容错链
  agent/
    session.service.ts      # session CRUD
    message.service.ts      # message 持久化
    runtime.ts              # AgentRuntime 主循环（自己写）
    context-builder.ts      # 上下文组装
    tool-registry.ts        # 工具注册
  lib/
    sse.ts                  # SSE 工具（心跳、关闭检测）
  routes/
    agent.ts                # /api/agent/* 路由

packages/db/prisma/
  schema.prisma             # 加 4 张表 + ProviderModel 2 个字段

packages/nodes/src/
  llm.signal/               # 新增三件套
  llm.report/
  llm.free/
  agent.call/               # 第 5 批新增
  web/index.ts              # 导出所有 node
  server/index.ts           # 导出所有 executor

apps/web/src/
  hooks/use-agent-stream.ts # SSE 订阅 hook
  pages/(auth)/agents/
    page.tsx                # 改造为对话界面
  components/agent/
    chat-message.tsx        # 单条消息（含 markdown）
    chat-input.tsx          # 输入框
    session-list.tsx        # 左侧 session 列表
    view-panel.tsx          # 右侧视图区（Mosaic 第 5 批）
```

## 9. 第 1 批开工清单

仅第 1 批。开工后第 2-5 批再单独派单。

- [ ] 装 `@earendil-works/pi-ai` 到 `apps/server`
- [ ] `apps/server/src/services/llm/{pi-ai-adapter,model-mapper,json-parse}.ts`
- [ ] `apps/server/src/lib/sse.ts`
- [ ] `packages/nodes/src/llm.signal/{def,canvas,server,types}.ts(x)`
- [ ] `packages/nodes/src/llm.report/{def,canvas,server,types}.ts(x)`
- [ ] `packages/nodes/src/llm.free/{def,canvas,server,types}.ts(x)`
- [ ] `packages/nodes/src/web/index.ts` 改成自动收集 def
- [ ] `packages/nodes/src/server/index.ts` 改成自动收集 executor
- [ ] `apps/web/src/components/workflow/node-selector.tsx` 改成从 `@eous/nodes` 自动注册
- [ ] `apps/web/src/components/workflow/workflow-editor.tsx` 改成从 `@eous/nodes` 自动注册
- [ ] `api-client-http` 加 `streamChat(method, body): AsyncIterable<LlmEvent>`（**SSE 通用方法**，不是 chat 专用，方便后续第 2 批复用）
- [ ] `apps/web` 加 `useAgentStream` hook（用 `fetch + ReadableStream` 解析 SSE，**先做最小版**——SSE 解析 + 事件分发，事件类型先只暴露 `{type, data}` 不细分）
