# 开发规范

本文约束当前仓库的日常开发。若规范与当前实现不一致，优先按当前实现修正文档或代码，避免让规范停留在愿望清单。

---

## 一、通用规范（前后端通用）

### 1.1 类型安全

- **禁止 `any` 类型**。若类型确实无法确定，用 `unknown` + type guard 收窄。
- 避免 `as` 强制类型断言。确需处理第三方库或 JSON 边界时，用局部收窄函数或小范围断言，并让断言靠近数据边界。
- 禁止 `@ts-ignore`。`@ts-expect-error` 只能用于测试类型边界，并必须说明原因。
- **禁止 `eslint-disable`**。如果规则不合理，在 eslint config 层面调整，不在代码里压。

### 1.2 文件与命名

| 项目       | 约定                               |
| ---------- | ---------------------------------- |
| 文件名     | `kebab-case.ts` / `kebab-case.tsx` |
| React 组件 | `PascalCase`，文件名与组件名一致   |
| 类         | `PascalCase`                       |
| 函数/变量  | `camelCase`                        |
| 常量       | `UPPER_SNAKE_CASE`                 |
| 类型/接口  | `PascalCase`，接口不用 `I` 前缀    |

### 1.3 导入顺序

文件内导入按以下顺序分组，组间空一行：

1. React / Node 内置模块
2. 第三方库
3. monorepo 内部包（`@eous/*`）
4. 相对路径导入

```typescript
import { useState, useCallback } from 'react' // 1
import { cn } from '@eous/ui' // 3
import type { IndicatorConfig } from '../types' // 4
```

### 1.4 禁止事项

- **禁止提交死代码**：注释掉的代码块、`console.log`、未使用的导入和变量
- **禁止硬编码颜色**：所有颜色使用 Tailwind CSS 变量 token（`bg-primary`、`text-muted-foreground`）或语义状态色（`text-emerald-500`）
- **禁止无意义注释**：注释解释"做什么"而非"为什么"。`// 设置 loading 为 true` 这类废话不要写

---

## 二、前端规范

### 2.1 组件拆分

**核心原则**：不同功能的逻辑不允许全塞在一个组件里。

- **按功能拆分**：数据加载、无限滚动、键盘快捷键、绘图工具状态、面板显隐等是不同功能，各自独立管理
- **复杂逻辑抽 hook**：一段逻辑涉及多个 `useRef` + `useEffect` + 回调组合，就抽成独立 hook
- **一个文件一个组件**：禁止在同一个文件里定义多个 React 组件。同组的相关组件（如 `symbol-selector.tsx`、`symbol-selector-dialog.tsx`、`symbol-selector-item.tsx`）以相同前缀命名，各放一个文件
- **状态隔离**：子组件自己通过 hook 或 context 获取所需数据和操作，不要让父组件代管子组件的内部状态

### 2.2 Hook 规范

- 一个 hook 做一件事。`useChart` 初始化 4 个引擎的这种巨石 hook 不允许存在。
- 返回超过 5 个值 → 拆成多个 hook。
- hook 不直接操作 DOM（`querySelector`、`textContent`）。渲染用 JSX，副作用用 ref callback。

### 2.3 状态管理

| 场景                      | 方案                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| 组件本地状态              | `useState`                                                                         |
| 跨组件共享（页面级）      | 提升到父组件，多层级建context                                                      |
| 跨组件共享（全局/持久化） | Zustand store                                                                      |
| 服务端数据                | 当前使用 `@eous/api-client` + 页面/hook 状态；后续如引入 TanStack Query 需统一迁移 |
| 图表引擎 Ref              | `useRef`（不触发重渲染）                                                           |

### 2.4 UI 组件使用

- 优先使用 `@eous/ui` 中的 shadcn-style 组件。当前组件库尚未覆盖的场景允许使用原生元素，但样式、可访问性和事件行为必须与现有 UI 保持一致。
- **必须使用 `cn()` 合并 className**，不要手动拼接字符串
- 分隔线用 `<Separator>`，不用 `<div className="w-px h-4 bg-border">`
- 加载态用 `<Skeleton>`，不用"Loading..."文案
- 空态用 `<Empty>`，不用纯文案
- 交互按钮优先用 `<Button>`，只有在第三方库插槽或特殊定位场景下才使用原生 `<button>`
- 标签/徽标用 `<Badge>`，不用 `<span>` + 手动背景色

### 2.5 Props 传递

- 子组件自己通过 hook 或 context 获取所需数据，不要让父组件一层层透传。
- 禁止在父组件定义子组件专用的回调再传下去。子组件需要的数据和操作在子组件内部自行获取。
- 需要传递给深层次子组件的数据用 context，不要逐层展开。

```typescript
// ❌ 不允许：把所有子组件 props 堆到父组件
interface KlineChartProps {
  // 这些都是 SymbolSelector 的 props，不应该出现在这里
  providers?: ProviderOption[]
  symbols?: SymbolItem[]
  onSymbolSelect?: (item: SymbolItem) => void
  // ... 还有 10 个
}

// ✅ 正确：只传必要的外部依赖
interface KlineChartProps {
  symbol?: string
  interval?: string
  fetchKlines: FetchKlinesFn
  children?: React.ReactNode
}
```

### 2.6 样式

- 优先使用 Tailwind 内置尺寸（`w-4`、`h-5`、`p-2`）
- 允许任意值的场景：`text-[9px]` / `text-[10px]` / `text-[11px]`（微文字）、`max-w-[1400px]`（固定布局）、`tracking-[0.2em]`（特殊字间距）
- 主题优先使用 CSS token 和 Tailwind utility，不在组件内硬编码主题颜色
- 禁止内联 `style={{}}`

### 2.7 异步操作

- 所有异步操作必须有错误处理。不吞错误。
- 竞态请求必须用 `fetchId` 或 AbortController 取消过期响应。
- 无限滚动 / 自动刷新必须做 cooldown，防止密集触发。

---

## 三、后端规范

### 3.1 三层架构（强制执行）

```
Route → Service → Repository → Prisma
```

**Route 层（`apps/server/src/routes/`）**：

- 只做 HTTP 协议转换：解析参数、调用 Service、返回 JSON/Set-Cookie
- **不允许**：业务逻辑、数据库操作、try/catch（全局 `app.onError` 统一处理）
- 文件命名：`{资源名}.ts`（如 `auth.ts`、`data-source.ts`）

**Service 层（`apps/server/src/services/`）**：

- 业务逻辑编排：校验、权限、冲突检测
- 调用 Repository、外部 API、加解密
- 通过 `throw new AppError(message, statusCode)` 抛出业务异常
- 不直接访问 `ctx` 或 Request/Response 对象
- 文件命名：`{资源名}.service.ts`

**Repository 层（`apps/server/src/repositories/`）**：

- 封装 Prisma 调用，不含任何业务逻辑
- 每个 repo 负责一组相关数据表
- 方法签名不暴露 Prisma 类型（返回业务类型而非 Prisma 生成的类型）
- 文件命名：`{资源名}.repo.ts`

```typescript
// ✅ 正确示例
// Route
app.post('/api/data-sources/:id/klines', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  const body = await c.req.json()
  const klines = await dataSourceService.getKlines(userId, id, body)
  return c.json(klines)
})

// Service
export async function getKlines(userId: string, id: string, body: KlineBody) {
  const instance = await dsRepo.findById(id)
  if (!instance || instance.userId !== userId) {
    throw new AppError('Data source not found', 404)
  }
  // ... 业务逻辑
}

// Repository
export async function findById(id: string) {
  return prisma.dataSourceInstance.findUnique({ where: { id } })
}
```

### 3.2 校验

- 所有外部输入（Request body、query params、path params）必须做显式校验。
- 当前仓库未引入 Zod；校验可以先使用手写 guard 和 `AppError`。若后续引入 schema 库，需要按模块统一迁移。
- 校验失败返回 400，由全局错误处理统一格式化。

### 3.3 错误处理

- 业务异常用 `AppError` 抛出，不要在各层写 try/catch 吞错误
- 全局 `app.onError` 捕获 `AppError` 和未知异常，统一格式化返回
- 敏感信息不泄露到错误消息中（数据库连接串、加密密钥等）

### 3.4 加密与安全

- 敏感数据（API Key 等）必须在 Service 层加解密
- 加密工具集中在 `lib/crypto-utils.ts`，不在其他地方直接调 crypto API
- 加密密钥从环境变量读取，不硬编码

---

## 四、提交前自检清单

每次提交代码前，确认以下事项：

- [ ] 没有不必要的 `any`、`as`、`@ts-ignore`、`eslint-disable`
- [ ] 没有死代码（console.log、注释掉的代码、未使用的导入）
- [ ] 交互元素优先使用 `@eous/ui` 组件；原生元素有明确理由且样式一致
- [ ] 所有颜色使用 Tailwind token，不硬编码 HSL/HEX
- [ ] 一个文件一个组件，不同功能逻辑分离，复杂逻辑抽成 hook
- [ ] 后端严格遵循 Route → Service → Repository 三层
- [ ] Route 层没有 try/catch 和业务逻辑
- [ ] 外部输入有显式校验
- [ ] 异步操作有错误处理和竞态取消
- [ ] `pnpm typecheck` 通过

---

## 五、审查清单

合并或确认变更之前逐项检查：

1. **读完所有变更文件**，不是只跑 `tsc`
2. **对照以上规范逐项检查**，发现问题列出具体文件和行号
3. **检查架构边界**：组件是否越界管理了不属于它的状态？hook 是否做了太多事？
4. **如果发现问题，要求修改**，附上具体问题描述
5. **问题清零后再确认通过**
