// Notion's formatting as the site keeps it (lib/inline-text.ts): plain words
// travel as they always have, formatted words as Notion's runs after a mark,
// and whatever needs a string reads the words alone.
import { test } from "node:test"
import assert from "node:assert/strict"

import { inlineRuns, inlineWords, isStyled, STYLED, styledText } from "../lib/inline-text.ts"

const run = (plain_text, annotations = {}, href = null) => ({ plain_text, annotations, href })

test("words with no formatting stay plain words, a link as [label](url)", () => {
  assert.equal(styledText([run("Read "), run("the docs", {}, "https://docs.example/"), run(".")]), "Read [the docs](https://docs.example/).")
  assert.equal(styledText([run("x", { color: "default" })]), "x", "the default colour is no formatting")
  // a link the markup could not be read back from travels as runs, its address kept apart
  for (const [label, href] of [["the [beta] docs", "https://docs.example/"], ["docs", "https://example.com/a_(b"], ["docs", "https://example.com/a b"]]) {
    const kept = styledText([run("read "), run(label, {}, href)])
    assert.ok(isStyled(kept), `${label} ${href}`)
    assert.equal(inlineWords(kept), `read ${label}`)
    assert.deepEqual(inlineRuns(kept).filter((r) => r.href).map((r) => [r.t, r.href]), [[label, href]])
  }
  assert.equal(styledText([run("see "), run("Notion (app)", {}, "https://en.wikipedia.org/wiki/Notion_(app)")]), "see [Notion (app)](https://en.wikipedia.org/wiki/Notion_(app))", "balanced brackets still read back")
  assert.equal(styledText([]), "")
  assert.equal(styledText(undefined), "")
})

test("formatted words keep every run and what Notion did to it", () => {
  const text = styledText([run("Bold", { bold: true }), run(" "), run("red", { color: "red" }), run(" link", { italic: true }, "https://x.example/")])
  assert.ok(isStyled(text))
  assert.deepEqual(inlineRuns(text), [{ t: "Bold", b: 1 }, { t: " " }, { t: "red", col: "red" }, { t: " link", i: 1, href: "https://x.example/" }])
  assert.equal(inlineWords(text), "Bold red link")
})

test("every annotation is kept: bold, italic, underline, strikethrough, code, a background colour", () => {
  const text = styledText([run("all", { bold: true, italic: true, underline: true, strikethrough: true, code: true, color: "yellow_background" })])
  assert.deepEqual(inlineRuns(text), [{ t: "all", b: 1, i: 1, u: 1, s: 1, c: 1, col: "yellow_background" }])
})

test("formatted words that are only spaces are a blank row, which hides its slot", () => {
  assert.equal(styledText([run("  ", { bold: true })]), "")
})

test("a link typed as [label](url) inside a formatted run becomes a run of its own, formatting kept round it", () => {
  const text = STYLED + JSON.stringify([{ t: "See [the plans](/pricing) now", b: 1 }])
  assert.deepEqual(inlineRuns(text), [
    { t: "See ", b: 1 },
    { t: "the plans", b: 1, href: "/pricing" },
    { t: " now", b: 1 },
  ])
})

test("plain words read as runs too, an unsafe link as its words", () => {
  assert.deepEqual(inlineRuns("Go [home](/) or [away](javascript:alert(1))"), [{ t: "Go " }, { t: "home", href: "/" }, { t: " or " }, { t: "away" }])
})

test("a damaged value prints nothing rather than its insides, and a bad colour is dropped", () => {
  assert.deepEqual(inlineRuns(`${STYLED}[{oops`), [])
  assert.deepEqual(inlineRuns(`${STYLED}{"t":"not a list"}`), [])
  assert.deepEqual(inlineRuns(`${STYLED}[{"t":"x","col":"red; background:url(x)"},{"nope":1}]`), [{ t: "x" }])
})

test("a line break is kept in the words", () => {
  assert.equal(inlineWords(styledText([run("One\nTwo", { bold: true })])), "One\nTwo")
})
