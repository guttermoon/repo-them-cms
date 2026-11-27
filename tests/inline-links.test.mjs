// `[label](url)`, the one piece of markup in the copy (lib/inline-links.ts):
// read the same way by <T> and by the copy buttons, and never a way to put a
// script in a link.
import { test } from "node:test"
import assert from "node:assert/strict"

import { linkPieces, richTextRequest, safeHref, textRequest } from "../lib/inline-links.ts"
import { styledText as linkedText } from "../lib/inline-text.ts"
import { toText } from "../lib/copy-dump.ts"

test("a link becomes its words and its address, the text around it kept", () => {
  assert.deepEqual(linkPieces("Read [the book](https://books.example/) first."), [
    { text: "Read " },
    { text: "the book", href: "https://books.example/" },
    { text: " first." },
  ])
})

test("text with no link is one piece", () => {
  assert.deepEqual(linkPieces("Put your phone down."), [{ text: "Put your phone down." }])
  assert.deepEqual(linkPieces(""), [])
})

test("bare square brackets are blanks, not links", () => {
  const away = "Back at [start time], [time zone]."
  assert.deepEqual(linkPieces(away), [{ text: away }])
})

test("an address with a space in it is not a link", () => {
  const line = "[words](not a url)"
  assert.deepEqual(linkPieces(line), [{ text: line }])
})

test("several links in a row", () => {
  const pieces = linkPieces("[One](https://a.test/)[Two](/features) and [three](mailto:hello@example.com)")
  assert.deepEqual(
    pieces.map((p) => p.href ?? null),
    ["https://a.test/", "/features", null, "mailto:hello@example.com"],
  )
})

test("the web, mail, a phone and this site's own pages are allowed", () => {
  for (const href of [
    "https://site.example/",
    "http://example.com/path?q=1",
    "mailto:hello@example.com",
    "tel:+447700900123",
    "/setup#connect",
    "/",
    "#plan",
  ]) {
    assert.equal(safeHref(href), href, href)
  }
})

test("anything that could run or leave the site sideways is refused", () => {
  for (const href of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//evil.example/",
    "/\\evil.example/",
    "/\t/evil.example/",
    "/\n/evil.example/",
    "https://site.example/\u0000",
    "java\tscript:alert(1)",
    "https://",
    "link",
    "mailto:",
    "",
  ]) {
    assert.equal(safeHref(href), undefined, JSON.stringify(href))
  }
})

test("a refused link keeps its words and loses only the address, brackets and all", () => {
  assert.deepEqual(linkPieces("Click [here](javascript:alert(1)) now"), [{ text: "Click " }, { text: "here" }, { text: " now" }])
  assert.deepEqual(linkPieces("[The site](link)"), [{ text: "The site" }])
})

test("written to Notion, a web link is a Notion link and any other keeps its markup; read back, it is what was written", () => {
  const text = "See [the docs](https://developers.notion.com/), [the setup](/setup) or [mail](mailto:hello@example.com)."
  const runs = richTextRequest(text)
  assert.deepEqual(
    runs.map((r) => [r.text.content, r.text.link?.url ?? null]),
    [
      ["See ", null],
      ["the docs", "https://developers.notion.com/"],
      [", ", null],
      ["[the setup](/setup)", null],
      [" or ", null],
      ["[mail](mailto:hello@example.com)", null],
      [".", null],
    ],
  )
  // Notion answers with plain_text and href; the site reads that back as markup
  const answered = runs.map((r) => ({ plain_text: r.text.content, href: r.text.link?.url ?? null }))
  assert.equal(linkedText(answered), text)
  assert.ok(richTextRequest("x".repeat(4500)).every((r) => r.text.content.length <= 2000))
})

test("words as they are, written to Notion: runs of at most 2,000 characters, in order, linked only when asked", () => {
  const long = `${"a".repeat(2000)}${"b".repeat(2000)}c`
  const runs = textRequest(long)
  assert.deepEqual(runs.map((r) => r.text.content.length), [2000, 2000, 1])
  assert.equal(runs.map((r) => r.text.content).join(""), long)
  assert.deepEqual(textRequest("[not a link](/here)"), [{ type: "text", text: { content: "[not a link](/here)" } }], "markup stays as it is")
  assert.deepEqual(textRequest("docs", "https://example.com/"), [{ type: "text", text: { content: "docs", link: { url: "https://example.com/" } } }])
  assert.deepEqual(textRequest(""), [], "nothing is no runs")
})

test("the built-in wording is recorded with its links as markup, so a seeded row keeps them", () => {
  const children = ["Read the ", { type: "a", props: { href: "https://example.org/", children: "policy" } }, ".", { type: "br", props: {} }, { type: "strong", props: { children: "Bold" } }]
  assert.equal(toText(children), "Read the [policy](https://example.org/).\nBold")
})

test("an address may hold balanced brackets, as Wikipedia's do; words in brackets after a link stay words", () => {
  assert.deepEqual(linkPieces("See [Notion](https://en.wikipedia.org/wiki/Notion_(productivity_software)) for more."), [
    { text: "See " },
    { text: "Notion", href: "https://en.wikipedia.org/wiki/Notion_(productivity_software)" },
    { text: " for more." },
  ])
  assert.deepEqual(linkPieces("[Docs](https://developers.notion.com/) (the API)"), [
    { text: "Docs", href: "https://developers.notion.com/" },
    { text: " (the API)" },
  ])
  const unbalanced = "[x](https://a.example/a(b c)"
  assert.deepEqual(linkPieces(unbalanced), [{ text: unbalanced }], "half a bracket is not an address")
})
