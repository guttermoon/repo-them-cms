// The words of a category's, a tag's and a collection's page in a search
// result (lib/filter-words.ts): each says what it holds by the titles of its
// newest, as many as a result prints whole, so no two archives share one
// sentence with a name swapped in.
import { test } from "node:test"
import assert from "node:assert/strict"

import { fillTitles, filterWords } from "../lib/filter-words.ts"
import { SEARCH_LIMITS } from "../lib/page-meta.ts"

const MAX = SEARCH_LIMITS.description.max

test("a category's description names its newest posts, in quotation marks, newest first", () => {
  const words = filterWords({}, "Category", "News", 2, ["Version 1.0: generic, finally", "Introducing generic"])
  assert.equal(words.meta, "Posts filed under News, 2 so far, newest first: “Version 1.0: generic, finally”, “Introducing generic”.")
  const tag = filterWords({}, "Tag", "Tutorial", 1, ["Five questions to ask before you buy anything"])
  assert.equal(tag.meta, "Posts tagged Tutorial, 1 so far, newest first: “Five questions to ask before you buy anything”.")
})

test("two archives never share a description", () => {
  const a = filterWords({}, "Category", "News", 1, ["Hello"]).meta
  const b = filterWords({}, "Category", "Guides", 1, ["How to"]).meta
  assert.notEqual(a.replace("News", "Guides"), b, "more than the name differs")
})

test("as many titles as a search result prints whole, and never fewer than one", () => {
  const titles = Array.from({ length: 30 }, (_, i) => `A post with a fairly ordinary title, number ${i + 1}`)
  const meta = filterWords({}, "Category", "News", titles.length, titles).meta
  assert.ok(meta.length <= MAX, `${meta.length} characters`)
  assert.match(meta, /“A post with a fairly ordinary title, number 1”/, "the newest first")
  assert.doesNotMatch(meta, /number 30/)
  // one more title would not have fitted
  const shown = (meta.match(/“/g) ?? []).length
  assert.ok(shown >= 1)
  const more = `Posts filed under News, 30 so far, newest first: ${titles.slice(0, shown + 1).map((t) => `“${t}”`).join(", ")}.`
  assert.ok(more.length > MAX, "it stopped at the last title that fitted")

  const long = fillTitles("Posts under {name}: {titles}.", { name: "News" }, ["word ".repeat(60).trim()])
  assert.ok(long.length <= MAX, `${long.length} characters`)
  assert.match(long, /^Posts under News: “word word/)
  assert.match(long, /…$/, "a title too long on its own is cut at a word")
})

test("an owner's wording without {titles} is theirs, whatever its length", () => {
  const own = "Everything we have written about news, filed in one place for anyone who wants it, which turns out to be a surprising number of people, many of whom read every word."
  assert.ok(own.length > MAX)
  assert.equal(filterWords({ "blog.category.meta": own }, "Category", "News", 3, ["A", "B", "C"]).meta, own)
  assert.equal(filterWords({ "blog.tag.meta": "All about {name}." }, "Tag", "Design", 3, ["A"]).meta, "All about Design.")
})

test("with no titles to give, the rest of the sentence still reads", () => {
  assert.equal(fillTitles("{name}: {count} products in the shop: {titles}.", { name: "Drinks", count: 0 }, []), "Drinks: 0 products in the shop.")
  assert.equal(fillTitles("Posts under {name}, newest first, {titles}", { name: "News" }, []), "Posts under News, newest first")
})
