import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const css = readFileSync("src/index.css", "utf8")
const tailwindConfig = readFileSync("tailwind.config.js", "utf8")

const lightTokens = {
  background: "60 20% 97%",
  foreground: "150 12% 16%",
  card: "0 0% 100%",
  "card-foreground": "150 12% 16%",
  primary: "158 37% 29%",
  "primary-foreground": "0 0% 100%",
  secondary: "90 18% 92%",
  "secondary-foreground": "150 18% 24%",
  muted: "90 14% 94%",
  "muted-foreground": "140 7% 42%",
  accent: "100 18% 91%",
  "accent-foreground": "150 20% 24%",
  destructive: "0 66% 47%",
  border: "90 12% 85%",
  input: "90 12% 85%",
  ring: "158 37% 29%",
  radius: ".75rem",
} as const

const darkTokens = {
  background: "150 10% 10%",
  foreground: "80 14% 91%",
  card: "150 9% 13%",
  "card-foreground": "80 14% 91%",
  primary: "151 30% 60%",
  "primary-foreground": "150 15% 10%",
  secondary: "150 8% 18%",
  "secondary-foreground": "80 14% 91%",
  muted: "150 8% 17%",
  "muted-foreground": "100 7% 65%",
  accent: "150 8% 20%",
  "accent-foreground": "80 14% 91%",
  destructive: "0 58% 55%",
  border: "150 7% 24%",
  input: "150 7% 24%",
  ring: "151 30% 60%",
} as const

function rule(selector: ":root" | ".dark") {
  const escaped = selector.replace(".", "\\.")
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))
  if (!match) throw new Error(`Missing ${selector} rule`)
  return match[1]
}

const lightRule = rule(":root")
const darkRule = rule(".dark")

describe("暖白墨绿设计 Token", () => {
  it.each(Object.entries(lightTokens))("light --%s", (name, value) => {
    expect(lightRule).toContain(`--${name}: ${value};`)
  })

  it.each(Object.entries(darkTokens))("dark --%s", (name, value) => {
    expect(darkRule).toContain(`--${name}: ${value};`)
  })
})

describe("Tailwind 语义映射", () => {
  it("uses class-based dark mode", () => {
    expect(tailwindConfig).toContain('darkMode: ["class"]')
  })

  it.each([
    "background",
    "foreground",
    "border",
    "input",
    "ring",
  ])("maps %s to its HSL channel", (name) => {
    expect(tailwindConfig).toContain(`${name}: "hsl(var(--${name}))"`)
  })

  it.each([
    "card",
    "popover",
    "primary",
    "secondary",
    "muted",
    "accent",
    "destructive",
  ])("maps %s and its foreground", (name) => {
    expect(tailwindConfig).toMatch(
      new RegExp(
        `${name}: \\{\\s*DEFAULT: "hsl\\(var\\(--${name}\\)\\)",\\s*foreground: "hsl\\(var\\(--${name}-foreground\\)\\)",`,
        "s",
      ),
    )
  })

  it("maps radii to the shared radius token", () => {
    expect(tailwindConfig).toContain('lg: "var(--radius)"')
    expect(tailwindConfig).toContain('md: "calc(var(--radius) - 2px)"')
    expect(tailwindConfig).toContain('sm: "calc(var(--radius) - 4px)"')
  })
})
