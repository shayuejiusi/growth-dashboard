import { expect, test, type Page } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("用户名", { exact: true }).fill("admin")
  await page.getByLabel("密码", { exact: true }).fill("admin123")
  await page.getByRole("button", { name: "登录", exact: true }).click()
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()
  await page.goto("/tasks")
})

async function chooseLastDay(page: Page, triggerId: string) {
  const trigger = page.locator(triggerId)
  await trigger.click()
  const calendar = page.getByRole("dialog", { name: "选择日期" })
  await expect(calendar).toBeVisible()
  await calendar.locator("tbody button").last().click()
  await expect(calendar).not.toBeVisible()
  await expect(trigger).not.toHaveText("选择日期")
}

test("任务 Drawer 中可翻月、选择日期并保存任务", async ({ page }) => {
  const title = `日期抽屉回归 ${Date.now()}`
  await page.locator("section[aria-labelledby='tasks-title']").getByRole("button", { name: "新建任务", exact: true }).click()
  await page.getByLabel("任务标题", { exact: true }).fill(title)

  const trigger = page.locator("#task-due-date")
  await trigger.click()
  const calendar = page.getByRole("dialog", { name: "选择日期" })
  const initialMonth = await calendar.locator("[aria-live='polite']").textContent()
  await calendar.getByRole("button", { name: "下个月" }).click()
  await expect(calendar.locator("[aria-live='polite']")).not.toHaveText(initialMonth ?? "")
  await calendar.getByRole("button", { name: "上个月" }).click()
  await calendar.locator("tbody button").last().click()
  await expect(trigger).not.toHaveText("选择日期")
  await page.getByRole("button", { name: "保存任务", exact: true }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("tab", { name: /全部任务/ }).click()
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible()
})

test("快速新建中的日期面板可选择并保存", async ({ page }) => {
  const title = `日期快速新建回归 ${Date.now()}`
  await page.getByRole("button", { name: "快速新建", exact: true }).click()
  await page.getByLabel("任务标题", { exact: true }).fill(title)
  await chooseLastDay(page, "#quick-due-date")
  await page.getByRole("button", { name: "创建任务", exact: true }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("tab", { name: /全部任务/ }).click()
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible()
})
