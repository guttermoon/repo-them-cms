// lib/nav.ts is the site's map of its designed pages: the header, the
// footer's columns, the phone menu, the sitemap, /llms.txt and the audits all
// read it. These check the map against the pages that actually exist under
// app/, in both directions, and check that no page written in Notion can take
// an address a built-in route already answers.
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { FOOTER_COLUMNS, INDEXED_PAGES, MAIN_NAV, MORE_NAV, UNINDEXED_PAGES, navItem } from "../lib/nav.ts"
import { RESERVED_SEGMENTS } from "../lib/notion/schema.ts"
import { isReservedPath } from "../lib/notion/rows.ts"

const APP = fileURLToPath(new URL("../app/", import.meta.url))

/** Every designed route under app/ that renders a page, as a path. Dynamic
 *  segments are Notion's (pages, posts, categories, tags), not the map's. */
function pageRoutes(dir = APP, base = "") {
  const routes = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    if (entry === "api" || entry.startsWith("[") || entry.startsWith("_")) continue
    const route = `${base}/${entry}`
    if (existsSync(join(full, "page.tsx"))) routes.push(route)
    routes.push(...pageRoutes(full, route))
  }
  return routes
}

const pagePath = (href) => join(APP, href === "/" ? "" : href.slice(1), "page.tsx")

test("every page in the map exists", () => {
  for (const { href } of INDEXED_PAGES) {
    assert.ok(existsSync(pagePath(href)), `${href} is in lib/nav.ts but app${href}/page.tsx does not exist`)
  }
  for (const href of UNINDEXED_PAGES) assert.ok(existsSync(pagePath(href)), href)
})

test("every page that exists is in the map, or deliberately not", () => {
  const known = new Set([...INDEXED_PAGES.map((p) => p.href), ...UNINDEXED_PAGES])
  for (const route of pageRoutes()) {
    assert.ok(known.has(route), `app${route}/page.tsx exists but is in no navigation and not in the sitemap: add it to lib/nav.ts`)
  }
})

test("an unindexed page says noindex itself", () => {
  for (const href of UNINDEXED_PAGES) {
    assert.match(readFileSync(pagePath(href), "utf8"), /noindex: true/, `${href} is out of the sitemap but not marked noindex`)
  }
})

test("no page is listed twice", () => {
  const hrefs = INDEXED_PAGES.map((p) => p.href)
  assert.equal(new Set(hrefs).size, hrefs.length, hrefs.join(", "))
})

test("the homepage leads the sitemap at the top priority", () => {
  assert.equal(INDEXED_PAGES[0].href, "/")
  assert.equal(INDEXED_PAGES[0].priority, 1)
  for (const { href, priority } of INDEXED_PAGES) {
    if (priority === undefined) continue
    assert.ok(priority > 0 && priority <= 1, `${href} priority ${priority}`)
  }
})

test("the header stays at four links", () => {
  // a fifth link means deciding which of these it replaces
  assert.equal(MAIN_NAV.length, 4)
})

test("the footer's columns only link pages in the map, and between them link every one", () => {
  const known = new Set([...MAIN_NAV, ...MORE_NAV].map((i) => i.href))
  const linked = new Set()
  for (const column of FOOTER_COLUMNS) {
    assert.ok(column.items.length > 0, `${column.key} is empty`)
    for (const item of column.items) {
      assert.ok(known.has(item.href), `${column.key}: ${item.href}`)
      linked.add(item.href)
    }
  }
  for (const href of known) assert.ok(linked.has(href), `${href} is in no footer column`)
})

test("navItem finds by href and refuses a wrong one loudly", () => {
  assert.equal(navItem("/team").name, "Team")
  assert.throws(() => navItem("/nowhere"), /no entry for \/nowhere/)
})

test("a Notion page can never take an address a built-in route answers", () => {
  // every top-level folder and file route under app/, by the address it answers
  const builtIn = []
  for (const entry of readdirSync(APP)) {
    if (entry.startsWith("[") || entry.startsWith("_") || entry.startsWith("(")) continue
    const full = join(APP, entry)
    if (statSync(full).isDirectory()) builtIn.push(entry)
  }
  builtIn.push("robots.txt", "sitemap.xml")
  // and every address next.config.mjs redirects
  const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8")
  for (const [, source] of config.matchAll(/source: "\/([a-z][\w.-]*)"/g)) builtIn.push(source)
  for (const segment of builtIn) {
    assert.ok(RESERVED_SEGMENTS.includes(segment), `app/${segment} answers /${segment}, but lib/notion/schema.ts does not reserve it`)
    assert.ok(isReservedPath(`${segment}/anything`), segment)
  }
  assert.equal(isReservedPath("story"), false)
  assert.equal(isReservedPath("story/blog"), false, "only the first segment is the site's")
})

test("the old /services and /setup land on their sections of /features, for good", () => {
  const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8")
  assert.match(config, /source: "\/setup", destination: "\/features#deploy", permanent: true/)
  assert.match(config, /source: "\/services", destination: "\/features#services", permanent: true/)
  assert.ok(!existsSync(join(APP, "services")) && !existsSync(join(APP, "setup")), "a page left behind would never be reached")
})

test("the header is four links as one group, with the blog in the footer", () => {
  assert.deepEqual(MAIN_NAV.map((i) => i.href), ["/features", "/pricing", "/shop", "/about"])
  assert.ok(FOOTER_COLUMNS.some((c) => c.items.some((i) => i.href === "/blog")))
  assert.ok(FOOTER_COLUMNS.some((c) => c.items.some((i) => i.href === "/team")))
})
