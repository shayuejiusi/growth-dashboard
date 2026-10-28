import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const origin = "http://127.0.0.1:7100"
const java = process.env.JAVA_CMD ?? "java"
const child = spawn(java, ["-jar", "target/growth-dashboard-1.0.0.jar"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: "7100",
    DB_URL: "jdbc:h2:mem:task11-smoke;DB_CLOSE_DELAY=-1",
    FRONTEND_ORIGINS: "https://dashboard.example.com",
    COOKIE_SECURE: "true",
    AI_BASE_URL: "",
    AI_API_KEY: "",
    AI_MODEL: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
child.stdout.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000) })
child.stderr.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000) })

async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGTERM")
  for (let attempt = 0; attempt < 50 && child.exitCode === null && child.signalCode === null; attempt += 1) {
    await delay(100)
  }
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`后端提前退出：\n${logs}`)
    try {
      const response = await fetch(`${origin}/api/auth/me`)
      if (response.status === 401) return
    } catch {
      // 服务尚未监听，继续有界等待。
    }
    await delay(250)
  }
  throw new Error(`后端健康检查超时：\n${logs}`)
}

try {
  await waitUntilReady()

  for (const path of ["/", "/index.html", "/tasks"]) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 404, `${path} 不得提供旧前端或 SPA fallback`)
    assert.doesNotMatch(await response.text(), /<!doctype html>/i)
  }

  const preflight = await fetch(`${origin}/api/tasks`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://dashboard.example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type,X-CSRF-TOKEN",
    },
  })
  assert.equal(preflight.status, 200)
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://dashboard.example.com")
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true")

  const rejectedOrigin = await fetch(`${origin}/api/tasks`, {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example", "Access-Control-Request-Method": "POST" },
  })
  assert.equal(rejectedOrigin.status, 403)
  assert.equal(rejectedOrigin.headers.get("access-control-allow-origin"), null)

  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  })
  assert.equal(login.status, 200)
  const setCookie = login.headers.get("set-cookie") ?? ""
  assert.match(setCookie, /DASHBOARD_SESSION=[^;]+/)
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /Secure/i)
  assert.match(setCookie, /SameSite=Lax/i)
  assert.match(setCookie, /Path=\//i)
  const session = setCookie.split(";", 1)[0]

  for (const path of ["/api/capabilities", "/api/assessment/status"]) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: session } })
    assert.equal(response.status, 200, `${path} 后端能力接口必须保留`)
  }

  const csrfResponse = await fetch(`${origin}/api/auth/csrf`, { headers: { Cookie: session } })
  assert.equal(csrfResponse.status, 200)
  const { csrfToken } = await csrfResponse.json()
  assert.ok(csrfToken)
  const missingCsrf = await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { Cookie: session } })
  assert.equal(missingCsrf.status, 403)
  const logout = await fetch(`${origin}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: session, "X-CSRF-TOKEN": csrfToken },
  })
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i)

  console.log("PASS: Jar 健康检查、静态剥离、生产 Cookie、CSRF、CORS 与能力接口")
} finally {
  await stop()
}
