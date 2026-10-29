import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `${process.env.JAVA_CMD ?? "java"} -jar target/growth-dashboard-1.0.0.jar`,
      cwd: "..",
      url: "http://127.0.0.1:7100/api/auth/me",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: "7100",
        DB_URL: "jdbc:h2:mem:growth-dashboard-e2e;DB_CLOSE_DELAY=-1",
        DB_DRIVER: "org.h2.Driver",
        DB_USER: "sa",
        DB_PASSWORD: "",
        FRONTEND_ORIGINS: "http://127.0.0.1:5173",
        COOKIE_SECURE: "false",
        AI_BASE_URL: process.env.AI_BASE_URL ?? "",
        AI_API_KEY: process.env.AI_API_KEY ?? "",
        AI_MODEL: process.env.AI_MODEL ?? "",
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 30_000,
      env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:7100" },
    },
  ],
})
