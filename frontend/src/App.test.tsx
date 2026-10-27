import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import App from "./App"

describe("应用工程底座", () => {
  it("shows a Chinese shell without later-stage capability features", () => {
    const { container } = render(<App />)

    expect(
      screen.getByRole("heading", { name: "个人工作看板", level: 1 }),
    ).toBeInTheDocument()
    expect(container).not.toHaveTextContent("能力成长")
    expect(container).not.toHaveTextContent("能力评估")
    expect(container).not.toHaveTextContent("驾驶舱")
  })
})
