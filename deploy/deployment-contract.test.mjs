import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(resolve(root, path), "utf8")

test("后端只暴露 API，不再注册旧前端静态资源或 SPA fallback", () => {
  const config = read("src/main/java/com/personal/dashboard/auth/WebConfig.java")
  assert.doesNotMatch(config, /addResourceHandlers|ResourceHandlerRegistry|classpath:\/static/)
  assert.match(config, /addPathPatterns\("\/api\/\*\*"\)/)
  assert.match(config, /addMapping\("\/api\/\*\*"\)/)
  const properties = read("src/main/resources/application.properties")
  assert.match(properties, /^spring\.web\.resources\.add-mappings=false$/m)
  assert.match(properties, /^spring\.web\.resources\.static-locations=classpath:\/api-static-disabled\/$/m)
  assert.match(properties, /^spring\.mvc\.static-path-pattern=\/api-static-disabled\/\*\*$/m)
})

test("前端 Nginx 将 history 路由回退到 index，但不会回退 API", () => {
  const config = read("deploy/frontend-nginx.conf")
  const spa = config.match(/location\s+\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(spa, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/)
  const api = config.match(/location\s+\^~\s+\/api\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(api, /proxy_pass\s+https:\/\/api\.example\.com;/)
  assert.doesNotMatch(api, /try_files|index\.html/)
  assert.match(api, /proxy_set_header\s+Host\s+api\.example\.com;/)
  assert.match(api, /proxy_set_header\s+X-Request-ID\s+\$request_id;/)
  assert.match(api, /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme;/)
})

test("前端静态缓存与 gzip 遵循发布契约", () => {
  const config = read("deploy/frontend-nginx.conf")
  const index = config.match(/location\s+=\s+\/index\.html\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(index, /Cache-Control\s+"no-cache"/)
  const assets = config.match(/location\s+\^~\s+\/assets\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(assets, /Cache-Control\s+"public, max-age=31536000, immutable"/)
  assert.match(assets, /try_files\s+\$uri\s+=404;/)
  assert.match(config, /gzip\s+on;/)
  assert.match(config, /gzip_types[^;]*text\/css[^;]*application\/javascript[^;]*;/)
})

test("两个 Nginx 入口都设置安全响应头，API 站点不提供静态内容", () => {
  for (const path of ["deploy/frontend-nginx.conf", "deploy/api-nginx.conf"]) {
    const config = read(path)
    assert.match(config, /add_header\s+X-Content-Type-Options\s+nosniff\s+always;/)
    assert.match(config, /add_header\s+X-Frame-Options\s+DENY\s+always;/)
    assert.match(config, /add_header\s+Referrer-Policy\s+strict-origin-when-cross-origin\s+always;/)
  }
  const api = read("deploy/api-nginx.conf")
  assert.match(api, /proxy_pass\s+http:\/\/127\.0\.0\.1:7100;/)
  assert.doesNotMatch(api, /try_files|root\s+\/srv\/growth-dashboard\/frontend/)
})

test("开发与生产环境变量边界清晰且不包含真实凭据", () => {
  assert.equal(read("frontend/.env.example"), "VITE_API_PROXY_TARGET=http://localhost:7100\n")
  const properties = read("src/main/resources/application.properties")
  assert.match(properties, /app\.frontend-origins=\$\{FRONTEND_ORIGINS:http:\/\/localhost:5173\}/)
  assert.match(properties, /app\.cookie\.secure=\$\{COOKIE_SECURE:false\}/)
  const manual = read("deploy/部署手册.md")
  for (const required of ["FRONTEND_ORIGINS=https://dashboard.example.com", "COOKIE_SECURE=true", "回滚", "备份", "CSRF", "HttpOnly"]) {
    assert.ok(manual.includes(required), `部署手册缺少 ${required}`)
  }
  assert.doesNotMatch(`${manual}\n${read("README.md")}`, /sk-[A-Za-z0-9_-]{8,}/)
})

function expectJsonError(block, status) {
  assert.match(block, /default_type\s+application\/json;/)
  assert.match(block, new RegExp(`return\\s+${status}\\s+'`))
  for (const field of ["timestamp", "status", "code", "message", "path", "requestId"]) {
    assert.ok(block.includes(`\"${field}\"`), `JSON 错误缺少 ${field}`)
  }
  assert.doesNotMatch(block, /try_files|index\.html|proxy_pass/)
}

test("两个站点的精确 /api 与 /api/ 都返回六字段 JSON 404", () => {
  for (const path of ["deploy/frontend-nginx.conf", "deploy/api-nginx.conf"]) {
    const config = read(path)
    for (const route of ["/api", "/api/"]) {
      const escaped = route.replaceAll("/", "\\/")
      const block = config.match(new RegExp(`location\\s+=\\s+${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`))?.groups?.body ?? ""
      expectJsonError(block, 404)
    }
  }
})

test("两个代理将 502/503/504 转换为对应六字段 JSON 且不进入 SPA", () => {
  const cases = [[502, "bad_gateway"], [503, "upstream_unavailable"], [504, "gateway_timeout"]]
  for (const path of ["deploy/frontend-nginx.conf", "deploy/api-nginx.conf"]) {
    const config = read(path)
    const proxy = config.match(/location\s+\^~\s+\/api\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
    assert.match(proxy, /proxy_intercept_errors\s+on;/)
    for (const [status, name] of cases) {
      assert.match(config, new RegExp(`error_page\\s+${status}\\s+=\\s+@${name};`))
      const block = config.match(new RegExp(`location\\s+@${name}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`))?.groups?.body ?? ""
      expectJsonError(block, status)
    }
  }
})

test("双跳转发只在受信前端边界保留公网元数据并串联请求 ID", () => {
  const frontend = read("deploy/frontend-nginx.conf")
  const frontendProxy = frontend.match(/location\s+\^~\s+\/api\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(frontendProxy, /proxy_set_header\s+X-Forwarded-For\s+\$remote_addr;/)
  assert.match(frontendProxy, /proxy_set_header\s+X-Forwarded-Host\s+dashboard\.example\.com;/)
  assert.match(frontendProxy, /proxy_set_header\s+X-Request-ID\s+\$request_id;/)

  const api = read("deploy/api-nginx.conf")
  assert.match(api, /map\s+\$remote_addr\s+\$dashboard_from_frontend\s*\{/)
  assert.match(api, /192\.0\.2\.10\s+1;/)
  for (const variable of ["dashboard_client_ip", "dashboard_forwarded_for", "dashboard_forwarded_host", "dashboard_forwarded_proto"]) {
    assert.match(api, new RegExp(`map\\s+\\$dashboard_from_frontend\\s+\\$${variable}\\s*\\{`))
  }
  assert.match(api, /1\s+\$proxy_add_x_forwarded_for;/)
  assert.match(api, /0\s+\$remote_addr;/)
  assert.match(api, /1\s+\$http_x_forwarded_host;/)
  assert.match(api, /0\s+\$host;/)
  assert.match(api, /map\s+\$http_x_request_id\s+\$dashboard_request_id\s*\{[\s\S]*?""\s+\$request_id;/)
  const apiProxy = api.match(/location\s+\^~\s+\/api\/\s*\{(?<body>[\s\S]*?)\n\s*\}/)?.groups?.body ?? ""
  assert.match(apiProxy, /proxy_set_header\s+X-Forwarded-For\s+\$dashboard_forwarded_for;/)
  assert.match(apiProxy, /proxy_set_header\s+X-Forwarded-Host\s+\$dashboard_forwarded_host;/)
  assert.match(apiProxy, /proxy_set_header\s+X-Request-ID\s+\$dashboard_request_id;/)

  for (const [config, domain] of [[frontend, "dashboard.example.com"], [api, "api.example.com"]]) {
    assert.match(config, new RegExp(`return 301 https://${domain.replaceAll(".", "\\.")}\\$request_uri;`))
    assert.doesNotMatch(config, /return\s+301[^\n]*\$host/)
  }
})

test("两配置同机安装仅一个默认 80 server，未知 Host 仍被拒绝", () => {
  const frontend = read("deploy/frontend-nginx.conf")
  const api = read("deploy/api-nginx.conf")
  const combined = `${frontend}\n${api}`
  assert.equal(combined.match(/listen\s+80\s+default_server;/g)?.length, 1)
  const catchAll = frontend.match(/server\s*\{(?<body>[\s\S]*?listen\s+80\s+default_server;[\s\S]*?)\n\}/)?.groups?.body ?? ""
  assert.match(catchAll, /server_name\s+_;/)
  assert.match(catchAll, /return\s+444;/)
  assert.doesNotMatch(api, /listen\s+80\s+default_server;/)
  assert.match(api, /server\s*\{\s*listen\s+80;\s*server_name\s+_;\s*return\s+444;\s*\}/)
})

test("引号、反斜杠与异常 URI 不会破坏网关六字段 JSON，外部请求 ID 受白名单限制", () => {
  const hostileUris = ["/api/\"quoted\"", "/api/\\backslash", "/api/%22%5C%0D%0A"]
  for (const path of ["deploy/frontend-nginx.conf", "deploy/api-nginx.conf"]) {
    const config = read(path)
    const blocks = [...config.matchAll(/location\s+(?:=\s+\/api\/?|@(?:bad_gateway|upstream_unavailable|gateway_timeout))\s*\{(?<body>[\s\S]*?)\n\s*\}/g)]
    assert.equal(blocks.length, 5)
    for (const hostileUri of hostileUris) {
      for (const block of blocks) {
        const body = block.groups?.body ?? ""
        const status = Number(body.match(/return\s+(\d+)/)?.[1])
        expectJsonError(body, status)
        assert.match(body, /"path":"\/api"/, `${hostileUri} 不得改变固定网关 path`)
        assert.doesNotMatch(body, /\$(?:uri|request_uri|document_uri|request_filename)/)
      }
    }
  }

  const api = read("deploy/api-nginx.conf")
  const requestIdMap = api.match(/map\s+\$http_x_request_id\s+\$dashboard_request_id\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? ""
  assert.match(requestIdMap, /"~\^\[A-Za-z0-9\\?\._:-\]\{1,128\}\$"\s+\$http_x_request_id;/)
  assert.match(requestIdMap, /default\s+\$request_id;/)
  assert.doesNotMatch(requestIdMap, /default\s+\$http_x_request_id;/)
  const safeRequestId = /^[A-Za-z0-9._:-]{1,128}$/
  for (const valid of ["req-123", "trace.id_123:abc", "x".repeat(128)]) assert.match(valid, safeRequestId)
  for (const invalid of ["bad\"id", "bad\\id", "bad id", "", "x".repeat(129)]) assert.doesNotMatch(invalid, safeRequestId)
})

test("smoke 拒绝占用端口、处理 spawn/error/signal 并校验真实子进程 JSON", () => {
  const smoke = read("deploy/smoke-test.mjs")
  for (const required of ["SMOKE_PORT", "findFreePort", "assertPortAvailable", "stopPromise", "body.code"]) {
    assert.ok(smoke.includes(required), `smoke 缺少 ${required}`)
  }
  assert.match(smoke, /child\.once\("error"/)
  assert.match(smoke, /process\.once\("SIGINT"/)
  assert.match(smoke, /process\.once\("SIGTERM"/)
  assert.match(smoke, /await\s+childExit/)
})

test("smoke 与 Playwright 强制完整 H2 环境，不继承 MySQL 凭据", () => {
  for (const path of ["deploy/smoke-test.mjs", "frontend/playwright.config.ts"]) {
    const config = read(path)
    assert.match(config, /DB_DRIVER:\s*"org\.h2\.Driver"/)
    assert.match(config, /DB_USER:\s*"sa"/)
    assert.match(config, /DB_PASSWORD:\s*""/)
  }
})
