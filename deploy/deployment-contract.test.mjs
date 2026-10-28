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
