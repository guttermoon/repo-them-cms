// A lede, the sentence under a title, is set in the words' colour
// (text-ink): black in light, the words' own colour in every other look,
// never the secondary grey. The title leads by its size and its face, so
// the sentence that explains it reads as plainly as the rest of the page.
// The heroes, the section heads, the page heads, the shop's frame, the
// service counter and the last call to action all set theirs this way.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { ROOT, sourceFiles } from "./support/sources.mjs"

const FILES = sourceFiles(["app", "components"], /\.tsx$/)

// a paragraph set at the lede's size: text-lead as its own size, not a
// breakpoint's (sm:text-lead belongs to smaller text that grows)
const LEDE = /<p\b[^>]*className=\{?[`"]([^`"]*(?<![\w:-])text-lead\b[^`"]*)[`"]/g

test("every lede is set in the words' colour, never the secondary grey", () => {
  const grey = []
  let ledes = 0
  for (const file of FILES) {
    for (const [, classes] of readFileSync(join(ROOT, file), "utf8").matchAll(LEDE)) {
      if (!/\bleading-relaxed\b/.test(classes)) continue
      ledes++
      if (/(?<![\w:-])text-sub\b/.test(classes)) grey.push(`${file}: ${classes}`)
    }
  }
  assert.ok(ledes >= 7, `found only ${ledes} ledes: the pattern no longer finds them`)
  assert.deepEqual(grey, [])
})
