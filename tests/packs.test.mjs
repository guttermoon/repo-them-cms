// The packs' geometry (components/illustrations/geometry.ts): words on a
// round pack curve exactly as its bands do, never the other way; every
// shadow falls in the one light and stays inside its picture; and on the
// shelf the packs are evenly spaced on a shelf as deep as they are. The
// layouts checked are the very ones the pages and the starter pictures draw.
import { test } from "node:test"
import assert from "node:assert/strict"

import { applyMatrix, bounds, canRound, cupRound, DY, outline, shadowRegion, shadows, shelfRect, wrapPoint, wrapStrips } from "../components/illustrations/geometry.ts"
import { ABOUT_PACK, ABOUT_VIEWBOX, STILL_LIFE } from "../components/illustrations/layouts.ts"
import { SHOTS, SIZE } from "../scripts/art/shots.ts"

const inside = (r, frame) => r.left >= frame.left && r.top >= frame.top && r.right <= frame.right && r.bottom <= frame.bottom
const near = (a, b, within, what) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a} is not within ${within} of ${b}`)

const ROUNDS = {
  "the shrimp tin": canRound(SHOTS.SHRIMP),
  "the drink can": canRound(SHOTS.DRINK),
  "the blog can on the shelf": canRound(STILL_LIFE.packs[1]),
  "a line of the noodle cup": cupRound(SHOTS.NOODLES, SHOTS.NOODLES.top + 250),
}

test("a wrapped label's slices land on the curve and meet edge to edge, round the whole front", () => {
  for (const [name, round] of Object.entries(ROUNDS)) {
    const strips = wrapStrips(round)
    near(strips[0].from, round.cx - (round.r * Math.PI) / 2, 1e-9, `${name} starts at its left edge`)
    near(strips[strips.length - 1].to, round.cx + (round.r * Math.PI) / 2, 1e-6, `${name} ends at its right edge`)
    strips.forEach((strip, n) => {
      for (const v of [-80, 0, 140]) {
        // both edges of a slice land on the true curve
        for (const u of [strip.from, strip.to]) {
          const [x, y] = applyMatrix(strip.matrix, [u, v])
          const [tx, ty] = wrapPoint(u, v, round)
          near(x, tx, 0.002, `${name}, slice ${n}, across`)
          near(y, ty, 0.002, `${name}, slice ${n}, up`)
        }
        // and the slice between keeps to it
        const mid = (strip.from + strip.to) / 2
        const [x, y] = applyMatrix(strip.matrix, [mid, v])
        const [tx, ty] = wrapPoint(mid, v, round)
        assert.ok(Math.hypot(x - tx, y - ty) < 0.05, `${name}, slice ${n}: the chord strays ${Math.hypot(x - tx, y - ty)} from the curve`)
      }
      // each slice is drawn a little past both its edges, so neighbours overlap
      assert.ok(strip.clip[0] < strip.from && strip.clip[1] > strip.to, `${name}, slice ${n} overlaps its neighbours`)
      if (n > 0) near(strips[n - 1].to, strip.from, 1e-9, `${name}, slices ${n - 1} and ${n} meet`)
    })
  }
})

test("words curve the way the bands do: lower in the middle, rising with the band towards the edges", () => {
  // a band's front half dips from its sides by the lid's ellipse (ringPath in packs.tsx):
  // at angle θ round the can, the band at side height h lies at h + ry·cos θ
  const can = SHOTS.SHRIMP
  const round = canRound(can)
  const side = can.top + 196
  for (let deg = -88; deg <= 88; deg += 4) {
    const theta = (deg * Math.PI) / 180
    const [x, y] = wrapPoint(round.cx + round.r * theta, side + can.ry, round)
    near(x, round.cx + round.r * Math.sin(theta), 1e-9, `at ${deg}°, across`)
    near(y, side + can.ry * Math.cos(theta), 1e-9, `at ${deg}°, a line set at the band's front stays on the band`)
  }
  // never the other way: away from the middle a line only rises
  let last = wrapPoint(round.cx, 100, round)[1]
  for (let u = round.cx + 10; u <= round.cx + (round.r * Math.PI) / 2; u += 10) {
    const [, y] = wrapPoint(u, 100, round)
    assert.ok(y < last, `a line rises towards the edge (at ${u})`)
    last = y
  }
})

test("each line round the cup wraps at its own height, on the ring through it", () => {
  const cup = SHOTS.NOODLES
  const half = (y) => (cup.wTop + (cup.wBottom - cup.wTop) * ((y - cup.top) / cup.h)) / 2
  for (const at of [cup.top + 120, cup.top + 250, cup.top + 430]) {
    const round = cupRound(cup, at)
    // the ring whose front is at `at`: its sides sit its own ellipse higher
    const sides = at - round.ry
    near(round.r, half(sides), 1e-4, `the radius at ${at}`)
    near(round.ry, cup.ry * ((half(sides) * 2) / cup.wTop), 1e-4, `the ellipse at ${at}`)
  }
  assert.ok(cupRound(cup, cup.top + 430).r < cupRound(cup, cup.top + 120).r, "lower down, the cup is narrower")
})

test("every pack's shadow falls back and to the right, in the one light from the top left", () => {
  for (const [name, pack] of Object.entries({ ...SHOTS, ...Object.fromEntries(STILL_LIFE.packs.map((p, n) => [`shelf ${n}`, p])) })) {
    const o = outline(pack)
    const [soft] = shadows(pack)
    const shape = shadowRegion({ ...soft, blur: 0 })
    assert.ok((shape.left + shape.right) / 2 > (o.left + o.right) / 2, `${name}: thrown to the right`)
    assert.ok(shape.bottom <= o.front + 4, `${name}: thrown back, not out in front of the pack`)
  }
})

test("the shelf: as deep as its packs, the packs evenly spaced, every shadow on the shelf and in the picture", () => {
  const { packs, shelf, viewBox } = STILL_LIFE
  const outlines = packs.map(outline)
  const ends = shelf.x + shelf.w
  const gaps = [outlines[0].left - shelf.x, ...outlines.slice(1).map((o, n) => o.left - outlines[n].right), ends - outlines[outlines.length - 1].right]
  for (const gap of gaps) near(gap, gaps[0], 0.5, "the same space between every pack and at both ends")
  const back = shelf.y - shelf.d * DY
  for (const [n, o] of outlines.entries()) {
    assert.ok(o.front <= shelf.y && o.front >= shelf.y - 8, `pack ${n} stands at the front of the shelf`)
    assert.ok(o.back >= back, `pack ${n}'s base is on the shelf: the shelf is as deep as it`)
  }
  for (const [n, pack] of packs.entries()) {
    for (const shadow of shadows(pack)) {
      const r = shadowRegion(shadow)
      assert.ok(r.right <= ends, `pack ${n}'s shadow fades out on the shelf, before its end`)
      assert.ok(inside(r, viewBox), `pack ${n}'s shadow is inside the picture`)
    }
  }
  assert.ok(inside(shelfRect(shelf), viewBox), "the shelf and its end are inside the picture")
})

test("the /about pack and every starter picture keep their pack and its shadow inside the picture", () => {
  assert.ok(inside(bounds(ABOUT_PACK), ABOUT_VIEWBOX), "the /about pack")
  const frame = { left: 0, top: 0, right: SIZE, bottom: SIZE }
  for (const [name, pack] of Object.entries(SHOTS)) assert.ok(inside(bounds(pack), frame), `${name} is inside its ${SIZE}×${SIZE} picture`)
})
