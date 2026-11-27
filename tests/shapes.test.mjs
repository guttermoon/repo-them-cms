// Shape (docs/design.md): a corner is a pill or one of four sizes, and
// nothing between. Read from the code; tests/dom/support/checks.ts
// (checkShapes) holds every rendered page to which shape each thing takes.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { sourceFiles } from "./support/sources.mjs"

const root = new URL("..", import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), "utf8")
const css = read("app/globals.css")
const config = read("tailwind.config.ts")

/** Code without its comments, so a comment's "rounded down" is not a class. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")

const SCALE = ["none", "text", "block", "card", "panel", "full"]

test("the corners are one scale: four sizes and the pill, each a --r-* in every look, growing with size", () => {
  const body = /borderRadius:\s*\{([^}]*)\}/.exec(config)?.[1]
  assert.ok(body, "tailwind.config.ts sets no borderRadius")
  assert.ok(!/extend:\s*\{[^]*borderRadius/.test(config.slice(config.indexOf("extend:"))), "the scale extends Tailwind's rather than replacing it")
  const names = [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
  assert.deepEqual(names, SCALE)
  const sizes = ["text", "block", "card", "panel"].map((name) => {
    assert.match(body, new RegExp(`${name}: "var\\(--r-${name}\\)"`), `${name} is not --r-${name}`)
    const value = new RegExp(`--r-${name}: (\\d+)px;`).exec(css)?.[1]
    assert.ok(value, `--r-${name} is not set in app/globals.css`)
    return Number(value)
  })
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes, "the sizes do not grow")
  // nested: an option in a menu (a block in a card, 6px in) keeps the curve
  assert.equal(sizes[2] - sizes[1], 6, "a block inside a card's 6px padding is not concentric with it")
})

test("no corner outside the scale: no rounded-[…], no Tailwind sizes, no bare rounded, no typed border-radius", () => {
  const off = []
  for (const path of sourceFiles(["components", "app", "lib"], /\.(tsx?|css)$/)) {
    const source = code(read(path))
    for (const match of source.matchAll(/(?<![\w-])(?:[\w-]+:)*rounded(?:-(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(\[[^\]\s]*\]|[\w.]+))?(?![\w-])/g)) {
      const size = match[1]
      if (size && SCALE.includes(size)) continue
      off.push(`${path}: ${match[0]}`)
    }
    if (path.endsWith(".css")) {
      for (const [, value] of source.matchAll(/border-radius:\s*([^;]+);/g)) {
        if (!/^var\(--r-(text|block|card|panel)\)$|^9999px$/.test(value.trim())) off.push(`${path}: border-radius: ${value}`)
      }
    }
  }
  assert.deepEqual(off, [])
})

test("what a reader presses or types in is a pill: the buttons, the field, the select", () => {
  const button = read("components/ui/button.tsx")
  assert.match(/const BASE =\s*"([^"]*)"/.exec(button)?.[1] ?? "", /(^|\s)rounded-full(\s|$)/, "a button is not a pill")
  const field = /\.field \{\s*@apply ([^;]*);/.exec(css)?.[1] ?? ""
  assert.match(field, /(^|\s)rounded-full(\s|$)/, "the field is not a pill")
  assert.match(css, /\.field:is\(textarea\) \{\s*@apply rounded-panel/, "a field too tall for a pill does not keep a pill's curve")
  const select = read("components/system/select-line.tsx")
  assert.match(select, /className="field field-choice/, "the select's button is not the field")
  assert.match(select, /role="listbox"[^]*rounded-card/, "the select's menu is not a card")
  assert.match(select, /role="option"[^]*rounded-block/, "the select's options are not blocks")
})
