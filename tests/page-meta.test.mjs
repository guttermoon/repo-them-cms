// Every designed page's title and description (lib/page-meta.ts), held to
// the search rules in docs/seo.md: a title Google prints whole, a
// description of 140 to 160 characters, nothing left as placeholder text,
// and no title that repeats the name the site adds after it.
//
// And every indexed page takes its metadata from that map: a page that wrote
// its own pageMeta({ … }) again would have a title its structured data and
// /llms.txt do not know about. The pages are .tsx and cannot be loaded here,
// so the call is read as text.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { INDEXED_PAGES } from "../lib/nav.ts"
import { cutAtWord, PAGE_META, SEARCH_LIMITS, metaKey, metaSlots, pageWords } from "../lib/page-meta.ts"
import { SITE_NAME } from "../lib/seo.ts"

const SUFFIX = ` | ${SITE_NAME}`

const pages = INDEXED_PAGES.map(({ href }) => ({ href, ...PAGE_META[href] }))

test("the map holds every indexed page and nothing else", () => {
  assert.deepEqual(Object.keys(PAGE_META).sort(), INDEXED_PAGES.map((p) => p.href).sort())
  for (const { href, title, description } of pages) {
    assert.ok(title, `${href} has no title`)
    assert.ok(description, `${href} has no description`)
  }
})

test("every indexed page takes its metadata from the map, under its own address", () => {
  for (const { href } of INDEXED_PAGES) {
    const file = new URL(`../app${href === "/" ? "" : href}/page.tsx`, import.meta.url)
    const source = readFileSync(file, "utf8")
    // through generateMetadata, with the copy, so the owner's own words win
    // (the shop adds noindex while it is an example)
    assert.match(source, /export async function generateMetadata\(/, `app${href}/page.tsx has no generateMetadata`)
    assert.match(
      source,
      new RegExp(`pageMetaFor\\("${href.replace(/[/-]/g, "\\$&")}", await getSiteData\\(\\)`),
      `app${href}/page.tsx does not take its metadata from pageMetaFor("${href}", await getSiteData())`,
    )
    assert.doesNotMatch(source, /\bpageMeta\(\{/, `app${href}/page.tsx writes its own pageMeta({ … })`)
  }
})

test("every title prints whole in a search result (60 characters with the name)", () => {
  for (const { href, title } of pages) {
    const full = href === "/" ? `${SITE_NAME} | ${title}` : `${title}${SUFFIX}`
    assert.ok(full.length <= SEARCH_LIMITS.fullTitle, `${href}: "${full}" is ${full.length} characters`)
    if (href !== "/") assert.ok(title.length <= SEARCH_LIMITS.title, `${href}: "${title}" is ${title.length} characters`)
  }
})

test("every description is 140 to 160 characters", () => {
  for (const { href, description } of pages) {
    assert.ok(
      description.length >= SEARCH_LIMITS.description.min && description.length <= SEARCH_LIMITS.description.max,
      `${href}: ${description.length} characters: "${description}"`,
    )
  }
})

test("no title or description is placeholder text, and no title repeats the site's name", () => {
  for (const { href, title, description } of pages) {
    for (const text of [title, description]) {
      assert.doesNotMatch(text, /lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|\[.*?\]/i, `${href}: "${text}"`)
    }
    assert.ok(!title.toUpperCase().includes(SITE_NAME.toUpperCase()), `${href}: "${title}" already says ${SITE_NAME}; the suffix adds it`)
  }
})

test("no two pages share a title or a description", () => {
  const titles = pages.map((p) => p.title)
  const descriptions = pages.map((p) => p.description)
  assert.equal(new Set(titles).size, titles.length)
  assert.equal(new Set(descriptions).size, descriptions.length)
})

test("the site's owner rewords a page in Notion: a published row wins, a blank one falls back", () => {
  assert.equal(metaKey("/", "title"), "meta.home.title")
  assert.equal(metaKey("/blog", "description"), "meta.blog.description")
  const copy = { "meta.home.title": "Bread, daily", "meta.team.description": "  ", "meta.team.label": "People" }
  assert.equal(pageWords("/", copy).title, "Bread, daily")
  assert.equal(pageWords("/", copy).description, PAGE_META["/"].description)
  assert.equal(pageWords("/team", copy).description, PAGE_META["/team"].description, "a blank row falls back")
  assert.equal(pageWords("/team", copy).label, "People")
  assert.deepEqual(pageWords("/features", {}), PAGE_META["/features"])
})

test("npm run copy lists every page's three rows, with the wording above", () => {
  const slots = metaSlots()
  assert.equal(Object.keys(slots).length, Object.keys(PAGE_META).length * 3)
  for (const [href, entry] of Object.entries(PAGE_META)) {
    assert.equal(slots[metaKey(href, "title")], entry.title)
    assert.equal(slots[metaKey(href, "description")], entry.description)
    assert.equal(slots[metaKey(href, "label")], entry.label)
  }
})

test("cutAtWord: whole when it fits, else at the last word that fits, its punctuation dropped, and marked as cut", () => {
  assert.equal(cutAtWord("short enough", 20), "short enough")
  assert.equal(cutAtWord("exactly twenty chars", 20), "exactly twenty chars")
  assert.equal(cutAtWord("one two three, four five six", 20), "one two three…")
  assert.ok(cutAtWord("one two three, four five six", 20).length <= 20)
  // a last space too early would lose most of it: cut mid-word instead
  assert.equal(cutAtWord("a supercalifragilisticexpialidocious word", 20), "a supercalifragilis…")
  assert.equal(cutAtWord("ends on a dash — and more words after it", 18), "ends on a dash…")
})
