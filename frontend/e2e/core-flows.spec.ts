import { expect, test, type Page } from "@playwright/test"

async function login(page: Page, username: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("用户名", { exact: true }).fill(username)
  await page.getByLabel("密码", { exact: true }).fill(password)
  await page.getByRole("button", { name: "登录", exact: true }).click()
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
}

async function createTask(page: Page, title: string) {
  await page.locator("section[aria-labelledby='tasks-title']").getByRole("button", { name: "新建任务", exact: true }).click()
  await page.getByLabel("任务标题", { exact: true }).fill(title)
  await page.getByRole("button", { name: "保存任务", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible()
}

test("管理员核心流程使用真实临时 API，并在刷新后保持任务顺序", async ({ page, context }) => {
  test.setTimeout(90_000)
  const suffix = Date.now()
  const originalTitle = `E2E 任务 A ${suffix}`
  const editedTitle = `E2E 已编辑任务 A ${suffix}`
  const secondTitle = `E2E 任务 B ${suffix}`

  await login(page, "admin", "admin123")
  const session = (await context.cookies()).find((cookie) => cookie.name === "DASHBOARD_SESSION")
  expect(session).toMatchObject({ httpOnly: true, secure: false, sameSite: "Lax", path: "/" })

  const csrfResponse = await page.request.get("/api/auth/csrf")
  expect(csrfResponse.ok()).toBe(true)
  const { csrfToken } = await csrfResponse.json()
  const clearResponse = await page.request.delete("/api/tasks", { headers: { "X-CSRF-TOKEN": csrfToken } })
  expect(clearResponse.ok()).toBe(true)

  await page.goto("/tasks")
  await expect(page.getByText("今天没有待办任务", { exact: true })).toBeVisible()
  await createTask(page, originalTitle)
  await createTask(page, secondTitle)

  const originalCard = page.getByRole("article", { name: originalTitle, exact: true })
  await originalCard.getByRole("button", { name: `编辑 “${originalTitle}”`, exact: true }).click()
  await page.getByLabel("任务标题", { exact: true }).fill(editedTitle)
  await page.getByRole("button", { name: "保存任务", exact: true }).click()
  await expect(page.getByRole("article", { name: editedTitle, exact: true })).toBeVisible()

  const secondDragHandle = page.getByRole("button", { name: `拖动“${secondTitle}”排序`, exact: true })
  await secondDragHandle.focus()
  await secondDragHandle.press("Space")
  await expect(secondDragHandle).toHaveAttribute("aria-pressed", "true")
  await secondDragHandle.press("ArrowUp")
  await expect(page.getByRole("status").filter({ hasText: `已移动到${editedTitle}的位置` })).toBeVisible()
  const orderResponse = page.waitForResponse((response) => response.url().endsWith("/api/tasks/order") && response.request().method() === "PUT" && response.ok())
  await secondDragHandle.press("Space")
  await orderResponse
  const readOrder = () => page.locator("article h3").allTextContents()
  await expect.poll(readOrder).toEqual([secondTitle, editedTitle])

  await page.reload()
  await expect(page.getByRole("heading", { name: "任务管理", exact: true })).toBeVisible()
  await expect.poll(readOrder).toEqual([secondTitle, editedTitle])

  await page.keyboard.press("Control+k")
  const search = page.getByRole("combobox", { name: "全局搜索" })
  await search.fill(editedTitle)
  const result = page.getByRole("option", { name: new RegExp(editedTitle) })
  await expect(result).toBeVisible()
  await result.click()
  await expect(page).toHaveURL(/\/tasks\?focus=/)
  await expect(page.getByRole("article", { name: editedTitle, exact: true })).toBeFocused()

  await page.getByRole("button", { name: "切换到深色模式", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "切换到浅色模式", exact: true }).click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)

  await page.getByRole("button", { name: `完成“${secondTitle}”`, exact: true }).click()
  await expect(page.getByRole("button", { name: `重开“${secondTitle}”`, exact: true })).toBeVisible()

  for (const [path, heading] of [["/admin/users", "账号管理"], ["/review", "工作复盘"], ["/talent", "人才筛选"]] as const) {
    await page.goto(path)
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible()
  }
  await expect(page.getByRole("heading", { name: "人才九宫格", exact: true })).toBeVisible()

  await page.getByRole("button", { name: "打开用户菜单", exact: true }).click()
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click()
  await expect(page.getByRole("heading", { name: "欢迎回来", exact: true })).toBeVisible()
  expect((await context.cookies()).some((cookie) => cookie.name === "DASHBOARD_SESSION")).toBe(false)
})

test("level 3 直接访问管理员路由会被拒绝", async ({ page }) => {
  await login(page, "staff", "staff123")
  for (const path of ["/admin/users", "/review", "/talent"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
  }
  await expect(page.getByRole("link", { name: "账号管理", exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "工作复盘", exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "人才筛选", exact: true })).toHaveCount(0)
})
