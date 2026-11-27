// Notion's colours survive the build (lib/notion-colors.ts): Tailwind keeps
// only the classes it finds written in the code, and a class made from a
// row's colour (`n-tag-${color}`) never is. In production that dropped the
// red, yellow, purple and pink pills and every coloured word but grey and
// red. This builds app/globals.css as `next build` does and finds each.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import postcss from "postcss"
import tailwindcss from "tailwindcss"

import { colorClass, NOTION_COLOR_CLASSES } from "../lib/notion-colors.ts"

const source = await readFile(new URL("../app/globals.css", import.meta.url), "utf8")
const built = (await postcss([tailwindcss({ config: new URL("../tailwind.config.ts", import.meta.url).pathname })]).process(source, { from: "app/globals.css" })).css
const has = (cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(built)

test("every colour class the site builds from Notion's data is in the built stylesheet", () => {
  const missing = NOTION_COLOR_CLASSES.filter((cls) => !has(cls))
  assert.deepEqual(missing, [])
})

test("every Notion colour class the stylesheet defines is one the build keeps", () => {
  // a colour class added to globals.css must be added to the list too, or
  // the build drops it the day nothing in the code spells it out
  const defined = [...new Set([...source.matchAll(/\.(n-(?:c|bg|tag)-[a-z]+)\b/g)].map((m) => m[1]))]
  assert.ok(defined.length >= 28, `found ${defined.length}`)
  assert.deepEqual(defined.filter((cls) => !NOTION_COLOR_CLASSES.includes(cls)), [])
})

test("every colour Notion can give a row's words or a select maps to a class the build keeps", () => {
  const colours = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]
  for (const c of colours) {
    assert.ok(has(colorClass(c)), c)
    assert.ok(has(colorClass(`${c}_background`)), `${c}_background`)
    assert.ok(has(`n-tag-${c}`), `n-tag-${c}`)
  }
})
