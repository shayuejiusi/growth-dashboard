import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function listen(port) {
  const server = createServer()
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen)
      server.listen(port, "127.0.0.1", resolveListen)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    return address.port
  } finally {
    if (server.listening) await new Promise((resolveClose) => server.close(resolveClose))
  }
}

async function findFreePort() {
  return listen(0)
}

async function assertPortAvailable(port) {
  try {
    await listen(port)
  } catch (error) {
    throw new Error(`smoke 端口 ${port} 不可用，请释放端口或修改 SMOKE_PORT`, { cause: error })
  }
}

const requestedPort = process.env.SMOKE_PORT
const port = requestedPort === undefined ? await findFreePort() : Number(requestedPort)
assert.ok(Number.isInteger(port) && port > 0 && port <= 65_535, "SMOKE_PORT 必须是 1–65535 的整数")
await assertPortAvailable(port)

const origin = `http://127.0.0.1:${port}`
const java = process.env.JAVA_CMD ?? "java"
const child = spawn(java, ["-jar", "target/growth-dashboard-1.0.0.jar"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    DB_URL: "jdbc:h2:mem:task11-smoke;DB_CLOSE_DELAY=-1",
    DB_DRIVER: "org.h2.Driver",
    DB_USER: "sa",
    DB_PASSWORD: "",
    FRONTEND_ORIGINS: "https://dashboard.example.com",
    COOKIE_SECURE: "true",
    AI_BASE_URL: "",
    AI_API_KEY: "",
    AI_MODEL: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
let spawnError
let resolveChildExit
const childExit = new Promise((resolveExit) => { resolveChildExit = resolveExit })
child.once("error", (error) => {
  spawnError = error
  resolveChildExit({ error })
})
child.once("exit", (code, signal) => { resolveChildExit({ code, signal }) })
child.stdout.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000) })
child.stderr.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000) })

let stopPromise
function stop() {
  stopPromise ??= (async () => {
    if (!spawnError && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM")
      const exited = await Promise.race([
        childExit.then(() => true),
        delay(5_000, undefined, { ref: false }).then(() => false),
      ])
      if (!exited && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    }
    await childExit
  })()
  return stopPromise
}

let receivedSignal
function handleSignal(signal) {
  receivedSignal = signal
  void stop()
}
process.once("SIGINT", () => handleSignal("SIGINT"))
process.once("SIGTERM", () => handleSignal("SIGTERM"))

function assertChildRunning() {
  if (spawnError) throw new Error(`后端启动失败：${spawnError.message}`, { cause: spawnError })
  if (receivedSignal) throw new Error(`smoke 收到 ${receivedSignal}，已停止后端`)
  if (child.exitCode !== null || child.signalCode !== null) throw new Error(`后端提前退出：\n${logs}`)
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    assertChildRunning()
    try {
      const response = await fetch(`${origin}/api/auth/me`, { signal: AbortSignal.timeout(1_000) })
      if (response.status === 401) {
        const body = await response.json()
        const contentType = response.headers.get("content-type") ?? ""
        if (contentType.includes("application/json") && body.code === "UNAUTHORIZED") {
          assertChildRunning()
          return
        }
      }
    } catch {
      // 服务尚未监听或响应不符合契约，继续有界等待。
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

  // HTTP 端口可能早于 CommandLineRunner 完成种子写入；仅对启动期 401 做有界等待。
  let login
  for (let attempt = 0; attempt < 40; attempt += 1) {
    assertChildRunning()
    login = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
      signal: AbortSignal.timeout(1_000),
    })
    if (login.status !== 401) break
    await login.text()
    await delay(250)
  }
  assert.ok(login)
  assert.equal(login.status, 200, `管理员登录失败：\n${logs}`)
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
