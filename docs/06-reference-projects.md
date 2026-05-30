# 参考项目分析

本文档整理了与 Eous 相关的 GitHub 开源项目，分析其架构、优点、不足之处，以及 Eous 可以借鉴和差异化之处。

---

## 1. TradingGoose Studio ⭐⭐⭐⭐⭐

> 最直接的参考对象

| 项目 | 详情 |
|------|------|
| 仓库 | [TradingGoose/TradingGoose-Studio](https://github.com/TradingGoose/TradingGoose-Studio) |
| 定位 | AI 工作流平台，技术分析 + LLM 交易决策 |
| License | AGPL-3.0 |
| Stars | ~1.5k |
| 活跃度 | 高（2026年5月仍在频繁更新） |

### 架构分析

TradingGoose Studio 基于 **Sim Studio**（Sim Studio v0.4.25 fork），在通用 AI 工作流平台上叠加了交易专用能力。

```
技术栈:
├── Next.js (App Router)
├── React Flow (节点编辑器)
├── Bun (运行时)
├── PostgreSQL + pgvector
├── Redis (实时 + 缓存)
├── Socket.io (实时推送)
├── Trigger.dev (后台任务)
├── E2B (远程代码执行)
├── Lightweight Charts (K线图表)
├── PineTS (指标引擎，AGPL 传染)
└── Drizzle ORM
```

### 优点

1. **Sim Studio 的成熟工作流基础设施**：节点编辑器、执行引擎、实时状态推送已经经过大量打磨
2. **K 线图表渲染专业**：使用 TradingView 开源版 Lightweight Charts
3. **PineTS 指标引擎**：类似 TradingView Pine Script 的表达式语法，用户可写自定义指标
4. **模板化的工作流管理**：保存、复制、版本化工作流
5. **Monorepo 结构清晰**：app/packages 分离，适合团队协作

### 不足之处（Eous 可改进的点）

1. **定位偏向交易执行**：核心目标仍是生成交易信号并连接到 Alpaca 等券商下单。Eous 的定位"Agent 分析决策编排"更抽象，不绑定交易动作
2. **LLM 角色有限**：LLM 主要用于最终信号分析，不像 Eous 设计的那样可以在 DAG 任意位置插入（信号分析、参数优化、报告生成、自由对话）
3. **技术栈较重**：E2B 远程执行、PineTS 指标引擎、pgvector 向量数据库…依赖复杂度高。Eous V1 可以用更轻的方案（isolated-vm + TA-Lib + 无向量需求）
4. **缺少中文生态支持**：新闻源、模型推荐均为英文优先
5. **AGPL 许可证限制**：PineTS 的 AGPL 传染性导致整个项目 AGPL，对商业使用不友好

### Eous 借鉴清单

- ✅ React Flow + Node 注册机制（节点编辑器骨架）
- ✅ 工作流定义 JSON 结构的设计思路
- ✅ WebSocket 实时执行状态推送
- ✅ Lightweight Charts 集成方式
- ✅ 模板/版本管理的数据模型
- ❌ 不照搬 E2B（太重），用 isolated-vm 做 Python 沙箱
- ❌ 不照搬 PineTS（AGPL），用 TA-Lib + 自定义表达式引擎

---

## 2. comfyTrade ⭐⭐⭐

> 节点式交易策略编辑器

| 项目 | 详情 |
|------|------|
| 仓库 | [tomtomtong/comfyTrade](https://github.com/tomtomtong/comfyTrade) |
| 定位 | MT5 可视化策略构建 + AI 交易 Agent |
| License | MIT |
| Stars | ~300 |

### 架构分析

```
技术栈:
├── Electron (桌面端)
├── Node.js + Python (后端)
├── Chart.js (图表)
├── MT5 Python API (交易执行)
├── WebSocket (Electron-Python 桥接)
└── OpenRouter (LLM 接入)
```

### 优点

1. **节点编辑器直观**：Drag-and-drop 构建策略，用户学习成本低
2. **MT5 深度集成**：实时数据 + 下单执行 + 历史回测一体化
3. **MIT 许可证**：商业友好
4. **桌面端体验**：Electron 提供原生级别的交互

### 不足之处

1. **绑定 MT5**：只能用于 MT5 生态，标的类型受限（主要是外汇）
2. **LLM 集成较初级**：通过 OpenRouter 单次调用，缺乏流式输出、Schema 约束
3. **无工作流管理体系**：策略就是一张图，没有版本、模板、复制等管理
4. **可观察性弱**：执行过程不透明，调试困难
5. **Python + Electron 桥接**：架构耦合度高，不易扩展

### Eous 借鉴清单

- ✅ 节点编辑器的交互直觉
- ❌ 不绑定任何交易平台
- ❌ 不用 Electron（Web 优先，降低门槛）

---

## 3. AI-Trader ⭐⭐⭐⭐

> Agent-Native 交易平台

| 项目 | 详情 |
|------|------|
| 仓库 | [HKUDS/AI-Trader](https://github.com/HKUDS/AI-Trader) |
| 定位 | AI Agent 社交化交易平台 |
| License | MIT |
| Stars | ~2k |

### 架构分析

```
技术栈:
├── FastAPI (后端)
├── React (前端)
├── PostgreSQL
└── WebSocket
```

### 优点

1. **Agent 原生设计理念**：平台为 AI Agent 设计，提供 SKILL.md 让 Agent 自动接入
2. **Agent 社交机制**：Agent 之间可以分享信号、复制交易、辩论策略，思路新颖
3. **多市场支持**：股票、加密货币、外汇、期权
4. **简单可自部署**：FastAPI + React，技术栈简单

### 不足之处

1. **没有可视化工作流编辑器**：Agent 的执行逻辑是代码定义的，不是节点编排的
2. **偏向社交交易**：核心是信号分享和复制交易，不是分析平台
3. **LLM 角色固定**：Agent 的角色预设（bull/analyst 等），不能自由编排

### Eous 借鉴清单

- ✅ Agent-Native 的设计思维（Eous 的工作流本身就是 Agent 的执行逻辑定义）
- ✅ SKILL.md 式的能力描述（可考虑在模板市场中引入类似机制）
- ✅ FastAPI 后端结构的简洁性
- ❌ 不引入社交化交易机制（V1 无必要）

---

## 4. Sim Studio ⭐⭐⭐⭐⭐

> 通用 AI 工作流平台（TradingGoose 的上游）

| 项目 | 详情 |
|------|------|
| 仓库 | [simstudioai/sim](https://github.com/simstudioai/sim) |
| 定位 | 可视化 AI Agent 工作流构建 |
| License | Apache 2.0 |
| Stars | ~20k |

### 架构分析

```
技术栈:
├── Next.js (App Router)
├── React Flow (核心节点编辑器)
├── Bun (运行时)
├── PostgreSQL + pgvector
├── Drizzle ORM
├── Better Auth
├── Zustand + TanStack Query
├── Socket.io
├── Trigger.dev
├── E2B (远程代码执行)
├── Streamdown (流式 Markdown)
└── Turborepo (Monorepo)
```

### 优点

1. **节点编辑器极其成熟**：自定义 Node 组件、Handle 系统、配置面板、画布交互
2. **执行引擎稳定**：DAG 调度、状态管理、WebSocket 实时推送
3. **LLM 集成完善**：工具调用、流式输出、多模型支持
4. **扩展性好**：节点注册机制、自定义节点
5. **Apache 2.0 许可证**：商业友好
6. **社区活跃**：20k Stars，大量贡献者和用户验证

### 不足之处（从交易分析角度看）

1. **不是交易平台**：没有行情数据、K 线图表、技术指标等金融专业能力
2. **节点偏向通用 Agent 任务**：发送邮件、调用 API、查询数据库…缺少金融专用节点

### Eous 借鉴清单

- ✅✅✅ 几乎整个前端架构都可以参考（React Flow 集成模式、Zustand Store 设计、节点注册机制）
- ✅✅✅ 后端执行引擎的架构思路
- ✅✅ Streamdown 流式 Markdown 渲染
- ✅ WebSocket 实时推送模式
- ✅ Monorepo 结构
- ❌ 不需要 pgvector（V1 无向量检索需求）
- ❌ 不需要 E2B（太重，isolated-vm 够用）

---

## 5. Qlib ⭐⭐⭐⭐

> AI 量化平台

| 项目 | 详情 |
|------|------|
| 仓库 | [microsoft/qlib](https://github.com/microsoft/qlib) |
| 定位 | AI 导向的量化投资平台 |
| License | MIT |
| Stars | ~17k |

### 与 Eous 的关系

Qlib 是工业级量化研究平台，提供完整的数据处理、因子计算、模型训练、回测流水线。Eous 与 Qlib 是**互补关系**而非竞品：

- Qlib 是**计算引擎**：负责因子计算、模型训练、回测评估
- Eous 是**编排层**：定义 Agent 如何组合这些计算 + LLM + 数据源来完成分析决策

V2 理想状态下，Eous 的"因子计算"节点可以直接调用 Qlib 的因子表达式引擎，"RL 模型推理"节点可以加载 Qlib 训练的模型。

---

## 6. 其他相关项目速览

| 项目 | 一句话 | Eous 相关性 |
|------|--------|-------------|
| [TradingAgents](https://github.com/tauricresearch/tradingagents) | 多 Agent LLM 交易框架（学术） | 低。偏向研究，无可视化 |
| [ai-hedge-fund-crypto](https://github.com/51bitquant/ai-hedge-fund-crypto) | 多 Agent 加密对冲基金 | 中。多 Agent 协作思路可参考 |
| [FinRL](https://github.com/AI4Finance-Foundation/FinRL) | 深度强化学习交易框架 | 低。纯 RL，无 LLM 集成 |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | 开源投资研究终端 | 中。可作为数据源接入 |

---

## 总结：Eous 的差异化路径

综观所有参考项目，Eous 的独特定位变得清晰：

```
        计算密集                         决策密集
         ←───────────→                  ←───────────→

Qlib ────────●                              ○ 
               │                              │
FinRL ────────●                              ○
               │                              │
comfyTrade ───●────────────●                  ○
               │            │                  │
TradingGoose  ○            ●──────────────────●
               │            │                  │
TradingAgents ○                            ●──●
               │                               │
Eous           ○────────────●──────────────────●
                            │
                     节点编排层
                   （定义 Agent 逻辑）
```

Eous 的核心差异：
1. **Agent 逻辑可视化编排**：不是写代码定义策略，是画图定义 Agent 的执行流程
2. **LLM 在 DAG 中自由流动**：LLM 的输入输出和其他节点平权，可以出现在任何位置
3. **不绑定交易**：交易信号只是输出的一种，分析报告、策略参数优化同样是一等公民
4. **可观察性优先**：每个节点的输入输出对用户透明，Agent 不再是不透明的黑箱
