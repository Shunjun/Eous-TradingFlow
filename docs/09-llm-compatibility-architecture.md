# LLM 兼容层设计

## 目标

把模型差异、协议差异、供应商差异拆开处理，避免把逻辑散在 `agent.service`、`runtime`、`model-sync` 和各个调用点里。

核心要求：

- 同一个业务意图只描述一次
- 模型能力先归一，再翻译成协议参数
- 协议层只处理 wire format
- Vendor 层只处理同协议下的特殊差异
- 响应解析和历史 replay 也走同一条兼容链路

## 问题

当前问题不是“缺少某个参数”，而是分层不清：

- 业务层直接碰模型细节
- 模型能力和协议字段混在一起
- DeepSeek / Anthropic / OpenAI 的差异被写在调用点
- 标题生成、聊天生成、工具任务的输出解析方式不统一

这会导致：

- 新模型接入要改很多地方
- 同一模型在不同 API dialect 下行为不一致
- reasoning / thinking 的关闭逻辑难以统一
- response 解析容易只盯 `text`，忽略 `reasoning_content` 或 `choices[0].message.content`

## 分层

建议拆成 4 层。

### 1. 模型族层

按模型族建文件，例如：

- `deepseek.ts`
- `anthropic.ts`
- `openai.ts`
- `google.ts`
- `kimi.ts`

职责：

- 声明模型族支持的能力
- 归一化 thinking level
- 判断是否多模态
- 计算默认 thinking level
- 给出可用的协议类型

例子：

- DeepSeek V4 Flash 支持 reasoning
- 用户要 `medium`，但模型只支持 `low/high` 时，这层负责降级
- 这里不拼请求体，只产出统一能力对象

### 2. 协议层

按 wire format 分文件，例如：

- `dialects/openai-chat.ts`
- `dialects/openai-responses.ts`
- `dialects/anthropic-messages.ts`

职责：

- 把统一请求翻译成具体协议字段
- 把原始响应翻译成统一输出
- 定义 `content`、`thinking`、`reasoning`、`tool_calls` 的解包规则

例子：

- OpenAI Chat 走 `messages + max_tokens + reasoningEffort`
- Anthropic Messages 走 `messages + thinking + output_config`

### 3. Vendor 适配层

这是协议层之上的可选补丁层，不是必需层。

同一模型族在不同 Vendor 下如果存在差异，就放这里，例如：

- DeepSeek 官方
- DeepSeek via OpenRouter
- Anthropic 官方
- Anthropic 兼容网关

职责：

- 拦截并修正请求参数
- 处理 Vendor 特例
- 处理历史消息 replay 规则
- 覆盖响应解析的特殊字段

关键规则：

- Vendor 实例自己判断是否命中
- 传入 provider / baseUrl / modelId / capabilities 后，能处理就处理
- 不能处理就直接回退到标准协议层
- 如果 Vendor 行为与标准协议完全一致，就不需要单独创建 Vendor 适配器
- Vendor 能力是协议能力的补集，不是另一套平行体系

### 4. 共享策略层

放通用规则，不属于某个模型或某个协议：

- output budget 策略
- response 统一抽取
- tool/audio/vision 的通用预处理
- 日志和错误归类

## 请求链路

```text
Agent service
  -> 选择模型 / 会话 / 任务意图
  -> model family 归一化
  -> dialect 选择
  -> provider adapter 可选命中，否则回退 dialect
  -> runtime 请求
  -> provider 原始响应
  -> dialect / adapter 解析
  -> 统一文本 / tool / reasoning 输出
```

## 文件布局

建议在 `apps/server/src/llm/` 下组织：

```text
llm/
  families/
    deepseek.ts
    anthropic.ts
    openai.ts
    google.ts
    kimi.ts
  dialects/
    openai-chat.ts
    openai-responses.ts
    anthropic-messages.ts
  adapters/
    deepseek-official.ts
    deepseek-openrouter.ts
    anthropic-official.ts
    openai-compatible.ts
  policies/
    output-budget.ts
    response-normalizer.ts
    replay-policy.ts
  planner.ts
  types.ts
```

## 接口

### Model family

```ts
type ModelCapability = {
  reasoning: boolean
  multimodal: boolean
  supportedThinkingLevels: Array<'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'>
  defaultThinkingLevel: string
  allowedDialects: Array<'openai-chat' | 'openai-responses' | 'anthropic-messages'>
}
```

### Planner

```ts
type LlmPlan = {
  family: string
  dialect: string
  adapter?: string
  providerOptions: Record<string, unknown>
  modelSettings: Record<string, unknown>
}
```

### Dialect

```ts
interface Dialect {
  buildRequest(input: UnifiedRequest, plan: LlmPlan): unknown
  parseResponse(output: unknown, plan: LlmPlan): UnifiedResponse
}
```

### Adapter

```ts
interface ProviderAdapter {
  matches(model: ResolvedModel): boolean
  beforeRequest(payload: unknown, model: ResolvedModel, plan: LlmPlan): unknown
  afterResponse(response: unknown, model: ResolvedModel, plan: LlmPlan): unknown
}
```

## DeepSeek 示例

### 输入

- family: `deepseek`
- modelId: `deepseek-v4-flash`
- dialect: `anthropic-messages`
- 用户要求 thinking level: `off`

### 规划结果

```ts
{
  family: 'deepseek',
  dialect: 'anthropic-messages',
  providerOptions: {
    deepseek: {
      thinking: { type: 'disabled' }
    }
  }
}
```

### 发送时

- dialect 负责把统一输入翻成 Anthropic Messages
- adapter 负责修正 DeepSeek 官方 / OpenRouter 的差异
- runtime 只接收最终 payload

### 返回时

- 如果正文在 `content`，直接取正文
- 如果正文空，但 `reasoning_content` 存在，不能拿来当标题正文
- 标题生成只认最终正文，空了就 fallback

## 为什么要先归一，再翻译

因为“用户想要什么”和“Vendor 要什么字段”不是一回事。

例子：

- 用户要 `medium`
- DeepSeek 官方不一定直接接受 `medium`
- Anthropic 可能要 `thinking: { type: 'enabled' }`
- OpenAI 可能要 `reasoningEffort: 'low'`

所以正确顺序是：

1. 统一用户语义
2. 统一模型能力
3. 统一协议 dialect
4. 再翻译成 Vendor 字段

## 迁移顺序

### 第一阶段

- 新建 `llm/` 目录
- 把标题生成先接入新 planner
- 保留 fallback 逻辑不变

### 第二阶段

- 把普通 chat 生成接入同一条链路
- 接入 provider adapter

### 适配器决策

适配器不由调用点硬编码选择，而是由每个实例自己判断：

```ts
matches({ provider, baseUrl, modelId, capabilities }) {
  // 能处理就返回 true
  // 处理不了就返回 false，交给 dialect
}
```

这样同一套调用流程可以同时支持：

- 只有 dialect 的标准 Vendor
- 需要少量修补的兼容 Vendor
- 需要完整重写请求/响应的特殊 Vendor

### 第三阶段

- 把工具任务、摘要、翻译等 utility 调用接入
- 统一 response normalizer

### 第四阶段

- 删除旧的散落判断
- 收敛旧 `model-sync` 的职责
- 把所有模型能力迁移到 family 文件

## 设计原则

- 业务层不写协议细节
- 协议层不写业务语义
- 模型族文件只描述能力，不发请求
- Vendor 适配器只处理协议差异，不碰产品逻辑
- 解析必须和请求使用同一套能力图谱
