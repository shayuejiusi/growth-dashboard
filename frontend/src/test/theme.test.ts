import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const css = readFileSync("src/index.css", "utf8")

describe("暖白墨绿设计 Token", () => {
  it("provides semantic light and dark theme colors", () => {
    expect(css).toContain("--background: 60 20% 97%")
    expect(css).toContain("--foreground: 150 12% 16%")
    expect(css).toContain("--primary: 158 37% 29%")
    expect(css).toContain("--primary-foreground: 0 0% 100%")
    expect(css).toContain("--ring: 158 37% 29%")
    expect(css).toContain("--radius: .75rem")
    expect(css).toMatch(/\.dark\s*\{[^}]*--background: 150 10% 10%/s)
    expect(css).toMatch(/\.dark\s*\{[^}]*--primary: 151 30% 60%/s)
  })
})
