# 个人工作看板

React SPA 与 Spring Boot API 完全分离的项目。生产前端由 Nginx 托管 `frontend/dist`，后端只提供 `/api/**`；旧 `src/main/resources/static` 文件仅暂时保留，不再由后端映射。

## 本地开发

要求 Java 17、Maven 3.9、Node 22.22+ 与 npm。所有命令均在项目目录内执行，不依赖其他工作区。

```bash
# 终端 1：后端，默认 http://localhost:7100
mvn spring-boot:run

# 终端 2：前端，默认 http://localhost:5173
cd frontend
cp .env.example .env.local   # Windows 可用 copy .env.example .env.local
npm ci
npm run dev
```

`VITE_API_PROXY_TARGET` 只供 Vite 开发代理使用，不会写入生产构建。生产 API client 默认请求同源 `/api`，由前端 Nginx 转发到独立 API 站点。AI 地址、模型与密钥保持空白；本任务不增加任何凭据。

## 构建与测试

```bash
mvn clean test
mvn package
node --test deploy/deployment-contract.test.mjs
node deploy/smoke-test.mjs   # 真实 Jar 冒烟；可用 JAVA_CMD 指定 Java 17

cd frontend
npm ci
npm run lint
npm test
npm run build

# E2E 会先启动隔离内存数据库的后端和 Vite，结束时自动停止两者。
# Windows 默认使用已安装的 Edge；其他平台先执行 npx playwright install chromium。
npm run test:e2e
```

E2E 使用 `jdbc:h2:mem:growth-dashboard-e2e`，不会读取或修改 `data/dashboarddb.mv.db`。可用 `PLAYWRIGHT_CHANNEL` 覆盖浏览器通道，用 `JAVA_CMD` 指定 Java 17 可执行文件。

## 独立部署

- 前端产物：`frontend/dist`，发布到前端 Nginx 的版本目录。
- 后端产物：`target/growth-dashboard-1.0.0.jar`，由 systemd 独立运行。
- `deploy/frontend-nginx.conf`：静态缓存、gzip、安全 Header、SPA history fallback 与同源 `/api` 反代。
- `deploy/api-nginx.conf`：只公开 `/api/**`，转发到本机 7100，不提供前端资源或 SPA fallback。
- 生产必须设置 `FRONTEND_ORIGINS=https://dashboard.example.com`、`COOKIE_SECURE=true`，并按实际环境配置数据库。

完整发布、回滚、备份、健康检查和安全验收见 `deploy/部署手册.md`。能力成长/评估后端接口保留，前端不显示对应入口。
