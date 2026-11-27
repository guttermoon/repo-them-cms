// The type scale (tailwind.config.ts, docs/design.md "Type"): every size of
// type on the site is one of ten steps, or one of four that grow with the
// window. A size typed into markup is a step nobody chose.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { ROOT, sourceFiles } from "./support/sources.mjs"

const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8")
const block = config.slice(config.indexOf("fontSize: {"), config.indexOf("}", config.indexOf("fontSize: {")))
const scale = Object.fromEntries([...block.matchAll(/^\s*"?([\w-]+)"?:\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]))

const FILES = sourceFiles(["app", "components", "lib"])

test("the scale is ten fixed steps, smallest first, and four fluid ones", () => {
  const fixed = Object.entries(scale).filter(([, value]) => /^\d+px$/.test(value))
  assert.deepEqual(fixed.map(([name]) => name), ["micro", "fine", "small", "ui", "body", "lead", "head-s", "head-m", "head-l", "display"])
  const sizes = fixed.map(([, value]) => parseInt(value, 10))
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), "each step is larger than the last")
  // steps are far enough apart to be told from one another
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] - sizes[i - 1] >= 1 && sizes[i] / sizes[i - 1] <= 1.6, `${sizes[i - 1]} to ${sizes[i]}`)
  assert.deepEqual(Object.keys(scale).filter((name) => name.startsWith("fluid-")).sort(), ["fluid-giant", "fluid-hero", "fluid-section", "fluid-title"])
})

test("no size of type is typed into markup: no text-[…px], no text-[clamp(…)], none of Tailwind's own", () => {
  const typed = FILES.flatMap((file) =>
    [...readFileSync(join(ROOT, file), "utf8").matchAll(/(?<![\w-])text-(\[(?:\d[\d.]*(?:px|rem|vw|cqi)|clamp)[^\]]*\]|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g)].map((m) => `${file}: ${m[0]}`),
  )
  assert.deepEqual(typed, [])
})

test("a breakpoint never asks for the size already set", () => {
  const same = FILES.flatMap((file) =>
    [...readFileSync(join(ROOT, file), "utf8").matchAll(/(?<![\w:-])text-([a-z-]+)(?: [^\s"`']+)*? (?:sm|md|lg|xl):text-\1(?![\w-])/g)].filter((m) => m[1] in scale).map((m) => `${file}: ${m[0]}`),
  )
  assert.deepEqual(same, [])
})
