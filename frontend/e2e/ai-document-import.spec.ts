import { expect, test } from "@playwright/test"

test("真实千问拆解学校通知并在预览确认后创建三分类任务", async ({ page }) => {
  test.skip(process.env.RUN_REAL_AI_E2E !== "1" || !process.env.AI_API_KEY, "仅在显式提供真实 AI 配置时运行")
  test.setTimeout(120_000)
  const importedTitles: string[] = []

  await page.goto("/login")
  await page.getByLabel("用户名", { exact: true }).fill("admin")
  await page.getByLabel("密码", { exact: true }).fill("admin123")
  await page.getByRole("button", { name: "登录", exact: true }).click()
  await expect(page.getByRole("heading", { name: "工作台", exact: true })).toBeVisible()

  try {
    await page.goto("/tasks")
    await page.getByRole("button", { name: "快速新建", exact: true }).click()
    await page.getByRole("tab", { name: "文档导入", exact: true }).click()
    await page.getByLabel("文本内容", { exact: true }).fill(
      "工作通知：各班于10月30日前完成学生心理健康排查，并将结果报送德育处。各教研组于11月2日前提交期中考试质量分析。",
    )
    await page.getByRole("button", { name: "AI 智能分析", exact: true }).click()

    await expect(page.getByRole("heading", { name: "德育（1 项）", exact: true })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole("heading", { name: "教学（1 项）", exact: true })).toBeVisible()
    importedTitles.push(...await page.locator("input[id^='draft-title-']").evaluateAll(
      (inputs) => inputs.map((input) => (input as HTMLInputElement).value),
    ))
    expect(importedTitles).toHaveLength(2)

    await page.getByRole("button", { name: "导入所选任务（2 项）", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByRole("tab", { name: /全部任务/ }).click()
    for (const title of importedTitles) {
      await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible()
    }

    const response = await page.request.get("/api/tasks")
    expect(response.ok()).toBe(true)
    const tasks = await response.json() as Array<{ title: string; category: string; source: string; note: string }>
    const created = tasks.filter((task) => importedTitles.includes(task.title))
    expect(created).toHaveLength(2)
    expect(new Set(created.map((task) => task.category))).toEqual(new Set(["德育", "教学"]))
    expect(created.every((task) => task.source === "AI 文档导入" && task.note.startsWith("原文依据："))).toBe(true)
  } finally {
    if (importedTitles.length) {
      const csrfResponse = await page.request.get("/api/auth/csrf")
      const { csrfToken } = await csrfResponse.json()
      const response = await page.request.get("/api/tasks")
      const tasks = await response.json() as Array<{ id: string; title: string }>
      for (const task of tasks.filter((item) => importedTitles.includes(item.title))) {
        await page.request.delete(`/api/tasks/${task.id}`, { headers: { "X-CSRF-TOKEN": csrfToken } })
      }
    }
  }
})
