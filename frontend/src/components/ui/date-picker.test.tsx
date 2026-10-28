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
})
