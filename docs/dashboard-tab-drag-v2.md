# Dashboard Tab 栏拖拽 + CSS 修复（v2）

## 背景

v1（`dashboard-tab-kline-v1.md`）已实现多 Tab 化 + K Line 接入 + 死循环 / react-dnd 类型错误的两个回归修复。在 v1 验收过程中提出两个新需求：

1. **Tab 栏拖拽语义不对**：现在拖 tab 标签 = 拖整个 panel；正确语义应该是拖单个 tab
2. **按钮跑到左边**：tab 栏右侧的 + 按钮和 ToolbarControls 被 flex 布局挤到左边

v2 在 v1 基础上扩展，实现 tab 拖拽行为 + 修复 CSS bug。

## 范围

- v2 仅处理 tab 拖拽行为和 CSS 修复，不动 v1 已定型的功能
- v1 里"移除 tab 激活策略"（前一个优先 vs 原位置优先）的差异本次不处理

## v2 改动

### 1. Tab 标签的拖拽行为（核心新增）

**tab 标签** 作为独立 dnd source，拖拽单个 tab：

- 拖到**目标 panel 的 tab 栏**上 → **移动**该 tab（从原 panel 移除，加到目标 panel 的拖入位置）
- 拖到**当前 panel 自己的 tab 栏**里（tab 之间） → **同 panel 内重排序**
- 拖到 **mosaic 空白处**（既不是 panel 也不是 tab 栏） → **拆分 panel**：
  - 原 panel 和新 panel 50/50 拆分
  - 拖出的 tab 移到新 panel 并自动激活
  - 原 panel 保留其他 tab，激活策略同 v1 移除规则（这里指的是：拆出后原 panel 仍有 tab 时，激活相邻 tab；都没有则空态）

**激活策略**：被移动 / 重排序 / 拆出的 tab 移到新位置后自动激活。其他 tab 状态不变。

**header 别处**（tab 栏非 tab 标签区域，如 tab 栏背景、tab 栏右侧按钮区）保持原 react-mosaic-component 的 panel 拖拽行为不变 —— 拖整个 panel。

**tab 栏右侧按钮**（+ 添加按钮、ToolbarControls 里的分割/展开/关闭）不应该触发任何拖拽行为（既不是 tab 拖也不是 panel 拖）。

### 2. CSS 修复：tab 栏右侧按钮跑到左边

**症状**：tab 栏的 + 按钮和 ToolbarControls 跑到 tab 栏最左边，而不是最右端。
**约束**：按钮必须保持在 tab 栏最右端，跟 tab 列表分离；tab 列表靠左铺开。

## 持久化约束

- 跨 panel 移动 / 同 panel 重排序 / 拆分都要触发 workspace store 的脏标记（dirty = true）
- 拆分产生的 panel id 走 mosaic 现有的 createNode 逻辑（生成新 id）
- 拆分 / 移动的状态持久化进 layout 的 schemaJson

## 不在范围内

- tab 复制（v2 仅移动）
- 自定义拆分比例（固定 50/50）
- 跨 layout 拖 tab
- v1 里"移除 tab 激活策略"的差异（保留 Claude v1 实现 = 原位置优先）

## 验收标准

- 启动 Dashboard，看到初始 MosaicWindow
- **拖拽验证**：
  - 拖 tab 标签到另一个 panel 的 tab 栏 → tab 移动到目标 panel，原 panel 少一个；移动后被移动的 tab 在新位置自动激活
  - 拖 tab 标签到同 panel 的 tab 栏里另一位置 → tab 重排序
  - 拖 tab 标签到 mosaic 空白处 → 拆出 50/50 两个 panel，新 panel 装载该 tab 并自动激活
  - 拖 tab 栏的非 tab 标签区域（如 tab 栏背景） → 拖整个 panel（沿用 react-mosaic-component 原行为）
  - 拖 tab 栏右侧按钮（+、ToolbarControls 内部按钮）→ 不触发任何拖拽
- **CSS 验证**：
  - tab 栏右侧的 + 按钮和 ToolbarControls 保持在最右端
  - tab 列表靠左铺开，flex 布局正常
- 移动 / 重排序 / 拆分后：
  - 切 layout、刷新页面后状态保留
  - 脏标记流程正常工作

## 现状参考（仅上下文，不约束实现）

- 当前 tab 栏实现：`apps/web/src/components/dashboard/tab-bar.tsx`、`tab-container.tsx`
- 上一轮 react-dnd 修复：`apps/web/src/pages/(auth)/dashboard/page.tsx` 的 `renderToolbar`（用 `<div className="h-full">` 包 TabBar，div 缺少 `w-full` 可能是按钮跑到左边的根因之一，自己查）
- 现有 store 操作：`apps/web/src/stores/workspace.ts` 已有 `addPanelTab / removePanelTab / setActivePanelTab / setPanelTabComponent`，需要新增跨 panel 移动 / 重排序 / 拆分 相关操作（实现者决定 store API 形态）
- 现有面板拆分机制：MosaicWindow 的 `createNode` prop 走 react-mosaic-component 内置逻辑，可参考 `page.tsx` 里 `handleAddPanel` 的实现思路
- v1 PRD：`docs/dashboard-tab-kline-v1.md`
