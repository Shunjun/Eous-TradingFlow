# UI Design System

Eous TradingFlow 的视觉设计规范与组件库指南。

## 设计原则

1. **Line-art first** — 1px 边框构成骨架，hover 时填充色块。不依赖厚重阴影区分层级
2. **Orange accent, restrained use** — 主色 `hsl(25,95%,53%)` 仅用于交互反馈和状态指示，不做大面积填充
3. **Monospace labels, sans-serif body** — 数据、标签、代码用等宽字体；正文、描述用无衬线字体
4. **Dot as status, not decoration** — 橙色圆点仅用于表示状态（运行中、活跃、通知），不作为装饰元素
5. **Consistent spacing rhythm** — 组件间距使用 Tailwind 的 `space-y-*` / `gap-*`，遵循 4px 基数

---

## 编码规范

### 颜色

禁止在任何组件中硬编码颜色值（如 `hsl(25,95%,53%)`、`#ff6600`）。所有颜色必须使用 Tailwind 的 CSS 变量 utility：

| 用途 | 正确写法 |
|------|----------|
| 主色填充 | `bg-primary` |
| 主色文字 | `text-primary` |
| 主色边框 | `border-primary` |
| 主色透明度 | `bg-primary/10`、`border-primary/40` |

语义状态色（`emerald-500`、`red-400`、`purple-400`）保留不变。

### 尺寸

优先使用 Tailwind 内置尺寸（`w-4`、`h-5`、`p-2`）。禁止无必要的任意值（`w-[37px]`）。

以下情况允许任意值：
- `text-[9px]` / `text-[10px]` / `text-[11px]`：mono 微文字，超出 Tailwind scale
- `max-w-[1400px]`：固定布局宽度
- `tracking-[0.2em]`：设计规范要求的特殊字间距

---

## 色彩体系

所有颜色定义在 `packages/tailwind/src/globals.css` 的 `@theme inline` 块中。

### Dark Theme (default)

| Token | HSL | 用途 |
|---|---|---|
| `--background` | `20 10% 6%` | 页面背景，温暖深色 |
| `--foreground` | `40 15% 90%` | 主要文字 |
| `--card` | `20 10% 8%` | 卡片/Sidebar 背景 |
| `--muted` | `20 8% 12%` | 次要背景、hover 状态 |
| `--muted-foreground` | `40 10% 55%` | 次要文字、标签 |
| `--border` | `20 8% 18%` | 边框、分割线 |
| `--primary` | `25 95% 53%` | 主色橙色，交互反馈 |
| `--ring` | `25 95% 53%` | Focus ring |

### Light Theme

| Token | HSL | 用途 |
|---|---|---|
| `--background` | `40 20% 98%` | 页面背景，温暖米色 |
| `--foreground` | `20 15% 8%` | 主要文字 |
| `--muted-foreground` | `20 10% 45%` | 次要文字 |

### 语义色

直接在组件中使用 Tailwind 的 HSL 值，不引入额外 token：

- **Running / Active**: `hsl(25,95%,53%)` — 橙色
- **Success / Completed**: `hsl(160,84%,39%)` / Tailwind `emerald-500`
- **Error / Failed**: `hsl(0,91%,71%)` / Tailwind `red-400`
- **Idle**: `muted-foreground`

---

## 字体

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;600;700&display=swap')
```

| 场景 | 字体 | class |
|---|---|---|
| 标签、数据、代码、状态 | JetBrains Mono | `font-mono` |
| 正文、标题、描述 | DM Sans | `font-sans`（默认） |

---

## 组件目录

所有组件位于 `packages/ui/src/components/ui/`，遵循 shadcn/ui 模式：

- `cn()` 合并 className（`clsx` + `tailwind-merge`）
- `React.forwardRef` + `displayName`
- CVA 处理多变体
- className override: `cn(baseClasses, className)`

### Dot

状态指示圆点。

```tsx
import { Dot } from '@eous/ui'

<Dot size="sm" variant="pulse" />        // 默认：小号脉冲
<Dot size="xs" variant="glow" />         // 极小号发光
<Dot size="md" variant="breath" />       // 中号呼吸
<Dot size="lg" variant="static" />       // 大号静态
```

| Prop | Values | Default |
|---|---|---|
| `size` | `xs` `sm` `md` `lg` | `sm` |
| `variant` | `static` `pulse` `breath` `glow` | `pulse` |

**使用场景**：Sidebar 当前页指示、通知铃铛、Workflow 运行状态、Execution log running。

**不要**：作为装饰性元素到处添加。

### IconBox

统一的图标容器：圆角 + 边框，hover 时边框变主色。

```tsx
import { IconBox } from '@eous/ui'

<IconBox size="md">
  <GitBranch size={14} className="text-muted-foreground" />
</IconBox>

<IconBox size="sm" interactive={false}>
  <Search size={14} />
</IconBox>
```

| Prop | Values | Default |
|---|---|---|
| `size` | `sm` `md` `lg` | `md` |
| `interactive` | `boolean` | `true` |

**替换**：所有 `div` + `rounded border` + `hover:border-[hsl(...)]` 模式。

### StatusBadge

状态指示 pill，组合 Dot 组件。

```tsx
import { StatusBadge } from '@eous/ui'

<StatusBadge status="running" label="Running" />
<StatusBadge status="completed" label="Completed" />
<StatusBadge status="failed" label="Failed" />
<StatusBadge status="idle" label="Idle" />
```

| Prop | Values |
|---|---|
| `status` | `running` `completed` `success` `failed` `error` `idle` |
| `label` | `string` |
| `showDot` | `boolean` (default `true`) |

### CardPanel

带标题头的列表容器。

```tsx
import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'

<CardPanel>
  <CardPanelHeader icon={Workflow} title="Recent Workflows" action={{ label: 'View all' }} />
  <CardPanelBody>
    {/* rows */}
  </CardPanelBody>
</CardPanel>
```

| Component | Props |
|---|---|
| `CardPanel` | `className` |
| `CardPanelHeader` | `icon?`, `title`, `action?: { label: ReactNode, onClick? }` |
| `CardPanelBody` | `className` |

### DataRow

通用列表行：leading + content + trailing。

```tsx
import { DataRow } from '@eous/ui'

<DataRow
  leading={<IconBox size="md"><GitBranch size={14} /></IconBox>}
  trailing={<StatusBadge status="running" label="Running" />}
>
  <p className="text-sm font-medium">Workflow Name</p>
  <p className="font-mono text-[10px] text-muted-foreground">8 nodes · 2 min ago</p>
</DataRow>
```

**替换**：WorkflowRow、WatchlistRow、ExecutionLog 等重复行布局。

### MetricCard

指标展示卡片。

```tsx
import { MetricCard } from '@eous/ui'

{/* Dashboard 样式 */}
<MetricCard label="Workflows" value="12" change="+2 this week" icon={GitBranch} trend="up" />

{/* Compact pill 样式 */}
<MetricCard label="Node Types" value="8+" variant="compact" />
```

| Prop | Values | Default |
|---|---|---|
| `variant` | `default` `compact` | `default` |
| `trend` | `up` `down` `neutral` | — |

### SectionHeader

橙色线条 + mono 标签 + 标题，用于 section 分隔。

```tsx
import { SectionHeader } from '@eous/ui'

<SectionHeader
  label="Capabilities"
  heading="Everything you need."
  headingAccent=" Nothing you don't."
  description="Three pillars that make Eous different."
/>
```

| Prop | Required |
|---|---|
| `label` | yes |
| `heading` | yes |
| `headingAccent` | no — 次要文字追加到 heading 后 |
| `description` | no |

### Button

已有的 shadcn Button，新增两个变体：

```tsx
import { Button } from '@eous/ui'

<Button variant="glow">Start Building</Button>       // 橙色填充 + glow 阴影
<Button variant="accent-outline">Get Started</Button> // 透明背景，hover 边框变橙
<Button variant="ghost-icon">
  <Settings size={16} />
</Button>                    // 透明背景方形图标按钮，hover 切换为橙色
```

| 变体 | 说明 | 典型场景 |
|------|------|----------|
| `ghost-icon` | 透明背景方形图标按钮，hover 切换为橙色 | Header 图标按钮 |

---

## 新增组件指南

### 命名

- 文件名：`kebab-case.tsx`（如 `data-row.tsx`）
- 组件名：`PascalCase`（如 `DataRow`）
- 导出名与组件名一致

### 构建模式

1. 优先使用 CVA 定义变体（2+ 种样式时）
2. 单一样式直接用 `cn()` 拼接
3. 复合组件（如 CardPanel）用独立文件 + barrel export
4. 必须 `React.forwardRef` + `displayName`
5. 必须支持 `className` override：`cn(baseClasses, className)`

### 颜色使用

- 状态色直接用 Tailwind 类：`text-emerald-500`、`text-red-400`
- 主色交互用 HSL 值：`border-[hsl(25,95%,53%/0.4)]`、`bg-[hsl(25,95%,53%/0.06)]`
- 不要新增 CSS 变量，除非是全新的语义场景

### 导出

在 `packages/ui/src/index.ts` 中添加导出，包括组件和类型：

```ts
export { MyComponent } from './components/ui/my-component'
export type { MyComponentProps } from './components/ui/my-component'
```

### 测试

新增组件后确保：
1. `pnpm --filter @eous/ui build` 通过
2. `pnpm turbo run build` 全量构建通过
3. 在 web 或 docs 中实际使用验证渲染正确
