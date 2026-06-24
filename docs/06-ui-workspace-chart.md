# UI、工作区与图表

## Console Shell

前端主布局位于 `apps/web/src/components/layout`：

- `console-layout.tsx`
- `header.tsx`
- `sidebar.tsx`

认证后页面都嵌在 Console shell 内。Sidebar 当前结构：

```text
EOUS
OVERVIEW
  Home
  Dashboard
  Watchlist
  News Feed
BUILD
  Agents
  Datasets
WORKFLOWS
  新建工作流
  workflow list
footer
  Settings
  theme / notification / logout 等操作
```

Workflow 列表直接显示在 Sidebar 中；当前没有 `/workflows` 列表页面入口。

## Workspace

工作区实现位于 `apps/web/src/components/workspace-layout`，底层使用 Dockview。

主要文件：

| 文件                           | 说明                               |
| ------------------------------ | ---------------------------------- |
| `workspace-layout.tsx`         | Dockview 容器、restore/save layout |
| `workspace-panel.tsx`          | panel 内容渲染                     |
| `workspace-tab.tsx`            | tab 渲染                           |
| `workspace-header-actions.tsx` | tab/header 右侧操作                |
| `component-grid.tsx`           | 添加组件选择网格                   |
| `panel-utils.ts`               | 添加 panel 工具                    |
| `types.ts`                     | panel/component 类型               |

布局状态由 `apps/web/src/stores/dashboard-layout.ts` 管理，并通过 `/api/workspace/layouts` 持久化到 `workspace_layouts.schema_json`。

当前可装载视图在 `apps/web/src/components/views`：

- `kline`
- `workflow`

## K 线视图与 `@eous/chart`

`packages/chart` 是可复用 K 线组件包，入口导出 `KlineChart`。

核心结构：

```text
packages/chart/src/
  core/
    event-bus.ts
    kline-data.ts
    chart-engine.ts
    indicator-engine.ts
    line-tools-engine.ts
  components/
    chart-toolbar.tsx
    line-tools-sidebar.tsx
    indicator-config-panel.tsx
    indicator-legend.tsx
    symbol-selector.tsx
  indicators/
    registry.ts
  line-tools/
    registry.ts
  stores/
    chart-provider.tsx
    chart-store.ts
    interval-settings-store.ts
```

当前能力：

- K 线和成交量渲染。
- 标的选择、周期选择。
- 指标系统，基于 `technicalindicators`。
- 画线工具：趋势线、水平线、射线、矩形。
- 主题解析与响应式 resize。
- 图表配置和画线保存对接 server API。

数据流：

```text
KlineChart
  -> fetchFn / data source API
  -> KLineData
  -> EventBus data:updated
  -> ChartEngine / IndicatorEngine
```

## UI Design System

`packages/ui` 采用 shadcn-style 源码组件和 Tailwind CSS v4 token。

主题定义在 `packages/tailwind/src/globals.css`。设计原则：

- 以 1px line-art、边框和 hover 填充建立层级。
- 主色橙色只用于交互反馈和状态，不做大面积装饰。
- 数据、标签、代码优先 `font-mono`；正文使用 `font-sans`。
- 状态用 Dot/Badge 表达，不用装饰点。
- 间距遵循 Tailwind 4px rhythm。

常用组件：

- `Button`
- `Badge`
- `CardPanel`
- `DataRow`
- `Dot`
- `IconBox`
- `MetricCard`
- `SectionHeader`
- `StatusBadge`
- `Sidebar`
- `Dialog`
- `Select`
- `Tabs`
- `Tooltip`

编码约束：

- 主色使用 `bg-primary`、`text-primary`、`border-primary`、`bg-primary/10` 等 token utility。
- 不在组件里硬编码主色 HSL。
- 状态色可使用 Tailwind 语义色，如 `text-emerald-500`、`text-red-400`。
- 新组件必须支持 `className` override，并从 `packages/ui/src/index.ts` 导出。

## 已合并的历史需求

以下历史 PRD 的有效规则已合并到本文件或当前实现中：

- Dashboard 多 Tab 化和 K Line 接入。
- Dashboard Tab 拖拽/CSS 修复。
- Sidebar Settings footer 与 Workflow 列表直出。

这些不再作为独立当前文档维护。
