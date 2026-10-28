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

async function openNewTask(page: Page) {
  await page.locator("section[aria-labelledby='tasks-title']").getByRole("button", { name: "新建任务", exact: true }).click()
}

test("任务 Drawer 可翻月、保存日期，并在编辑时清除日期", async ({ page }) => {
  const title = `日期抽屉回归 ${Date.now()}`
  await openNewTask(page)
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
  const article = page.getByRole("article", { name: title, exact: true })
  await expect(article).toBeVisible()
  await article.getByRole("button", { name: `编辑 “${title}”`, exact: true }).click()
  await expect(trigger).not.toHaveText("选择日期")
  await trigger.click()
  await calendar.getByRole("button", { name: "清除日期" }).click()
  await expect(trigger).toHaveText("选择日期")
  await page.getByRole("button", { name: "保存任务", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await article.getByRole("button", { name: `编辑 “${title}”`, exact: true }).click()
  await expect(trigger).toHaveText("选择日期")
  await page.getByRole("button", { name: "关闭编辑任务" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
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

test("日期面板支持键盘、焦点恢复和未保存关闭保护", async ({ page }) => {
  await openNewTask(page)
  const trigger = page.locator("#task-due-date")
  const calendar = page.getByRole("dialog", { name: "选择日期" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(calendar).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(calendar).not.toBeVisible()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.getByLabel("任务标题", { exact: true }).click()
  await expect(calendar).not.toBeVisible()
  await expect(page.getByRole("dialog", { name: "新建任务" })).toBeVisible()
  await trigger.click()
  await calendar.locator("tbody button").first().focus()
  await page.keyboard.press("Enter")
  await expect(calendar).not.toBeVisible()
  await expect(trigger).not.toHaveText("选择日期")

  await page.getByRole("button", { name: "关闭新建任务" }).click()
  await expect(page.getByRole("alertdialog", { name: "放弃未保存修改" })).toBeVisible()
  await page.getByRole("button", { name: "继续编辑" }).click()
  await expect(trigger).not.toHaveText("选择日期")
  await page.getByRole("button", { name: "关闭新建任务" }).click()
  await page.getByRole("button", { name: "放弃修改" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("手机深色模式中日期面板不超出视口且可选择", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.getByRole("button", { name: "切换到深色模式" }).click()
  await openNewTask(page)
  const trigger = page.locator("#task-due-date")
  await trigger.click()
  const calendar = page.getByRole("dialog", { name: "选择日期" })
  await expect(calendar).toBeVisible()
  const bounds = await calendar.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds?.x).toBeGreaterThanOrEqual(0)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 321)).toBeLessThanOrEqual(320)
  await calendar.locator("tbody button").last().click()
  await expect(trigger).not.toHaveText("选择日期")
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test("文档导入预览可修改日期并导入", async ({ page }) => {
  const title = `日期导入回归 ${Date.now()}`
  await page.getByRole("button", { name: "快速新建", exact: true }).click()
  await page.getByRole("tab", { name: "文档导入" }).click()
  await page.getByLabel("文本内容").fill(`2026-11-02 ${title}`)
  await page.getByRole("button", { name: "本地快速识别（简单规则）" }).click()
  const trigger = page.locator("#draft-date-0")
  await expect(trigger).toHaveText("2026年11月2日")
  await trigger.click()
  await page.getByRole("button", { name: "2026年11月3日", exact: true }).click()
  await expect(trigger).toHaveText("2026年11月3日")
  await page.getByRole("button", { name: "导入所选任务（1 项）" }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("tab", { name: /全部任务/ }).click()
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible()
})
