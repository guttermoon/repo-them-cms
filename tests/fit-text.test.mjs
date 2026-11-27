// The cookie bag's word, as large as its line allows (lib/fit-text.ts).
import { test } from "node:test"
import assert from "node:assert/strict"

import { fitSize, TITLE_FIT } from "../lib/fit-text.ts"

test("words fill their line: the size scales with the room, rounded down so they never spill", () => {
  // "cookies" in the slab face is 548px wide at 160px
  assert.equal(fitSize(548, 160, 340), 99, "the box's front on a desktop")
  assert.equal(fitSize(548, 160, 249), 72, "on a phone")
  assert.ok((548 * fitSize(548, 160, 340)) / 160 <= 340, "never wider than the line")
})

test("never larger than the size they were measured at, never smaller than the floor", () => {
  assert.equal(fitSize(100, 160, 2000), TITLE_FIT.max, "a short word on a wide line stops at the ceiling")
  assert.equal(fitSize(4000, 160, 340), TITLE_FIT.min, "a long phrase stops at the floor (and wraps there)")
  assert.equal(fitSize(548, 160, 340, { min: 10, max: 50 }), 50)
})

test("nothing to measure is no size at all: the words keep the size the page gave them", () => {
  assert.equal(fitSize(0, 160, 340), null, "no words (the slot published blank)")
  assert.equal(fitSize(548, 160, 0), null, "no layout, as in a test's document")
  assert.equal(fitSize(Number.NaN, 160, 340), null)
})
