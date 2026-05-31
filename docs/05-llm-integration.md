# Eous LLM 集成方案

## 1. 定位

LLM 在 Eous 里是 Workflow 的**一个普通节点类型**，不是独立的一层架构。LLM 节点可以出现在 DAG 的任何位置——上游接数据源和计算节点，下游接条件分支、图表、甚至另一个 LLM 节点。

## 2. 三种 LLM 节点

| 节点           | 输入               | 输出                                        | 典型场景           |
| -------------- | ------------------ | ------------------------------------------- | ------------------ |
| **llm.signal** | 价格 + 指标 + 新闻 | JSON 信号 `{signal, confidence, reasoning}` | 短期方向判断       |
| **llm.report** | 全部上游分析结果   | Markdown 报告                               | 盘前分析、每日复盘 |
| **llm.free**   | 用户自定义         | 用户自定义                                  | 灵活的实验性分析   |

## 3. 接入方式

通过 Vercel AI SDK 统一调用：

```typescript
import { generateText, streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
```

用户在前端配置 Provider API Key（AES-256-GCM 加密存储），运行时引擎根据节点 `model` 字段动态创建 Provider 实例。

支持的模型：

- OpenAI: `gpt-4o`, `gpt-4o-mini`
- Anthropic: `claude-sonnet-4-20250514`
- DeepSeek: `deepseek-v3`
- Ollama: 本地模型（数据完全不出本机）

## 4. Prompt 结构

```
┌─ System Prompt ─────────────────────────┐
│  节点配置中定义                          │
│  设定角色、行为边界、输出格式            │
├─ Context（引擎自动注入）─────────────────┤
│  - 当前标的: {{asset.symbol}}            │
│  - 分析时间: {{executionTime}}           │
├─ User Prompt ────────────────────────────┤
│  userPromptTemplate 变量替换后           │
│  引用上游输出: {{nodeId.handleId}}       │
└──────────────────────────────────────────┘
```

## 5. 流式输出

LLM 节点的生成内容通过 WebSocket 实时推送到前端。信号分析节点显示逐字文本，报告生成节点使用 `react-markdown` 做流式 Markdown 渲染。

前端推送协议：

```json
{ "type": "llm:stream", "nodeId": "abc", "chunk": "## ", "done": false }
{ "type": "llm:stream", "nodeId": "abc", "chunk": "市场", "done": false }
{ "type": "llm:stream", "nodeId": "abc", "chunk": "", "done": true }
```

## 6. JSON 输出容错

LLM 信号节点要求输出 JSON，但模型不一定遵守。引擎的容错链：

1. 直接 `JSON.parse(text)`
2. 提取 ` ```json ... ``` ` 代码块
3. 提取 `{ ... }` 块
4. 失败 → 重试一次，追加 "Respond with valid JSON only"

## 7. Token 管理

- 变量引用的切片语法（`{{news[0:5]}}`）天然控制注入量
- 引擎估算 System + User Prompt 的 Token 数，超出模型上下文时自动截断长文本
- 每次 LLM 调用的 Token 消耗记录在执行详情中，支持成本追踪

```typescript
// LLM 节点预估 Token 成本
const TOKEN_BUDGET: Record<string, number> = {
  'gpt-4o': 120_000, // 留 safe margin
  'gpt-4o-mini': 120_000,
  'claude-sonnet-4': 160_000,
  'deepseek-v3': 64_000,
}
```
