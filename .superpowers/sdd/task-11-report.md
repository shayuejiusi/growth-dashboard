# Task 11：独立部署与最终验证报告

日期：2026-10-28

基线：`e4d1ec5cd04d350e8e91b4856bf51667f5944676`

需求来源：`.superpowers/sdd/task-11-brief.md`

## 1. 实现内容

- 后端移除 `WebConfig.addResourceHandlers`，不增加 SPA fallback；旧 `src/main/resources/static` 文件保留。
- 在 `application.properties` 同时关闭默认资源映射、静态位置和 `/**` welcome-page 路径，实际保证 `/`、`/index.html`、`/tasks` 均为 404，后端只提供 API。
- 新增前端与 API 两套独立 Nginx 配置：
  - 前端 `index.html` no-cache、`/assets/` 一年 immutable、gzip、安全 Header、history fallback。
  - 前端同源 `/api/**` 通过 HTTPS 转发到 `api.example.com`，`/api` 与 `/api/**` 不 fallback 到 HTML。
  - API 站点仅代理 `/api/**` 到本机 7100，传递 Host、X-Request-ID、X-Forwarded-Proto/Host/Port/For；其他路径 404。
  - 两站点均配置 nosniff、DENY、Referrer-Policy、HSTS；HTTP 跳转 HTTPS。
- 新增 `frontend/.env.example`，只含开发代理 `VITE_API_PROXY_TARGET=http://localhost:7100`。
- 新增核心 Playwright 流程，使用真实 Jar 和独立 H2 内存库；Windows 默认使用 Edge，测试结束自动清理前后端。
- 新增可重复执行的部署静态契约测试和真实 Jar 冒烟脚本。冒烟覆盖生产 `COOKIE_SECURE=true`、HttpOnly/SameSite、CSRF、CORS 白名单、静态剥离和能力接口保留。
- 重写部署手册为前后端独立发布/回滚，补充环境变量、数据库备份、健康检查、Cookie/CSRF/CORS、安全 Header、缓存/gzip 和手动验收；新增根 README。
- AI 地址、模型和密钥在测试/部署示例中保持空白；未新增真实凭据，未改无关业务模块。

## 2. RED / GREEN 记录

### 部署契约

1. RED：`node --test deploy/deployment-contract.test.mjs` 初次有效运行 0/5，通过率为 0；失败原因分别为旧 ResourceHandler 仍存在、两个 Nginx 配置和 `.env.example` 缺失。
2. 第一轮 GREEN：实现后 5/5 通过。
3. 运行级自审新增“旧文件不可访问”契约后发现默认 welcome page 漏洞：
   - 仅删除 handler 时，`GET /` RED：期望 404，实际 200。
   - `add-mappings=false` 后仍 RED：200，日志确认 welcome page 独立注册。
   - 增加 static-locations 后仍 RED：200，MockMvc 日志确认 ServletContext `/index.html` 仍被 welcome page 使用。
   - 最终将 static-path-pattern 收窄到 `/api-static-disabled/**`，`/`、`/index.html`、`/tasks` 全部 404，Java 回归和 5/5 静态契约转绿。

### 核心 E2E

1. RED：新增 `core-flows.spec.ts` 后，Windows Edge 两项均因没有隔离 API、登录后无法进入工作台而失败。
2. 实现 Playwright 双 webServer 后，测试本身又定位并修正两处选择器/同步问题：编辑按钮可访问名称含空格；键盘排序需先等待 `aria-pressed=true`，再发送方向键和放下。
3. GREEN：核心 2/2 通过；最终完整 E2E 7/7 通过。

## 3. 最终验证结果

| 验证 | 结果 |
| --- | --- |
| `node --test deploy/deployment-contract.test.mjs` | PASS，5/5 |
| Maven `clean test` | PASS，24 tests，0 failure/error/skip |
| Maven `package` | PASS，生成 `target/growth-dashboard-1.0.0.jar` |
| `npm ci` | PASS，391 packages，0 vulnerabilities |
| `npm run lint` | PASS |
| `npm test` | PASS，18 files / 212 tests |
| `npm run build` | PASS，生成 `frontend/dist` |
| `npm run test:e2e`（Windows Edge） | PASS，7/7 |
| `node deploy/smoke-test.mjs` | PASS，真实 Jar 健康检查、404 静态边界、Secure/HttpOnly Cookie、CSRF、CORS、能力接口 |
| 新目录迁移验证 | PASS；干净副本排除 `.git`、依赖、产物和 data 后，`npm ci`、前端 build、Maven package 均成功，副本内 Maven 24/24 |

E2E 覆盖登录、创建、编辑、完成、键盘排序、刷新顺序保持、全局搜索、主题切换、退出；管理员账号/复盘/人才页面；level 3 直接访问受限路由被拒绝。响应式用例覆盖 390/768/1440，另有深浅主题、加载/错误/空状态的前端测试。所有真实 E2E 和冒烟均使用 H2 内存库，不读取或写入 `data/dashboarddb.mv.db`。

构建有非阻断警告：第三方 zod 注释被 Rollup 移除提示，以及主 chunk 约 509.59 kB 的体积提示；构建退出码为 0。本任务不做无关拆包优化。

## 4. 验证边界

- 本机 `nginx` 和 `docker` 命令均不存在，因此 Nginx 只完成静态契约验证，没有伪报 `nginx -t`、真实 TLS、DNS、证书、gzip 网络响应或双站点代理运行验证。
- 未远程部署、未修改真实服务器。目标环境仍需按手册执行 Nginx 语法检查、证书/防火墙验证、真实发布与回滚演练。
- 初次 `npm ci` 遇到 EPERM，证据显示 Kimi 预览的 Vite/esbuild 占用文件；停止项目预览后重试通过。后续 7100 冲突也以相同方式处理，未复用未知服务。

## 5. 文件变更

- 修改：`src/main/java/com/personal/dashboard/auth/WebConfig.java`
- 修改：`src/main/resources/application.properties`
- 修改：`src/test/java/com/personal/dashboard/auth/AuthApiIntegrationTest.java`
- 修改：`frontend/playwright.config.ts`
- 修改：`deploy/部署手册.md`
- 新增：`deploy/frontend-nginx.conf`
- 新增：`deploy/api-nginx.conf`
- 新增：`deploy/deployment-contract.test.mjs`
- 新增：`deploy/smoke-test.mjs`
- 新增：`frontend/.env.example`
- 新增：`frontend/e2e/core-flows.spec.ts`
- 新增：`README.md`
- 新增：`.superpowers/sdd/task-11-report.md`

## 6. 最终自审

- 独立迁移：通过新目录干净构建；项目源码、配置、脚本、文档无其他工作区路径。
- 敏感信息：对部署目录、环境示例、README 和 application 配置扫描，无非空 AI Key、真实数据库密码或私钥；示例只使用保留域名和 `<...>` 占位符。
- 生产安全：手册要求 `FRONTEND_ORIGINS=https://dashboard.example.com` 与 `COOKIE_SECURE=true`；真实 Jar 冒烟验证精确 CORS Origin、凭证、Secure/HttpOnly/SameSite 与 CSRF 403/成功路径。
- 代理与路由：前端 history fallback 和 API 不 fallback 均有静态契约；后端旧欢迎页问题有 Java 回归和真实 Jar 双重验证。
- 能力边界：`/api/capabilities`、`/api/assessment/status` 冒烟均返回 200，前端既有测试继续确认能力入口隐藏。
- 进程清理：最终检查无 5173/7100 监听，无本项目 Java/Node/Vite/npm/esbuild/Nginx/Docker 测试进程；迁移临时副本已删除。
- 未 push，未修改真实服务器。

## 7. 疑虑

仅剩目标环境边界：由于本机无 Nginx/Docker，真实双站点 TLS 代理和响应头/gzip 必须在部署目标机复验；这不影响上述本地配置、构建、Jar、E2E 和迁移验证结论。


## 8. 独立复核发现修复（2026-10-28）

基线提交：`526a46d1042917b1cc9345f4d106d04189a2b517`。本轮仅修复复核发现及其验证脚本，不改业务实现，不 push。

### 8.1 RED / GREEN

- RED：先为复核发现追加 5 项部署契约；`node --test deploy/deployment-contract.test.mjs` 共 10 项，原 5 项通过，新 5 项全部按预期失败，分别覆盖精确 API JSON 404、代理 502/503/504 JSON、双跳受信转发与请求 ID、smoke 生命周期/就绪校验、smoke/Playwright 完整 H2 环境。
- 中间 GREEN：双站点 Nginx 修复后 8/10，通过全部 Nginx 契约；剩余两项为 smoke 与 H2 环境。
- 最终 GREEN：smoke 生命周期、Playwright 环境修复后 10/10 通过。
- 真实 Jar 首次复验额外发现启动竞态：HTTP 端口就绪可能早于 `CommandLineRunner` 完成种子写入，首次登录得到 401。smoke 仅对启动期登录 401 增加有界等待，持续认证失败仍会失败；随后真实 Jar 冒烟通过。

### 8.2 六项修复

1. 两个 Nginx 的精确 `/api`、`/api/` 使用 `application/json` 返回 `timestamp/status/code/message/path/requestId` 六字段 404；代理启用 `proxy_intercept_errors`，通过三个命名 location 分别保持 502/503/504 并返回同结构 JSON，不进入 SPA。
2. 前端首跳覆盖公网转发头，写入 `$remote_addr`、固定前端 Host 和 `$request_id`；API 仅以实际前端代理 IP 白名单为信任边界，受信时保留首跳并用 `$proxy_add_x_forwarded_for` 串联 XFF，直连时回退本跳 IP/Host/Scheme。
3. 两个 HTTP 301 均使用固定规范域名，不再使用 `$host`；两配置增加默认 80 server，以 444 拒绝未知 Host。API 的 `X-Forwarded-Host` 同样只在受信边界保留。
4. smoke 默认动态选择 127.0.0.1 空闲端口，可用 `SMOKE_PORT` 固定调试；spawn 前检查占用，处理 `error`，SIGINT/SIGTERM 与正常清理共享幂等 Promise，SIGTERM 超时后 SIGKILL，并等待实际子进程退出。
5. 前端首跳生成 X-Request-ID；API 优先透传非空请求 ID，缺失才回退 `$request_id`，错误 JSON 使用同一请求 ID 变量。
6. smoke 与 Playwright 均固定 `DB_URL`、`DB_DRIVER=org.h2.Driver`、`DB_USER=sa`、`DB_PASSWORD=""`，不会继承外部 MySQL 配置。

### 8.3 本轮完整验证

| 验证 | 结果 |
| --- | --- |
| `node --test deploy/deployment-contract.test.mjs` | PASS，10/10 |
| Maven `clean test` | PASS，24 tests，0 failure/error/skip |
| Maven `package` | PASS，生成真实可运行 Jar |
| `npm ci` | PASS，391 packages，0 vulnerabilities |
| `npm run lint` | PASS |
| `npm test` | PASS，18 files / 212 tests |
| `npm run build` | PASS，生成 `frontend/dist` |
| Windows Edge `npm run test:e2e` | PASS，7/7 |
| 真实 Jar `node deploy/smoke-test.mjs` | PASS；同时注入冲突的 MySQL 环境，验证完整 H2 覆盖、生产 Cookie、CSRF、CORS、静态剥离与能力接口 |
| 固定占用端口负向验证 | PASS；Java 启动前拒绝占用端口 |
| 不存在 `JAVA_CMD` 负向验证 | PASS；spawn error 受控失败并结束清理 |

构建仍有此前记录的非阻断第三方注释与 chunk 体积警告，无新增构建错误。部署手册已补充受信 IP 占位替换、直连回退、XFF/请求 ID 链、JSON 网关错误、动态端口和完整 H2 环境说明。

### 8.4 边界与自审

- 本机仍无 `nginx`、`docker`，本轮没有执行或伪报 `nginx -t`、真实双站点 TLS 代理、DNS/证书和 gzip 网络验证；目标机必须替换 `192.0.2.10` 为实际前端出口 IP，并按手册复验受信链路与六字段 JSON。
- 最终差异仅限 README、两个 Nginx 配置、部署契约、smoke、Playwright 配置、部署手册和本报告；未写真实凭据，未改其他工作区文件。
- 回归结束后检查本项目 Java/Node/esbuild 残留进程及 5173/7100 监听；仅允许停止命令行明确属于本项目的测试进程，不触碰无关服务。
