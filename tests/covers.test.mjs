// Covers (docs/notion.md, "Covers and pictures"): where a cropped cover is
// cut, and that every cover a post, a page or a resource shows is printed in
// the look's ink (.cover-tint) and cut where Cover Position says.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { coverFrame, coverStyle } from "../lib/cover.ts"
import { COVER_POSITIONS, COVER_TINTS, PROPS, SCHEMA } from "../lib/notion/schema.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("a cover is cut where Cover Position says, and the middle needs no style", () => {
  assert.deepEqual(coverStyle(0), { objectPosition: "50% 0%" })
  assert.deepEqual(coverStyle(75), { objectPosition: "50% 75%" })
  assert.equal(coverStyle(50), undefined)
  assert.equal(coverStyle(undefined), undefined)
})

test("Cover Position's choices in Notion are the ones the site reads", () => {
  const property = SCHEMA.find((p) => p.name === PROPS.coverPosition)
  assert.ok(property, "Cover Position is not in the schema")
  assert.equal(property.type, "select")
  assert.deepEqual(property.options.map((o) => o.name), Object.keys(COVER_POSITIONS))
})

test("Cover Tint's choices in Notion are the ones the site reads, and On is the default", () => {
  const property = SCHEMA.find((p) => p.name === PROPS.coverTint)
  assert.ok(property, "Cover Tint is not in the schema")
  assert.equal(property.type, "select")
  assert.deepEqual(property.options.map((o) => o.name), [...COVER_TINTS])
  assert.match(property.description, /On \(the default, when empty\)/)
})

test("a cover's frame: printed in the look's ink, or with Cover Tint Off shown as uploaded", () => {
  assert.deepEqual(coverFrame(true, "w-full"), { className: "cover-tint w-full" })
  assert.deepEqual(coverFrame(false, "w-full"), { className: "w-full", "data-untinted": "" })
  // an entry with no Cover Tint at all (a snapshot from before it) is On, as an empty select is
  assert.deepEqual(coverFrame(undefined, "w-full"), { className: "cover-tint w-full" })
})

test("every cover of a post, a page or a resource is drawn through its frame and cut where it is told", () => {
  for (const path of ["components/notion/post-card.tsx", "components/ui/page.tsx", "app/resources/page.tsx"]) {
    const source = read(path)
    assert.match(source, /\{\.\.\.coverFrame\([^,]+, "[^"]+"\)\}/, `${path} draws a cover outside its frame`)
    assert.doesNotMatch(source, /className="cover-tint/, `${path} tints a cover Cover Tint cannot turn off`)
    assert.match(source, /style=\{coverStyle\(/, `${path} draws a cover that cannot be repositioned`)
  }
  // the page's header is told the row's choice
  assert.match(read("components/notion/entry-page.tsx"), /tint: entry\.coverTint/)
  // a portrait is cut where it is told, but keeps its colours
  const person = read("components/sections/person-card.tsx")
  assert.match(person, /style=\{coverStyle\(person\.coverAt\)\}/)
  assert.doesNotMatch(person, /cover-tint/)
})

test("a cover shown as uploaded takes no look's tint or glow, but mono still draws it in grey", () => {
  const css = read("app/globals.css")
  const rule = (start) => css.split("\n").find((line) => line.trim().startsWith(start)) ?? ""
  const dark = rule(':root[data-theme="dark"] :is(img, video, svg[role="img"]):not(')
  assert.ok(dark.includes("[data-untinted] *"), "dark's glow reaches a cover shown as uploaded")
  const mono = rule(':root[data-theme="mono"] :is(img, svg, video):not(')
  assert.ok(mono && !mono.includes("data-untinted"), "mono leaves a cover in colour, against the reader's choice")
})
