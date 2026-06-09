# 侧边栏改造：Settings 移至 Footer + 工作流列表直接展示

## 背景
当前侧边栏 `apps/web/src/components/layout/sidebar.tsx` 把所有导航条目都铺在 `SidebarContent` 的分组里，Settings 和 Workflows 都被当作普通条目，存在两个产品上的别扭：

1. **Settings 与导航条目混在一起**：设置是面向"人/账户/系统"的事，跟"工作区导航"是不同语义层级，更适合放在 footer
2. **Workflows 只剩一个入口**：工作流是用户最常用的对象（v2 的节点化执行引擎落地后尤其如此），但用户要先点进 `/workflows` 才能看到/进入具体的工作流，路径太长；侧边栏里只显示一个 `Workflows` 入口 + `badge: '3'` 是浪费空间

## 目标态
改造后的侧边栏（**展开态**）大致形态：

```
EOUS (header)
─────────────────────────
OVERVIEW
  Home
  Dashboard
  Watchlist
  News Feed

WORKFLOWS                  [+ 新建]
  BTC 趋势跟踪
  ETH 套利监控
  多因子选股 v2

BUILD
  Agents
  Datasets

─────────────────────────
Settings                   ← footer
```

**折叠态**：
- 默认：WORKFLOWS 分组收起，整体不展示
- 当 `pathname` 命中 `/workflow/{id}` 时，只展示该 active workflow 单条
  （即"折叠态下当前选中的工作流穿透可见"，其它工作流仍隐藏）

## 改动范围

### 1. Settings 移至 SidebarFooter
- 从 SYSTEM 分组里移除 Settings 条目
- 删除空的 SYSTEM 分组
- 在 `SidebarContent` 之后渲染 `SidebarFooter`，footer 里只放 Settings 一个按钮
- 样式：与普通 `SidebarMenuButton` 风格一致，icon-only 态下依然可用（参考 sidebar 现有 `collapsible="icon"` 模式）

### 2. 工作流列表作为独立分组
- 在侧边栏新增一个 `WORKFLOWS` 分组（位置在 OVERVIEW 之下、BUILD 之上）
- 分组下直接列出所有工作流，每条展示**名称**（暂用 `wf.name`），点击跳转 `/workflow/{id}`
- 数据源复用现有 `useWorkflowList()`，列表变化自动反映到侧边栏（注意：后续若该 hook 多次实例化需要避免重复请求，待 Claude 自己评估是否抽到 store）
- 分组头部可放一个**新建工作流**的入口（icon-only 即可，跟现有 header action 风格对齐）

### 3. 处理折叠态（collapsible="icon"）
- 展开态：按上面的目标态展示
- 折叠态：整个 WORKFLOWS 分组收起不展示（避免 icon-only 宽度下塞太满），或者只显示一个 "Workflows" 折叠入口 + 计数 badge —— **这一条作为产品决策点，见下文 §产品决策**

### 4. 顺手清理
- 删掉 `navSections.BUILD.items` 里的 `workflows` 条目
- 删掉 `navToPath.workflows`，改为不再使用单条目跳转
- badge `'3'` 取消 —— 列表本身已经替代了数字 badge 的信息量

## 产品决策点（已拍板）

1. **折叠态下 WORKFLOWS 分组如何显示？**
   - 默认规则：折叠态下整个分组收起，不展示
   - **穿透规则**：当 `pathname` 命中 `/workflow/{id}` 时（即用户正在某个 workflow 编辑器中），折叠态下**只展示该 active workflow 单条**，其它工作流仍隐藏
   - 判断 active 的依据：`useLocation().pathname` 匹配 `/workflow/{id}`

2. **新建工作流的入口放在哪里？**
   - 放在 WORKFLOWS 分组标题行右侧的 `+` icon button
   - 复用现有 `CreateWorkflowDialog` 组件，点击触发该 dialog

3. **工作流列表的排序**
   - **按后端返回的顺序展示，不做前端排序**
   - 不要为这个去改后端，也不要引入排序 state

4. **空态**
   - 展开态下 `workflows.length === 0`：分组下显示一个"暂无工作流"小字 + `+` 按钮占位
   - 不做复杂 Empty 组件

## 删除 `/workflows` 页面（Toby 拍板）

- 删除文件：`apps/web/src/pages/(auth)/workflows/page.tsx`
- 清理路由表里 `/workflows` 的注册（具体位置由 Claude 在 `console-layout.tsx` / 路由配置里找）
- **保留并复用**：`CreateWorkflowDialog` 组件（`apps/web/src/components/workflow/create-workflow-dialog.tsx`）—— 侧边栏的 `+` 按钮点击后触发该 dialog，跳过原本的 `/workflows` 页面中转
- `/workflows` 页面的 WorkflowCard 渲染逻辑**不**复用到侧边栏；侧边栏条目用更紧凑的样式

## 约束

- **架构边界**：DataSourceInstance 是数据源配置唯一入口 —— 本次改动不触及数据源架构，但新建工作流如果涉及到数据源选择，沿用现有流程，不要绕开
- **现有功能不要破坏**：
  - sidebar 当前 `collapsible="icon"` 行为不能破坏
  - `/workflows` 页面**主动删除**（见上 §删除 `/workflows` 页面）
- **风格一致**：用现有 `@eous/ui` 的 sidebar 子组件，不要引新依赖；icon 用 lucide-react 现有图标
- **国际化**：分组标题、placeholder 文案跟现有命名风格保持一致（GROUP TITLE 是大写英文还是中文，待 Claude 跟现有 OVERVIEW/BUILD/SYSTEM 风格保持一致即可）

## 不要做的事

- 不要改 `useWorkflowList` 的实现细节，除非确实出现多次实例化导致的重复请求
- 不要新增全局 store
- 不要顺手重构 sidebar 之外的 layout 组件（`console-layout.tsx` / `header.tsx`）
- 不要给工作流列表加拖拽排序等本次范围外的功能
- 不要动 `/workflows` 页面的逻辑

## 验收点

1. 侧边栏展开态能看到：
   - OVERVIEW 分组
   - WORKFLOWS 分组 + 列表项（按后端顺序）+ 标题右侧 `+` 新建按钮
   - BUILD 分组（去掉 Workflows）
   - footer 里 Settings
2. 点击侧边栏某个工作流项，路由跳到 `/workflow/{id}`
3. **折叠态验收**：
   - 在非 workflow 编辑器页（如 `/dashboard`），折叠侧边栏 → WORKFLOWS 分组**完全隐藏**
   - 进入某个 workflow 编辑器 `/workflow/{id}`，折叠侧边栏 → **只显示该 active workflow 单条**，其它工作流隐藏
4. 点击侧边栏的 `+` 按钮 → 弹出 `CreateWorkflowDialog` → 创建成功后跳到 `/workflow/{newId}` 且侧边栏列表自动刷新
5. 空态：删除所有 workflow 后，展开态下分组显示"暂无工作流"占位 + `+` 按钮
6. `/workflows` 路由**已删除**，直接访问 `/workflows` 应该是 404 或重定向到 `/workflow/<某个 default>`（具体策略由 Claude 决定，但不能再展示原来的 workflows 页面）