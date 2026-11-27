// LICENSE is MIT's text alone, under one copyright line that names the
// template as the footer does. GitHub names a repository's licence only
// when the file is a licence's own text, its copyright line set aside: with
// a note under it, the repository showed no licence at all. What MIT
// doesn't cover is said in the README's "Credits and licence", and each
// font's licence sits beside it (tests/third-parties.test.mjs).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { MAKER, TEMPLATE_NAME } from "../lib/site.ts"
import { ROOT } from "./support/sources.mjs"

const read = (path) => readFileSync(join(ROOT, path), "utf8")
const words = (text) => text.replace(/\s+/g, " ").trim()
const COPYRIGHT = /^\s*copyright\b/i

/** The MIT licence as SPDX and the Open Source Initiative give it, but for
 *  its copyright line. */
const MIT = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const lines = read("LICENSE").split("\n")

test("LICENSE is MIT's text and nothing more, so GitHub names it", () => {
  const body = lines.filter((line) => !COPYRIGHT.test(line)).join("\n")
  assert.equal(words(body), words(MIT), "LICENSE is not MIT's text alone: a note belongs in the README's credits")
})

test("LICENSE has one copyright line, naming the template as the footer does", () => {
  const copyright = lines.filter((line) => COPYRIGHT.test(line))
  assert.equal(copyright.length, 1, "one copyright line")
  assert.match(copyright[0], new RegExp(`^Copyright \\(c\\) \\d{4} ${TEMPLATE_NAME} a GitHub template by ${MAKER.studio}$`))
})

test("the README says what MIT leaves out: the fonts and Notion's badge", () => {
  const readme = words(read("README.md"))
  const credits = readme.slice(readme.indexOf("## Credits and licence"))
  assert.ok(credits.startsWith("## Credits and licence"), "the README has its credits")
  assert.match(credits, /MIT, in \[LICENSE\]\(LICENSE\), except what follows, which keeps its own terms/)
  assert.match(credits, /\*\*The fonts:\*\*[^*]*`assets\/fonts`/, "the fonts' own licences")
  assert.match(credits, /\*\*The "Made for Notion" badge\*\* in `public\/brand`[^*]*not under the MIT licence/, "the badge is not MIT's")
})
