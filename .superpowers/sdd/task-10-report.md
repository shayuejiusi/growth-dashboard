# Task 10 实施与验证报告

基线：`aac671de602636ce71b1f04959deabedfc633672`

## 实施范围

- 新增全局搜索：Ctrl/Cmd+K、Escape、300ms 网络防抖、空白/50 字校验、AbortController 取消、加载/错误重试/空态、上下键与 active descendant、Enter/点击导航服务端 path。
- level 3 仅呈现服务端返回的任务分组；移动 Drawer 与搜索 Dialog 互斥；未新增能力评估或能力成长入口。
- 响应式：手机单列 Drawer、768–1199px 可折叠侧栏、>=1200px 固定 240px 侧栏、主内容最大 1600px；长文本断行与 reduced-motion 降级。
- 修复搜索跳转时 Dialog 焦点回退覆盖目标任务卡片焦点的问题。
- 7 个业务页面使用 React.lazy + Suspense 拆包，Login、AppShell 和认证/角色边界保持 eager。
- Vitest 收集范围限定为 `src`，避免误执行 Playwright 测试。
- 未修改后端、其他任务实现或计划文档。

## 真实 RED → GREEN

1. `npm test -- SearchDialog.test.tsx`
   - RED：实现前 0 tests，`Failed to resolve import "./SearchDialog"`。
   - GREEN：最终实现后 7/7 通过；最终全量测试亦包含并通过这 7 项。
2. `npm test -- AppShell.test.tsx`
   - RED：新增快捷键和 Drawer/Dialog 互斥测试后，8 项中 2 项失败，找不到“全局搜索”Dialog。
   - GREEN：最终版本 8/8 通过（包括 200ms 延迟聚焦后的 `waitFor` 验证）。
3. `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e -- responsive.spec.ts --workers=1`
   - RED：真实 Edge 曾发现 390px 视口下 html/body 均为 412px；后续完整运行还发现搜索跳转后目标任务卡片未获得焦点。
   - 修复：主内容 `min-width: 0` + 继承的 `overflow-wrap: anywhere`；结果跳转时禁止 Dialog 将焦点强制还给搜索按钮。
   - GREEN：最终 5/5 通过。
4. `npm test`
   - 中间 RED：194 个单元测试通过，但 Vitest 误收集 `e2e/responsive.spec.ts`，套件失败。
   - GREEN：限定 `include` 后 18 个文件、194 项全部通过。
5. `npm run lint`
   - 中间 RED：`SearchDialog.tsx` 的 effect 内同步 `setActiveIndex` 触发 `react-hooks/set-state-in-effect`。
   - GREEN：改为输入时及数据版本变化时重置，最终 0 errors / 0 warnings。

## 最终验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm test` | PASS，18 files / 194 tests |
| `npm run lint` | PASS，0 errors / 0 warnings |
| `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e -- responsive.spec.ts` | PASS，5/5，Windows 系统 Edge，5 workers |
| `npm run build` | PASS，TypeScript + Vite 构建成功 |
| `git diff --check` | PASS，仅提示仓库既有 LF→CRLF 转换警告 |

E2E 覆盖：7 个主要页面在 390×844 与 1440×900 的长文本/无页面横向溢出、主要按钮、无能力文案；手机 Drawer 焦点与搜索互斥；768px 折叠为 80px；1440px 固定 240px；搜索键盘跳转及目标卡片焦点；深色正文对比度 >=4.5；外壳 Tab 顺序；reduced-motion 下 Dialog/导航动画时长 <=0.01ms。

## 拆包前后体积

| 产物 | 修改前 | 修改后 | 差值 |
| --- | ---: | ---: | ---: |
| JS 主包 | 801.69 kB | 508.55 kB | -293.14 kB |
| JS 主包 gzip | 251.38 kB | 161.97 kB | -89.41 kB |
| CSS | 44.90 kB | 46.27 kB | +1.37 kB |
| CSS gzip | 8.59 kB | 8.86 kB | +0.27 kB |

拆包后主要异步/共享 chunk（minified / gzip）：

- `TasksPage`：81.75 / 28.05 kB
- `FormDrawer`：157.27 / 48.21 kB
- `TalentPage`：20.58 / 6.47 kB
- `UsersPage`：10.86 / 3.97 kB
- `DashboardPage`：8.08 / 3.50 kB
- `RemindersPage`：7.21 / 3.11 kB
- `ReviewPage`：6.01 / 2.76 kB
- `ContentPage`：5.01 / 2.25 kB
- 其余共享小 chunk：`skeleton` 0.20、`pencil` 0.31、`lightbulb` 0.32、`refresh-cw` 0.36、`task-write-coordinator` 0.57、`textarea` 0.62、`badge` 1.15、`tabs` 3.63 kB（均为 minified）。

注意：以上是入口主包变化，不应解释为全部 JS 总量同幅减少；异步页面与共享模块现在单独计列。主包仍为 508.55 kB，因此 Vite 的 >500 kB 警告仍存在；未通过调高警告阈值隐藏它。构建另有第三方 zod 注释位置的非阻断 Rollup 提示。

## 未验证边界

- 默认 Playwright Chromium 未运行：本机缺少 `chromium_headless_shell-1248`；一次安装因 `cdn.playwright.dev` TLS `ECONNRESET` 失败。实际浏览器验证仅使用 Windows 系统 Edge，未验证 Firefox、WebKit、真实手机或 macOS 原生 Cmd+K。
- E2E 使用 Playwright mock API，未连接真实后端；服务端搜索权限过滤、真实数据及端到端网络异常不在本次验证范围。
- 断点仅实测 390×844、768×1024、1440×900；其他宽度、旋转、缩放和屏幕阅读器人工遍历未验证。
- 深色对比自动断言针对 body 前景/背景；未逐组件测量全部文本、禁用态和图表颜色。
- 构建仍有上述主包体积和第三方注释警告；本次未做进一步 vendor/manualChunks 优化。
