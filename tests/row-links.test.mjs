// Addresses a person typed into a row, on their way to an href: a Plan's
// button, a link in a letter, a tag's page. (The Person, Review and Logo
// rows are drawn by components: tests/dom/row-links.test.tsx.)
import { test } from "node:test"
import assert from "node:assert/strict"

const { planFromEntry } = await import("../lib/plans.ts")
const { linkify } = await import("../lib/letter-body.ts")
const { tagSlug } = await import("../lib/content/select.ts")

const plan = (link) => planFromEntry({ id: "p", kind: "Plan", title: "Pro", slug: "", description: "", created: "", lastEdited: "", tags: [], featured: false, font: "default", fullWidth: false, layout: "article", link })

test("a Plan's button goes only where a link may go", () => {
  assert.deepEqual(plan("https://buy.example/pro").cta, { href: "https://buy.example/pro", label: "Pro" })
  assert.equal(plan("/contact").cta.href, "/contact")
  assert.equal(plan("mailto:sales@example.com").cta.href, "mailto:sales@example.com")
  for (const never of ["javascript:alert(document.cookie)", " JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "//elsewhere.example/x", "not an address"]) {
    assert.equal(plan(never).cta, undefined, never)
  }
  assert.equal(plan(undefined).cta, undefined)
})

test("a link in a letter ends at a quote or a bracket", () => {
  assert.equal(linkify('see "https://example.com/page"'), 'see &quot;<a href="https://example.com/page" rel="noopener noreferrer nofollow">https://example.com/page</a>&quot;')
  assert.match(linkify("<https://example.com/page>"), /href="https:\/\/example\.com\/page"/)
  assert.match(linkify("it's 'https://example.com/a'"), /href="https:\/\/example\.com\/a"/)
  // an ampersand inside an address is part of it
  assert.match(linkify("https://example.com/?a=1&b=2."), /href="https:\/\/example\.com\/\?a=1&amp;b=2"/)
})

test("a tag in another script has an address of its own", () => {
  assert.equal(tagSlug("News & Notes"), "news-and-notes")
  assert.equal(tagSlug("ニュース"), "ニュース")
  assert.notEqual(tagSlug("ニュース"), tagSlug("お知らせ"))
  assert.equal(tagSlug("!!!"), "untitled")
})
