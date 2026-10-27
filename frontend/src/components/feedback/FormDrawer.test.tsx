import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { FormDrawer } from "./FormDrawer"

describe("表单 Drawer", () => {
  it("未保存时先确认放弃，确认后才关闭", async () => {
    const openChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FormDrawer open dirty onOpenChange={openChange} title="编辑任务" description="修改任务内容">
        <label htmlFor="task-title">任务标题</label>
        <input id="task-title" defaultValue="未保存内容" />
      </FormDrawer>,
    )

    await user.click(screen.getByRole("button", { name: "关闭编辑任务" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("放弃未保存修改")
    expect(openChange).not.toHaveBeenCalledWith(false)

    await user.click(screen.getByRole("button", { name: "继续编辑" }))
    expect(openChange).not.toHaveBeenCalledWith(false)
    await user.click(screen.getByRole("button", { name: "关闭编辑任务" }))
    await user.click(await screen.findByRole("button", { name: "放弃修改" }))
    expect(openChange).toHaveBeenCalledWith(false)
  })

  it("没有修改时可直接关闭", async () => {
    const openChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FormDrawer open dirty={false} onOpenChange={openChange} title="编辑任务">
        <p>表单内容</p>
      </FormDrawer>,
    )

    await user.click(screen.getByRole("button", { name: "关闭编辑任务" }))
    expect(openChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("clean 状态蒙层不关闭，Escape 可直接关闭", async () => {
    const openChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FormDrawer open dirty={false} onOpenChange={openChange} title="编辑任务">
        <input aria-label="任务标题" defaultValue="内容" />
      </FormDrawer>,
    )
    const overlay = document.querySelector("[data-slot='drawer-overlay']")
    expect(overlay).not.toBeNull()

    await user.click(overlay as Element)
    expect(openChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    screen.getByRole("textbox", { name: "任务标题" }).focus()
    await user.keyboard("{Escape}")
    expect(openChange).toHaveBeenCalledWith(false)
  })

  it("dirty 状态蒙层不关闭，Escape 需确认放弃后才关闭", async () => {
    const openChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FormDrawer open dirty onOpenChange={openChange} title="编辑任务">
        <input aria-label="任务标题" defaultValue="未保存内容" />
      </FormDrawer>,
    )
    const overlay = document.querySelector("[data-slot='drawer-overlay']")
    expect(overlay).not.toBeNull()

    fireEvent.pointerDown(overlay as Element)
    expect(openChange).not.toHaveBeenCalledWith(false)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    screen.getByRole("textbox", { name: "任务标题" }).focus()
    await user.keyboard("{Escape}")
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("放弃未保存修改")
    expect(openChange).not.toHaveBeenCalledWith(false)
    await user.click(screen.getByRole("button", { name: "放弃修改" }))
    expect(openChange).toHaveBeenCalledWith(false)
  })
})
