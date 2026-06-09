# Dashboard 多 Tab 化重构 + K Line 接入（v1）

## 背景
Dashboard 当前只实现了 Mosaic 布局，每个面板是 `PlaceholderPanel`（占位"Panel content coming soon"）。需要：
1. 把每个 MosaicWindow 改造为多 Tab 容器，由 Tab 栏替代现有 title bar
2. 引入统一的"组件选择网格"（4 列一行的按钮组）作为组件入口
3. 把 K Line 组件接入，作为第一个可装载的组件

## 范围
- 本次只接 K Line 一个组件
- 组件选择网格暂时只放 K Line，但 UI 形态和代码结构要预留扩展位（后续新增组件时改动最小）
- 不动 MosaicWindow 周边布局（用户表示"布局功能可能还会调整"）

## UX 规范

### 1. Tab 栏（替换 MosaicWindow 现有 title bar）
MosaicWindow 自带的 title bar 不再显示（不展示 panel id），由新 Tab 栏替代。

Tab 栏结构（从左到右）：
- 左侧：Tab 标签列表（标签显示装载的组件名，如 "K Line"）
- 右侧：单个"添加"按钮（+）

初始无 tab 时，Tab 栏左侧为空，只显示右侧"添加"按钮。

### 2. 添加按钮
点击"添加"按钮 → 弹出"添加浮层"：
- 4 列一行的组件按钮网格（与编辑浮层同款）
- 不含"移除"按钮
- 点击组件 → 新增一个 tab，装载该组件并自动激活 → 浮层关闭

### 3. Tab 内容区右上角浮层
每个 tab 内容区右上角有一个 "+" 图标按钮（与 tab 栏右侧添加按钮同图标，区分靠位置：tab 栏右侧的 + 管 tab 数量，tab 内容区内的 + 管 tab 内组件）。

点击触发 → 弹出"编辑浮层"：
- 4 列一行的组件按钮网格（点击 → 切换当前 tab 内的组件，浮层关闭）
- 浮层右下角："移除"按钮
  - 点击 → 移除当前 tab
  - 移除后激活策略：优先激活前一个 tab，没有则激活后一个 tab，都没有则回到初始空态
  - 移除不可撤销，不弹确认
- 切到同组件（如 K Line → K Line）时无副作用，不刷新状态、不报错

### 4. 初始空态（区块内无任何 tab）
MosaicWindow 内容区中央：
- 一句引导提示文字
- 提示下方直接展示 4 列一行的组件按钮网格（与添加浮层同款）
- 点击按钮 → 立即创建第一个 tab 并激活
- 此时的"添加"按钮也可点（点击效果同上）

### 5. K Line 接入
- K Line tab 渲染 `<KlineChart>` 组件
- watchlist 页面已有完整的 `fetchKlines / getSymbols / getIntervals / getProviders` 包装，Dashboard 复用这套接口（是否抽公共 hook 或 lib 由实现者决定）
- KlineChart 自带选标的 UI，Dashboard 不传 `defaultSymbol` / `defaultInterval`，保持默认空

## 持久化约束
- 布局与 tab 状态需要持久化到 workspace layout 的 `schemaJson`
- 现有 `MosaicNode<string>` 只承载 string id 的结构不足以表达"多 tab + 组件类型"，需扩展为能承载 tab 列表、激活 tab、组件类型等信息的结构
- **不向后兼容**：旧 `schemaJson` 直接清空，用新结构重新初始化（不迁移旧 panel 数据）

## 行为约束
- 添加/删除/切换 tab、切换组件都要触发 workspace store 的脏标记（dirty = true）
- 切 layout 时的"有未保存更改"提示继续工作
- K Line 加载失败按 KlineChart 既有行为处理，Dashboard 不再额外加错误 UI

## 不在范围内
- MosaicWindow 周边布局调整
- 多 tab 之间的状态共享
- 除 K Line 之外的其他组件接入（网格暂时只放 K Line）
- tab 拖拽排序
- 移除 tab 的二次确认

## 验收标准
- 启动 Dashboard：看到初始 MosaicWindow
- MosaicWindow 顶部 Tab 栏只显示右侧"添加"按钮，左侧空
- MosaicWindow 中央显示引导提示 + 4 列一行的组件按钮网格（仅"K Line"）
- 点击 K Line 按钮 → 出现一个 tab（标签"K Line"），渲染 K Line 组件
- 加载一个有旧 schemaJson 的 layout → 自动清空，回到新结构默认状态
- 在 K Line tab 内容区右上角点击浮层触发按钮 → 弹出编辑浮层：4 列网格（仅 K Line）+ 右下角"移除"按钮
- 点击 4 列网格中的 K Line → tab 内容无变化（K Line → K Line，无副作用）
- 点击"移除" → tab 消失，回到空态
- 点击"添加"按钮 → 弹出添加浮层：4 列网格（无移除按钮）→ 点击 K Line → 新增第二个 tab，自动激活
- 多 tab 时移除一个 tab → 激活相邻 tab（前优先，后其次）
- 切 layout、刷新页面后 tab 状态保留
- 脏标记、保存流程正常工作

## 现状参考（仅上下文，不约束实现）
- Dashboard 页面：`apps/web/src/pages/(auth)/dashboard/page.tsx`
- Dashboard 组件目录：`apps/web/src/components/dashboard/`（`PlaceholderPanel / WelcomeContent / ZeroState / ToolbarControls`）
- Workspace store：`apps/web/src/stores/workspace.ts`，已定义 `PanelDef { id, title, component }`、`layouts[]`、当前 `MosaicNode<string>` layout
- K Line 接口包装参考：`apps/web/src/pages/(auth)/watchlist/page.tsx`（`fetchKlines / getSymbols / getIntervals / getProviders` 的完整 `useMemo` 实现）
- K Line 组件：`@eous/chart` 的 `KlineChart`，props 见 `packages/chart/src/types.ts`
