import { expect, test, type Page } from "@playwright/test"

const longText = "超长无空格工作内容用于验证移动端和桌面端布局不会破坏页面宽度ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const task = {
  id: "task-1",
  title: `德育工作计划${longText}`,
  priority: "P0",
  dueDate: "2026-10-28",
  status: "TODO",
  needReport: true,
  note: longText,
  category: "行政",
  source: "学部",
  nextStep: longText,
  expectedOutcome: longText,
  blocker: null,
  repeatType: "NONE",
  position: 0,
  version: 0,
  createdAt: "2026-10-27T09:00:00",
  completedAt: null,
}
const stats = { total: 1, open: 1, overdue: 0, highPriority: 1, todayDue: 1, completedTotal: 0, completionRate: 0, needReport: 1 }

async function mockApi(page: Page) {
  await page.route("http://127.0.0.1:5173/api/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const responses: Record<string, unknown> = {
      "/api/auth/me": { username: "admin", name: "系统管理员", level: 1 },
      "/api/dashboard": { generatedAt: "2026-10-28 10:00", stats, top3: [task], focusNow: longText },
      "/api/ai/status": { remoteConfigured: false, provider: "本地规则引擎", hint: "" },
      "/api/tasks": [task],
      "/api/reminders": {
        generatedAt: "2026-10-28 10:00",
        phase: "早间检查",
        stats,
        focusNow: longText,
        scripts: [{ scene: longText, text: longText }],
        reminders: { todayDue: [task], overdue: [], highPriority: [], needReport: [], recurring: [] },
      },
      "/api/content/daily": {
        date: "2026-10-28",
        articles: [{ title: longText, url: "https://example.com/article", source: longText, points: [longText], action: longText }],
        videos: [],
        notice: longText,
      },
      "/api/admin/users": [{ username: "admin", name: longText, level: 1, assessmentStatus: "COMPLETED" }],
      "/api/review/daily": {
        date: "2026-10-28",
        metrics: { ...stats, reportedCount: 1 },
        overdueAnalysis: longText,
        reportQuality: longText,
        collabIssues: longText,
        highlights: [longText],
        improvements: [longText],
        tomorrowGoals: [longText],
        focusCapability: "不应显示的能力字段",
      },
      "/api/talent": {
        rosters: { [longText]: [{ name: longText, role: longText }] },
        people: [{ id: "person-1", name: longText, roster: longText, performance: 1, potential: 1, observation: longText, updatedAt: "2026-10-28T09:00:00" }],
      },
    }
    if (path === "/api/search") {
      return route.fulfill({ json: {
        tasks: [{ type: "task", id: task.id, title: task.title, subtitle: "今天截止", path: "/tasks?focus=task-1" }],
        people: [],
        content: [],
      } })
    }
    if (path in responses) return route.fulfill({ json: responses[path] })
    return route.fulfill({ status: 500, json: { message: `未 mock 的接口：${path}` } })
  })
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(dimensions.html, `html 宽度 ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.body, `body 宽度 ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport)
}

const pages = [
  ["/dashboard", "工作台"],
  ["/tasks", "任务管理"],
  ["/reminders", "提醒中心"],
  ["/content", "每日精选"],
  ["/admin/users", "账号管理"],
  ["/review", "工作复盘"],
  ["/talent", "人才筛选"],
] as const

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error("浏览器运行错误", error))
  page.on("console", (message) => {
    if (message.type() === "error") console.error("浏览器控制台", message.text())
  })
  await mockApi(page)
})

test("主要业务页面在手机和桌面无横向溢出，长文本与主要操作可用", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    for (const [path, heading] of pages) {
      await page.goto(path)
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
      await expect(page.getByLabel("新建任务", { exact: true })).toBeVisible()
      await expectNoPageOverflow(page)
      await expect(page.locator("body")).not.toContainText("能力成长")
      await expect(page.locator("body")).not.toContainText("能力评估")
    }
  }
})

test("手机 Drawer、平板折叠侧栏和桌面固定 240px 侧栏符合断点", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
  const mobileTrigger = page.locator("button[aria-label='打开导航菜单']")
  await expect(mobileTrigger).toBeVisible()
  await mobileTrigger.click()
  await expect(page.getByRole("button", { name: "关闭导航菜单" })).toBeFocused()
  await page.keyboard.press("Control+k")
  await expect(page.getByRole("dialog", { name: "全局搜索" })).toBeVisible()
  await expect(mobileTrigger).toHaveAttribute("aria-expanded", "false")
  await expectNoPageOverflow(page)

  await page.keyboard.press("Escape")
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(page.getByRole("button", { name: "折叠侧栏" })).toBeVisible()
  await page.getByRole("button", { name: "折叠侧栏" }).click()
  await expect(page.locator("#primary-navigation")).toHaveCSS("width", "80px")
  await expectNoPageOverflow(page)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator("#primary-navigation")).toHaveCSS("width", "240px")
  await expect(page.getByRole("button", { name: "展开侧栏" })).toBeHidden()
  await expect(page.getByRole("button", { name: "折叠侧栏" })).toBeHidden()
  await expect(page.locator("#main-content")).toHaveCSS("max-width", "1600px")
  await expectNoPageOverflow(page)
})

test("搜索可用键盘选中并跳转，移动弹层不超出视口", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
  await page.keyboard.press("Control+k")
  const input = page.getByRole("combobox", { name: "全局搜索" })
  await expect(input).toBeFocused()
  await input.fill("德")
  const result = page.getByRole("option", { name: /德育工作计划/ })
  await expect(result).toBeVisible()
  await input.press("ArrowDown")
  await expect(result).toHaveAttribute("aria-selected", "true")
  await input.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page).toHaveURL(/\/tasks\?focus=task-1$/)
  await expect(page.getByRole("article", { name: /德育工作计划/ })).toBeFocused()
  await expectNoPageOverflow(page)
})

test("深色主题文本对比合格，外壳焦点顺序与可见焦点稳定", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "切换到深色模式" }).click()
  const contrast = await page.evaluate(() => {
    const channels = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
    const luminance = (color: string) => {
      const [r, g, b] = channels(color).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const style = getComputedStyle(document.body)
    const foreground = luminance(style.color)
    const background = luminance(style.backgroundColor)
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)

  const search = page.getByRole("button", { name: "搜索" })
  const theme = page.getByRole("button", { name: "切换到浅色模式" })
  await search.focus()
  await expect(search).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(theme).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "新建任务" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "打开用户菜单" })).toBeFocused()
})

test("prefers-reduced-motion 关闭搜索与导航的非必要动画", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/dashboard")
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
  await page.keyboard.press("Control+k")
  const dialog = page.getByRole("dialog", { name: "全局搜索" })
  await expect(dialog).toBeVisible()
  const durations = await page.evaluate(() => ["[data-slot='dialog-content']", "#primary-navigation"].map((selector) => {
    const element = document.querySelector(selector)
    if (!element) return null
    const style = getComputedStyle(element)
    const parse = (value: string) => value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value)
    return { animation: parse(style.animationDuration), transition: parse(style.transitionDuration) }
  }))
  for (const duration of durations) {
    expect(duration).not.toBeNull()
    expect(duration?.animation ?? 0).toBeLessThanOrEqual(0.00001)
    expect(duration?.transition ?? 0).toBeLessThanOrEqual(0.00001)
  }
})
