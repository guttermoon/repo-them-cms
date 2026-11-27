// A thing pressed is 44 by 44 at least (WCAG 2.5.5, level AAA), whatever its
// words; a link inside a sentence is the one exception. The size is one
// token, min-h-target and min-w-target (tailwind.config.ts), and no
// component types a smaller one. What only a browser can measure, the size a
// control is drawn at, is held by `npm run a11y` (scripts/aaa-checks.mjs).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { ROOT, sources } from "./support/sources.mjs"

const SOURCES = sources(["components", "app"]).map(({ path, text }) => [path, text])

test("the target is 44 by 44, one token each way", () => {
  // read as text, as tests/shapes.test.mjs reads it: the config loads its plugin with require
  const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8")
  assert.match(config, /minHeight: \{ target: "44px" \}/)
  assert.match(config, /minWidth: \{ target: "44px" \}/)
})

test("no component types a height or a width under the target", () => {
  assert.ok(SOURCES.length > 50, `only ${SOURCES.length} files read`)
  const under = []
  for (const [file, source] of SOURCES) {
    for (const match of source.matchAll(/\bmin-[hw]-\[(\d+(?:\.\d+)?)px\]/g)) {
      // a mark drawn for the eye alone (a count on the cart) is pressed through what holds it
      const tag = source.slice(source.lastIndexOf("<", match.index), source.indexOf(">", match.index))
      if (Number(match[1]) < 44 && !/aria-hidden="true"/.test(tag)) under.push(`${file}: ${match[0]}`)
    }
  }
  assert.deepEqual(under, [], "use min-h-target or min-w-target")
})

test("a control drawn at a fixed size is drawn at 44px each way: the look's switch, the menu's button, the cart's quantity", () => {
  const switcher = readFileSync(join(ROOT, "components/ui/theme-switch.tsx"), "utf8")
  assert.match(switcher, /inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full/)
  // a button sized by a fixed height and width under 44 (h-9 w-9, size-10)
  const small = []
  for (const [file, source] of SOURCES) {
    for (const [tag] of source.matchAll(/<(?:button|a|Link|summary|input|select|textarea)\b(?:=>|[^>])*?className=(?:"[^"]*"|\{`[^`]*`\})/g)) {
      const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag)
      const names = (cls[1] ?? cls[2]).split(/\s+/)
      // a height or a width fixed under 44px (h-10, w-9, size-8), not lifted by
      // the target; the tag is read past an arrow function's => in a handler
      const short = names.some((n) => /^(?:h|size)-(?:[1-9]|10)$/.test(n)) && !names.includes("min-h-target")
      const narrow = names.some((n) => /^(?:w|size)-(?:[1-9]|10)$/.test(n)) && !names.includes("min-w-target")
      if (short || narrow) small.push(`${file}: ${tag.slice(0, 90)}`)
    }
  }
  assert.deepEqual(small, [])
})
