import { test } from "node:test"
import assert from "node:assert/strict"

import { matches, normalise, queryWords } from "../lib/search.ts"

test("words are compared without case, accents or punctuation", () => {
  assert.equal(normalise("Café-Crème!"), "cafe creme")
  assert.deepEqual(queryWords("  Corn,  FLAKES "), ["corn", "flakes"])
})

test("every word must be found, and a word may begin a longer one; no words finds everything", () => {
  assert.ok(matches("Toasted corn flakes", ["corn", "flake"]))
  assert.ok(!matches("Toasted corn flakes", ["corn", "rice"]))
  assert.ok(matches("anything", []))
})
