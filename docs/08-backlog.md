# Backlog

这是合并后的候补需求池。已在路线图中明确的进行中事项不重复展开；这里保留尚未进入稳定实施的能力。

## 数据源

- 对接东方财富、同花顺。
- 对接 Polygon.io、Wind、Bloomberg。
- 链上数据源：Glassnode、Dune、The Graph。
- 新闻数据源：NewsAPI、Bing News、RSS、交易所公告。
- 历史数据本地缓存、回放和缺口补齐。
- Provider 代理、限流、重试和健康状态展示。

## 标的管理

- 标的详情页：概览、K 线、新闻、分析历史。
- 价格提醒：突破/跌破阈值、指标触发。
- 标的分组和自定义字段。
- 多标的 watchlist 行情实时刷新。
- 标的关联图谱：供应链、竞争对手、行业/主题。

## Workflow

- Loop 节点：子 DAG、`maxRounds`、`exitCondition`、上一轮输出引用。
- Merge 节点：等待多个上游后继续。
- Sub-workflow 节点。
- Compute 节点：技术指标、因子、表达式、Python/JS 沙箱。
- Output 节点：图表、报告、通知。
- 工作流模板、导入导出、复制。
- 工作流版本 diff。
- 条件触发执行：价格、新闻、时间、Webhook。
- 节点执行缓存策略 UI。
- 完整 execution 表和执行详情页。
- 执行事件实时推送。

## Agent

- Tool calling：查看 K 线、搜索新闻、运行 Workflow、读取 watchlist、保存 Memory。
- Agent 分屏视图。
- Agent 创建/编辑 Workflow 的 MCP tools。
- `agent.call` 节点。
- 多 Agent 协作、辩论、投票。
- Agent 主动推送异常信号。
- Memory 自动摘要、结构化提取、检索增强、遗忘。
- Tool 权限、审计和用户确认。

## 视图

- 新闻列表和新闻情绪标注。
- Markdown 报告渲染。
- 通用数据表格。
- 因子热力图。
- 策略回测绩效报告。
- 资金流向视图。
- 多标的 K 线对比。

## 模型与回测

- 模型训练节点：LightGBM、XGBoost 等。
- 模型仓库：保存、版本、加载。
- 模型推理节点。
- 回测节点和绩效指标。
- 超参搜索：网格搜索、贝叶斯优化。
- 特征工程节点。

## 输出与通知

- 邮件报告。
- Webhook。
- Telegram、Discord、微信。
- 日报/周报自动生成与发送。
- CSV、JSON、PDF 导出。

## 系统

- 多用户协作。
- 审计日志。
- 国际化。
- 移动端适配。
- Electron 桌面壳。
- 权限模型和共享链接。
