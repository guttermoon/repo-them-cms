// The site's icons (lib/icons.ts): drawn by the site, never an emoji, and
// never shipped to a browser.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { ICONS, iconForNotion, NOTION_NAMES, notionIconColor, notionIconUrl } from "../lib/icons.ts"
import { sourceFiles } from "./support/sources.mjs"

const CODE = sourceFiles(["app", "components"], /\.(tsx?|mjs)$/)

test("every icon is paths in a 256 box, and every Notion name it answers to has a drawing", () => {
  for (const [name, paths] of Object.entries(ICONS)) {
    assert.ok(paths.length > 0, name)
    for (const d of paths) assert.match(d, /^M[\d.,\s\-MLHVCSQTAZmlhvcsqtaz]+$/, `${name}: a path`)
  }
  for (const [notion, own] of Object.entries(NOTION_NAMES)) assert.ok(own in ICONS, `${notion} → ${own}`)
  // Notion's names are matched the way Notion matches them
  assert.equal(iconForNotion("Light bulb"), "lightbulb")
  assert.equal(iconForNotion("LIGHT_BULB"), "lightbulb")
  assert.equal(iconForNotion("pizza"), undefined)
  assert.equal(notionIconColor("blue"), "blue")
  assert.equal(notionIconColor(undefined), "gray")
  assert.equal(notionIconUrl("alien", "gray"), "https://www.notion.so/icons/alien_gray.svg")
})

test("the site's own pages use its icons, never an emoji, whose look changes with the reader's device", () => {
  // the arrows and the toggle triangle are text, drawn by the page's fonts
  const emoji = /(?![©®™↗→←↑↓↔✓✔✗×·▶])\p{Extended_Pictographic}/u
  const found = []
  for (const file of CODE) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, n) => {
        if (emoji.test(line)) found.push(`${file}:${n + 1}: ${line.trim().slice(0, 80)}`)
      })
  }
  assert.deepEqual(found, [])
})

test("no client component imports the icons' paths: a browser is handed an icon drawn on the server", () => {
  const offenders = CODE.filter((file) => {
    const source = readFileSync(file, "utf8")
    return /^["']use client["']/m.test(source) && /from ["']@\/(lib\/icons|components\/ui\/icon|components\/notion\/icon)["']/.test(source)
  })
  assert.deepEqual(offenders, [])
})
