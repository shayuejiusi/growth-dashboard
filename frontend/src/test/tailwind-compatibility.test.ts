import { readFileSync } from "node:fs"

import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { beforeAll, describe, expect, it } from "vitest"

const sourceCss = readFileSync("src/index.css", "utf8")
let compiledCss = ""

beforeAll(async () => {
  const result = await postcss([
    tailwindcss({ config: "tailwind.config.js" }),
  ]).process(sourceCss, { from: "src/index.css" })
  compiledCss = result.css
})

function declarationsFor(selector: string) {
  return [...compiledCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].includes(selector))
    .map((match) => match[2])
    .join("\n")
}

describe("Tailwind 3 组件兼容编译", () => {
  it("compiles Alert icon layout with an explicit 1rem column", () => {
    const declarations = declarationsFor(":has(>svg)")

    expect(declarations).toMatch(/grid-template-columns:\s*1rem 1fr/)
    expect(compiledCss).not.toContain("var(--spacing)")
  })

  it("compiles CardAction header layout with two columns", () => {
    const declarations = declarationsFor(":has([data-slot=card-action])")

    expect(declarations).toMatch(/grid-template-columns:\s*1fr auto/)
  })

  it("wraps Sonner HSL channels for light and dark themes", () => {
    const sonner = readFileSync("src/components/ui/sonner.tsx", "utf8")

    expect(sonner).toContain('"--normal-bg": "hsl(var(--popover))"')
    expect(sonner).toContain(
      '"--normal-text": "hsl(var(--popover-foreground))"',
    )
    expect(sonner).toContain('"--normal-border": "hsl(var(--border))"')
  })
})
