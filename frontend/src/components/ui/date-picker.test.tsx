import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { DatePicker } from "./date-picker"

function ControlledDatePicker({ initialValue = "2099-12-15" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <label htmlFor="due-date">截止日期</label>
      <DatePicker id="due-date" value={value} onChange={setValue} />
      <output aria-label="表单日期">{value}</output>
    </>
  )
}

describe("日期选择器", () => {
  it("在站内面板选择日期并同步表单值", async () => {
    const user = userEvent.setup()
    render(<ControlledDatePicker />)

    await user.click(screen.getByRole("button", { name: "截止日期" }))
    expect(screen.getByRole("dialog", { name: "选择日期" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "2099年12月31日" }))

    expect(screen.getByLabelText("表单日期")).toHaveTextContent("2099-12-31")
    expect(screen.queryByRole("dialog", { name: "选择日期" })).not.toBeInTheDocument()
  })

  it("支持跨月浏览和清除已选日期", async () => {
    const user = userEvent.setup()
    render(<ControlledDatePicker />)

    await user.click(screen.getByRole("button", { name: "截止日期" }))
    await user.click(screen.getByRole("button", { name: "下个月" }))
    expect(screen.getByText("2100年1月")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "上个月" }))
    expect(screen.getByText("2099年12月")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "清除日期" }))

    expect(screen.getByLabelText("表单日期")).toHaveTextContent("")
    expect(screen.getByRole("button", { name: "截止日期" })).toHaveTextContent("选择日期")
  })

  it.each([
    { value: "0000-01-02", label: "0年1月2日", month: "0年1月", nextMonth: "0年2月" },
    { value: "0099-12-31", label: "99年12月31日", month: "99年12月", nextMonth: "100年1月" },
  ])("正确显示并浏览低年份日期 $value", async ({ value, label, month, nextMonth }) => {
    const user = userEvent.setup()
    render(<ControlledDatePicker initialValue={value} />)

    expect(screen.getByRole("button", { name: "截止日期" })).toHaveTextContent(label)
    await user.click(screen.getByRole("button", { name: "截止日期" }))
    expect(screen.getByRole("heading", { name: month })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "下个月" }))
    expect(screen.getByRole("heading", { name: nextMonth })).toBeVisible()
  })

  it("在支持的年份边界禁用越界翻月", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ControlledDatePicker initialValue="0000-01-02" />)
    await user.click(screen.getByRole("button", { name: "截止日期" }))
    expect(screen.getByRole("button", { name: "上个月" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "清除日期" }))

    rerender(<ControlledDatePicker key="maximum" initialValue="9999-12-31" />)
    await user.click(screen.getByRole("button", { name: "截止日期" }))
    expect(screen.getByRole("button", { name: "下个月" })).toBeDisabled()
  })
})
