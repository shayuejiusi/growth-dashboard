import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ConfirmDialog } from "./ConfirmDialog"
import { Popconfirm } from "./Popconfirm"
import { StatePanel } from "./StatePanel"

describe("反馈组件", () => {
  it("StatePanel 统一加载、错误和空状态", async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<StatePanel status="loading" />)
    expect(screen.getByRole("status")).toHaveTextContent("正在加载")

    rerender(<StatePanel status="error" description="加载失败" onRetry={retry} />)
    expect(screen.getByRole("alert")).toHaveTextContent("加载失败")
    await user.click(screen.getByRole("button", { name: "重新加载" }))
    expect(retry).toHaveBeenCalledOnce()

    rerender(<StatePanel status="empty" description="暂无任务" />)
    expect(screen.getByRole("status")).toHaveTextContent("暂无任务")
  })

  it("ConfirmDialog 使用明确动作文案并支持取消", async () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="删除任务"
        description="删除后不可恢复。"
        cancelText="保留任务"
        actionText="确认删除"
        onCancel={cancel}
        onConfirm={confirm}
      />,
    )

    await user.click(screen.getByRole("button", { name: "保留任务" }))
    expect(cancel).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "确认删除" }))
    expect(confirm).toHaveBeenCalledOnce()
  })

  it("Popconfirm 通过 Popover 完成轻量确认", async () => {
    const confirm = vi.fn()
    const user = userEvent.setup()
    render(
      <Popconfirm title="标记为已完成？" actionText="完成" onConfirm={confirm}>
        <button type="button">标记任务</button>
      </Popconfirm>,
    )

    await user.click(screen.getByRole("button", { name: "标记任务" }))
    expect(screen.getByText("标记为已完成？")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "完成" }))
    expect(confirm).toHaveBeenCalledOnce()
  })
})
