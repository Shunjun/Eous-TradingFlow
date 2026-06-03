# K 线图表组件（@eous/chart）

独立包，基于 Lightweight Charts v5，提供 K 线渲染、技术指标叠加、画线工具。Watchlist、Dashboard 等页面通过引入 `KlineChart` 组件即可使用。

## 1. 架构总览

```
packages/chart/src/
├── core/                         # 引擎层（非 React，纯类）
│   ├── event-bus.ts              # 类型安全的事件总线
│   ├── kline-data.ts             # 数据权威源，fetch + 广播
│   ├── chart-engine.ts           # 图表渲染引擎
│   ├── indicator-engine.ts       # 指标计算与渲染引擎
│   └── line-tools-engine.ts      # 画线工具引擎
│
├── indicators/                   # 指标系统
│   ├── sma/                      # 每个指标独立文件夹
│   │   ├── definition.ts         # 元信息 + calculate + SettingsComponent
│   │   ├── calculator.ts         # 对接第三方库的计算逻辑
│   │   └── settings.tsx          # 指标专属设置 UI
│   ├── ema/
│   ├── macd/
│   ├── rsi/
│   ├── bollinger-bands/
│   ├── types.ts                  # IndicatorDefinition 等类型
│   └── registry.ts               # 注册表
│
├── line-tools/                   # 画线工具
│   ├── trend-line/
│   ├── horizontal-line/
│   ├── ray/
│   ├── rectangle/
│   ├── types.ts
│   └── registry.ts
│
├── components/                   # React UI 层
│   ├── kline-chart.tsx           # 主组件，三栏布局
│   ├── chart-toolbar.tsx         # 顶部工具栏
│   ├── line-tools-sidebar.tsx    # 左侧画线工具按钮栏
│   ├── indicator-panel.tsx       # 右侧指标面板
│   ├── symbol-selector.tsx       # 标的选择弹窗（Phase 4A）
│   └── interval-selector.tsx     # 时间区间选择器（Phase 4A）
│
├── hooks/
│   ├── use-chart.ts              # 统一 Hook，创建并管理所有引擎
│   └── use-resolved-theme.ts     # 从 DOM CSS 变量解析主题
│
├── utils/
│   ├── interval.ts               # 区间字符串解析
│   └── color.ts                  # 颜色工具
│
├── types.ts                      # 公开类型定义
└── index.ts                      # 包入口（只导出公开 API）
```

**分层原则**：引擎层不依赖 React，数据流通过 EventBus 解耦。React 层只负责 UI 交互、主题同步、持久化配置。

## 2. 数据流

```
React Component
  │
  ├─ loadKlines(fetchFn, symbol, interval)
  │     │
  │     ▼
  │  KLineData.fetch()
  │     │
  │     ▼ (数据就绪)
  │  eventBus.emit('data:updated', { klines, fit })
  │     │
  │     ├──→ ChartEngine.setData()
  │     │       └── candleSeries.setData() + volumeSeries.setData()
  │     │
  │     └──→ IndicatorEngine.recomputeAll()
  │             └── klineData.getCloses()
  │             └── definition.calculate(closes, params)
  │             └── series[i].setData(data[i])
  │
  ├─ addIndicator(config)
  │     └── IndicatorEngine.addIndicator()
  │
  ├─ toggleDrawingTool(type)
  │     └── LineToolsEngine.setActiveTool()
  │
  └─ updateTheme(theme)
        └── klineData.updateTheme()
              └── eventBus.emit('theme:changed')
                    ├──→ ChartEngine.applyTheme()
                    └──→ IndicatorEngine → (指标系列颜色由配置决定)
```

**关键设计决策**：

- `KLineData` 是数据唯一权威源，不直接依赖任何引擎
- `EventBus` 作为注入的共享实例，生产者（KLineData）和消费者（ChartEngine、IndicatorEngine）通过它解耦
- `IndicatorEngine` 持有 `klineData` 引用，`recomputeAll()` 时通过 `getCloses()` 实时拉取最新收盘价，零同步成本
- `LineToolsEngine` 不通过 EventBus 通信，直接通过 React state 管理选中态

## 3. 引擎层

### 3.1 EventBus

```typescript
class EventBus {
  on<K>(event: K, handler: Handler<ChartEvents[K]>): () => void  // 返回取消订阅函数
  emit<K>(event: K, payload: ChartEvents[K]): void
  destroy(): void
}

interface ChartEvents {
  'data:updated':  { klines: KlineDataPoint[]; fit: boolean }
  'theme:changed': { theme: ChartTheme }
}
```

### 3.2 KLineData

数据获取与管理。构造函数接收 `(eventBus, theme)`。

| 方法 | 说明 |
|------|------|
| `loadInitial(fetchFn, symbol, interval)` | 首次加载，fitContent |
| `switchInterval(fetchFn, symbol, interval)` | 切换周期，fitContent |
| `loadEarlier(fetchFn, symbol, interval, oldestTimestamp)` | 无限滚动加载更早数据，保持视口 |
| `getCloses()` | 返回 `{ time, close }[]`，供指标计算 |
| `updateTheme(theme)` | 更新主题，emit theme:changed |

数据加载完成后通过 `eventBus.emit('data:updated', { klines, fit })` 广播。

### 3.3 ChartEngine

图表渲染。构造函数接收 `(container, eventBus, klineData, theme)`。

- 监听 `data:updated` → 解析 OHLCV + 成交量 → `setData`
- 监听 `theme:changed` → `applyTheme`
- `resize()` 配合 ResizeObserver
- `destroy()` 取消事件订阅 + 移除 chart 实例

### 3.4 IndicatorEngine

指标生命周期管理。构造函数接收 `(eventBus, klineData, chart, candleSeries)`。

- 监听 `data:updated` → 自动 `recomputeAll()`
- 每个指标实例对应一个或多个 lightweight-charts series
- overlay 模式：series 附加到主 pane（pane 0），**与蜡烛共享 price scale**
- split 模式：创建独立 pane，各 series 可有独立 price scale
- `moveUp/moveDown` 通过 `swapPanes` 实现 pane 排序

### 3.5 LineToolsEngine

画线工具。构造函数接收 `(chart, candleSeries)`，不依赖 EventBus。

- 基于 `lightweight-charts-line-tools-core` 的 plugin 系统
- `setActiveTool(type)` 激活/取消工具
- `deleteSelected()` 删除选中画线
- `onSelectionChange(handler)` 通知 React 选中态变化

## 4. 指标系统

### 4.1 指标定义约定

每个指标导出一个工厂函数，返回 `IndicatorDefinition`：

```typescript
interface IndicatorDefinition {
  type: string
  label: string
  category: 'trend' | 'oscillator'
  defaultParams: Record<string, number>
  paramConfig: ParamConfig[]          // 参数元信息，驱动设置 UI
  defaultMode: 'overlay' | 'split'
  calculate: (closes, params) => IndicatorOutput
  seriesCount: number                 // 该指标需要几个 series
  seriesTypes: ('Line' | 'Histogram')[]
  defaultColors: string[]
  seriesLabels?: string[]
  SettingsComponent: React.ComponentType<IndicatorSettingsProps>
}
```

### 4.2 新增指标步骤

1. 在 `indicators/` 下新建文件夹，创建 `calculator.ts`、`definition.ts`、`settings.tsx`
2. 在 `registry.ts` 中 import 并注册
3. 无需修改引擎代码

### 4.3 计算库

当前使用 `technicalindicators`（npm），26 个内置指标，同步计算，浏览器可直接使用。各指标的 `calculator.ts` 可独立选择不同库。

### 4.4 设置 UI

右侧面板中的 `SettingsComponent` 接收：

```typescript
interface IndicatorSettingsProps {
  config: IndicatorConfig       // 当前配置
  onUpdate: (updates) => void   // 更新参数/颜色
  onRemove: () => void          // 删除指标
}
```

## 5. 画线工具系统

### 5.1 工具定义

```typescript
interface LineToolDefinition {
  type: LineToolType
  label: string
  icon: LucideIcon
  register: (plugin: ILineToolsPlugin) => void
}
```

### 5.2 已实现的工具

| 工具 | 来源 |
|------|------|
| 趋势线 (TrendLine) | lightweight-charts-line-tools-lines |
| 水平线 (HorizontalLine) | lightweight-charts-line-tools-lines |
| 射线 (Ray) | lightweight-charts-line-tools-lines |
| 矩形 (Rectangle) | lightweight-charts-line-tools-rectangle |

## 6. UI 布局

### 6.1 整体结构（Phase 4 完成后）

```
┌──────────────────────────────────────────────────────┐
│  ChartToolbar                                        │
│  [标的] │ [时间区间选择器] │ [+ 指标]                  │
├─────┬──────────────────────────────────┬─────────────┤
│ 左  │                                  │ 右          │
│ 侧  │         K 线图                    │ 侧          │
│ 工  │                                  │ 面          │
│ 具  │    ┌──────────────────┐          │ 板          │
│ 栏  │    │ 指标悬浮图例      │          │ (可拖拽     │
│     │    │ SMA(20)  102.5   │          │  宽度)      │
│     │    │ EMA(12)  101.2   │          │             │
│     │    └──────────────────┘          │             │
├─────┴──────────────────────────────────┴─────────────┤
└──────────────────────────────────────────────────────┘
```

### 6.2 工具栏按钮样式

- 默认：文字 `text-muted-foreground`，无背景
- hover：`bg-muted/50`
- 选中：`bg-primary/15 text-primary`

### 6.3 标的选择弹窗

从上到下：搜索框 → Provider 选择栏 → 标的列表。点击标的切换图表。

### 6.4 时间区间选择器

三种状态：常态（默认常用区间）→ "+" 展开浮窗（剩余区间）→ 编辑模式（拖拽调整顺序和显隐）。配置持久化到用户设置，不与标的绑定。

## 7. 持久化

| 数据 | 存储 | 说明 |
|------|------|------|
| 指标配置（按标的） | `useIndicatorStore` (Zustand) | `endpoint: /api/indicators`，按 `symbol` 分组 |
| 工作台布局 | `useWorkspaceStore` (Zustand) | `endpoint: /api/workspace` |
| 时间区间偏好 | 待实现 (Phase 4A) | 图表查看器级别，不随标的切换 |

## 8. 依赖

| 包 | 用途 |
|---|------|
| `lightweight-charts` ^5.0.0 | K 线图表渲染 |
| `lightweight-charts-line-tools-core` | 画线工具插件核心 |
| `lightweight-charts-line-tools-lines` | 趋势线/水平线/射线 |
| `lightweight-charts-line-tools-rectangle` | 矩形工具 |
| `technicalindicators` | 技术指标计算 |
| `@eous/stores` | 指标配置持久化 |
| `@eous/ui` | shadcn 组件 |
| `lucide-react` | 图标 |
| `zustand` ^5.0.0 | 状态管理 |
