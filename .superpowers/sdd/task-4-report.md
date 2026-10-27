# Task 4 实施报告：React 工程、设计 Token、基础组件与测试环境

## 基线与范围

- Base commit：`8e0c28ee0cccb822e00b63b17ce4ca77508c6649`
- 唯一需求来源：`.superpowers/sdd/task-4-brief.md`
- 在 `frontend/` 新建独立 React 19 + TypeScript + Vite SPA 工程。
- 仅实现工程底座、暖白墨绿设计系统、指定 UI 组件和测试环境；未提前实现后续业务页面。
- 未修改 `docs/`、后端源码或后端接口，未复制 `node_modules`、无用组件或 inspect 插件。
- 能力成长、能力评估及驾驶舱能力摘要未进入前端；`App.test.tsx` 对此设有回归断言。

## 实现内容

### 1. Vite 工程、脚本与 API 配置

- 使用 React TypeScript 模板建立 `frontend/`，配置 `@` 到 `src` 的路径别名。
- 按 brief 配置脚本：`dev`、`build`、`lint`、`test`、`test:watch`、`test:e2e`。
- `dev` 为原生 `vite`，CLI 的 `--host` / `--port` 参数可直接转发。
- 开发服务器将 `/api` 代理到 `VITE_API_PROXY_TARGET`，未设置时回退到 `http://localhost:7100`。
- 未写入 API 密钥或写死生产 API 地址；生产请求可继续使用同源 `/api`，由部署层反向代理。
- Vitest 使用 `jsdom`、全局测试 API 和 `src/test/setup.ts`，setup 加载 `@testing-library/jest-dom/vitest`。
- `index.html` 使用 `zh-CN`、中文标题和移动端 viewport；脚手架演示页面及资源已删除，仅保留中文工程外壳。

### 2. 暖白墨绿设计系统

- `src/index.css` 逐项写入 brief 指定的 light / dark Token，包括背景、前景、卡片、主色、次色、弱化色、强调色、危险色、边框、输入框、焦点环和 `.75rem` 圆角。
- 补充组件必需的 `popover`、`popover-foreground` 与 `destructive-foreground`，分别复用对应卡片／前景语义。
- `tailwind.config.js` 使用 `darkMode: ["class"]`，将 semantic colors 映射至 CSS 变量，并配置语义圆角。
- 配置 Tailwind 3.4.19、PostCSS、autoprefixer 和 `tailwindcss-animate`，弹层动画类可实际生成。
- 全局基础样式统一中文系统字体、暖白背景、墨绿前景、边框和可见焦点环；暗色由 `.dark` 单一路径控制。

### 3. 基础组件与可访问性

- 从指定参考工程复制并复用 20 个组件：`alert-dialog`、`alert`、`badge`、`button`、`card`、`dialog`、`drawer`、`dropdown-menu`、`input`、`label`、`popover`、`scroll-area`、`select`、`separator`、`skeleton`、`sonner`、`table`、`tabs`、`textarea`、`tooltip`。
- `src/lib/utils.ts` 提供 `cn(...inputs: ClassValue[])`，组合 `clsx` 与 `tailwind-merge`。
- 保留 shadcn / Radix 的可访问性行为、弹层 `z-50`、focus ring、disabled 样式和响应式宽度约束。
- `sonner` 已移除 `next-themes`：`Toaster` 仅接收 `theme` prop，默认 `system`，可由 Task 5 的 Zustand 主题直接传入，不建立第二套主题状态。
- 将参考源码中的 Tailwind 4 简写适配到任务指定的 Tailwind 3，包括 CSS 变量 arbitrary values、`outline-none`、`shadow-sm`、`rounded-sm` 和 `[field-sizing:content]`。
- Dialog 关闭按钮的屏幕阅读器文本改为中文“关闭”。
- ESLint 仅在 `src/components/ui/` 范围关闭 `react-refresh/only-export-components`，允许 shadcn 的 `buttonVariants` / `badgeVariants` 与组件同文件导出，其余规则不变。

## RED 记录

### Button

```bash
npm test -- button.test.tsx
```

结果：按预期 FAIL。`@/components/ui/button` 尚不存在，Vite 报 `Failed to resolve import`，证明测试确实覆盖组件落地，而非误通过。

### 主题 Token

```bash
npm test -- theme.test.ts
```

结果：按预期 FAIL。默认脚手架 CSS 不包含 `--background: 60 20% 97%` 等变量。初次使用 CSS `?raw` 时 Vitest 返回空字符串，改用 Node `readFileSync` 读取真实源文件后重新运行，仍因 Token 缺失按预期失败。

### 中文外壳与功能隐藏

```bash
npm test -- App.test.tsx
```

结果：按预期 FAIL。处理脚手架 `/vite.svg` 在 jsdom 中的资源加载干扰后，测试因找不到一级标题“个人工作看板”而失败；实现后已删除不再需要的资源 mock。

## GREEN 与完整验证

### 聚焦测试

```bash
npm test -- button.test.tsx
npm test -- theme.test.ts App.test.tsx
```

结果：全部 PASS。Button 验证焦点、焦点环类、禁用属性及禁用样式；主题和中文外壳共 2 项测试通过。

### 本阶段要求的验证链

```bash
npm test -- button.test.tsx && npm run build && npm run lint && test -f dist/index.html
```

结果：全部 PASS。Button 1/1 通过；TypeScript 与 Vite 生产构建成功；ESLint 0 错误；`dist/index.html` 存在。

### 最终完整前端验证

```bash
npm test && npm run build && npm run lint && test -f dist/index.html
```

结果：

```text
Test Files  3 passed (3)
Tests       3 passed (3)
✓ 29 modules transformed.
dist/index.html                   0.46 kB
dist/assets/index-DexygEnH.css   32.46 kB
dist/assets/index-CoR1rxO4.js   222.88 kB
✓ built in 982ms
eslint .: exit 0
```

`dist` 为验证产物，已被 `.gitignore` 排除，不纳入提交。

### 开发命令与参数转发

通过临时进程执行并在请求完成后强制清理整个进程树：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

结果：Vite 输出收到 `vite --host 127.0.0.1 --port 5173`，在 274 ms 就绪；HTTP GET `http://127.0.0.1:5173/` 返回 200，页面包含中文标题和 `/src/main.tsx`。验证后服务已停止，进程检查无本项目 Node / Java 服务残留。使用回环地址验证以避免额外暴露服务；同一转发路径支持 brief 的 `--host 0.0.0.0`。

### 后端完整回归

```bash
export JAVA_HOME='C:\Users\22580\.jdks\ms-17.0.18'
export PATH="$JAVA_HOME/bin:$PATH"
'/d/kimi/Workspaces/看板生成/tools-maven/bin/mvn' test
```

结果：`Tests run: 23, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。其中既有 Auth 测试会故意产生一次异常日志以验证 500 响应不泄露细节，该测试通过。

### 依赖、产物与变更检查

```bash
npm ls --depth=0
npm ls next-themes
```

- 直接依赖树解析成功，安装时审计为 0 vulnerabilities。
- `next-themes` 为 `(empty)`；npm 对无匹配项返回退出码 1，这是确认未安装的预期结果，不是依赖解析错误。
- 构建 CSS 中确认存在暖白 Token、语义主色和弹层动画产物。
- 源码扫描未发现 inspect、`next-themes`、未适配的 Tailwind 4 简写或禁用业务文案；禁用业务词仅出现在反向回归测试中。
- `git diff --cached --check` 通过。首次检查发现 Tailwind 配置末尾多一个空行，已修正后重新通过。
- `git status` 仅包含 `frontend/` 与本报告，不包含 `dist`、`node_modules`、缓存、docs 或后端源码变更。

## 依赖说明

- 按 brief 安装 React、React Router、TanStack Query、Zustand、Radix UI、dnd-kit、React Hook Form、Zod、resolvers、Motion、Lucide、Sonner、Vaul 及测试／构建工具。
- `@hookform/resolvers` 固定为 `^5.2.2`：最新版 6.0.0 在当前依赖树中触发 optional `effect` peer 冲突；5.2.2 与 React Hook Form / Zod 兼容，未使用 `--force` 或 `--legacy-peer-deps`。
- 额外安装 `@radix-ui/react-scroll-area`，因为 brief 指定复用 `scroll-area` 组件而安装清单漏列其直接依赖。
- 额外安装开发依赖 `tailwindcss-animate`，因为保留的 shadcn 弹层使用 `animate-in`、`fade-in-0` 等类；Tailwind 3 需要该插件生成对应样式。
- 保留 brief 明确列出、供后续阶段使用的路由、查询、状态、拖拽和表单依赖；未添加功能重复库、`next-themes` 或 inspect 插件。
- `package-lock.json` 已提交，保证可重复安装。

## 文件变更

- 工程与配置：`frontend/package.json`、`frontend/package-lock.json`、`frontend/vite.config.ts`、`frontend/tsconfig.json`、`frontend/tsconfig.app.json`、`frontend/tsconfig.node.json`、`frontend/eslint.config.js`、`frontend/tailwind.config.js`、`frontend/postcss.config.js`、`frontend/index.html`、`frontend/.gitignore`。
- 应用与主题：`frontend/src/main.tsx`、`frontend/src/App.tsx`、`frontend/src/index.css`。
- 工具：`frontend/src/lib/utils.ts`。
- 组件：`frontend/src/components/ui/` 下上述 20 个组件。
- 测试：`frontend/src/components/ui/button.test.tsx`、`frontend/src/App.test.tsx`、`frontend/src/test/setup.ts`、`frontend/src/test/theme.test.ts`。
- 报告：`.superpowers/sdd/task-4-report.md`。
- `frontend/reference-ui` 已在检查与迁移完成后删除；临时脚手架缓存和开发服务验证脚本也已删除。

## 自审

- [x] **视觉基础**：暖白背景、墨绿主色、白色卡片、统一圆角与字体已落地；无脚手架紫色演示样式，无提前实现的业务页面。
- [x] **主题一致性**：brief 的 light / dark 数值逐项保留，Tailwind 语义色和组件均引用同一组变量；Sonner 仅接收外部 theme prop。
- [x] **依赖范围**：直接依赖与组件引用匹配，锁文件完整，无第二主题库、inspect 插件或重复功能库。
- [x] **可访问性**：Button 焦点与禁用测试通过；Radix 语义、焦点管理、屏幕阅读器文本和可见焦点环保留。
- [x] **响应式**：viewport、320 px 最小宽度、外壳响应式 padding／最大宽度，以及组件的移动端最大宽度和抽屉方向样式保留。
- [x] **弹层规范**：`z-50`、overlay、进入／退出动画、焦点态和 disabled 样式沿用 shadcn；Tailwind 3 兼容语法已处理。
- [x] **测试与构建**：3 个测试文件共 3 项测试全部通过，生产构建和 lint 通过，dist 入口存在，后端 23 项回归通过。
- [x] **范围与清理**：docs 和后端未改；无后台 Node、Vite、npm 或后端服务残留；未 push。

## 疑虑

无未解决疑虑。本阶段没有业务页面，因此未运行业务 E2E；Playwright 依赖和 `test:e2e` 脚本按 brief 预留给后续阶段。脚手架最新的 `create-vite@9.3.2` 发布包实际缺少模板目录，已改用包含完整模板的 `create-vite@8.3.0`，不影响生成工程的依赖版本或验证结果。
