import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("exposes a visible focus ring and disabled state", async () => {
    render(
      <>
        <Button>新建任务</Button>
        <Button disabled>保存任务</Button>
      </>,
    )

    const create = screen.getByRole("button", { name: "新建任务" })
    create.focus()

    expect(create).toHaveFocus()
    expect(create).toHaveClass("focus-visible:ring-[3px]")
    expect(screen.getByRole("button", { name: "保存任务" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "保存任务" })).toHaveClass(
      "disabled:pointer-events-none",
      "disabled:opacity-50",
    )
  })
})
