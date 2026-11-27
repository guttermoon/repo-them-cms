// The share card (lib/og-card.tsx): the box it draws is this site's own
// file, measured as the card says it is, with no ground of its own; the home
// page's card is the name, the descriptor and the box and no other words;
// and a name is set as large as its room allows without leaving it.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

const sharp = createRequire(import.meta.url)("sharp")
const source = await readFile("lib/og-card.tsx", "utf8")

/** The card's own numbers and its sizing rule, read from its source (the
 *  file imports next/og, which only Next can load). */
const literal = (name) => new Function(`return (${new RegExp(`export const ${name} = (\\{[^\\n]*\\})`).exec(source)[1]})`)()
const BOX = literal("BOX")
const POSTER = literal("POSTER")
const CAP = Number(/const CAP = ([\d.]+)/.exec(source)[1])
const LEADING = Number(/const LEADING = ([\d.]+)/.exec(source)[1])
const posterName = new Function("POSTER", "CAP", "LEADING", `${/export (function posterName[\s\S]*?\n})/.exec(source)[1].replace(/: \{ lines: string\[\]; size: number \}|: string/g, "")}; return posterName`)(POSTER, CAP, LEADING)

test("the box is the site's own picture, measured as the card says, with nothing behind it", async () => {
  const image = sharp("assets/og/box.png")
  const { width, height, hasAlpha, format } = await image.metadata()
  assert.equal(format, "png", "Satori draws PNG, not WebP")
  assert.deepEqual([width, height], [BOX.width, BOX.height])
  assert.ok(hasAlpha, "it stands on the card's own ground")
  assert.ok(width >= POSTER.boxWidth, "never drawn larger than its pixels")
  assert.ok(POSTER.boxLeft + POSTER.boxWidth <= 1200 && POSTER.boxTop + (POSTER.boxWidth * BOX.height) / BOX.width <= 630, "and inside the card")
  // the card's band meets the box's own: at those rows the front's left edge is the band's blue, and tint between
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const at = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)]
  const blue = ([r, g, b]) => b > 140 && r < 80 && g < 100
  const x = BOX.left + 40
  assert.ok(blue(at(x, BOX.band.top + 6)), "the band's top edge")
  assert.ok(blue(at(x, BOX.band.bottom - 6)), "its bottom edge")
  assert.ok(!blue(at(x, Math.round((BOX.band.top + BOX.band.bottom) / 2))), "tint between")
  assert.ok(!blue(at(x, BOX.band.top - 12)) && !blue(at(x, BOX.band.bottom + 12)), "and the band nowhere else")
  assert.equal(data[(BOX.foot + 30) * info.width * info.channels + (BOX.left + 300) * info.channels + 3] < 255, true, "below the foot is shadow or nothing")
  assert.match(source, /path\.join\(process\.cwd\(\), "assets", "og", "box\.png"\)/)
  assert.doesNotMatch(source, /https?:\/\//, "the card fetches nothing")
})

test("the home page's card is the name, the descriptor and the box: no title, no label, no address", () => {
  const poster = /function Poster\([\s\S]*?\n}\n/.exec(source)[0]
  assert.match(poster, /\{lines\.map/)
  assert.match(poster, /textTransform: "lowercase"/, "the name is lettered as the label letters everything")
  assert.match(poster, /\{descriptor\}/)
  assert.doesNotMatch(poster, /SITE_HOST|\{label\}|\{title\}|\{words\}|<Head/)
  assert.match(source, /front \? \(\s*<Poster name=\{name\} descriptor=\{descriptor\} src=\{src\} \/>/)
})

test("a name is set as large as its room allows, and never past it", () => {
  assert.deepEqual(posterName("REPO THEM").lines, ["REPO", "THEM"])
  assert.deepEqual(posterName("Acme").lines, ["Acme"])
  assert.deepEqual(posterName("The Plain Goods Company").lines, ["The Plain", "Goods Company"], "two lines as near equal as the words go")
  for (const name of ["REPO THEM", "Acme", "Io", "The Plain Goods Company", "Supercalifragilistic", "A B"]) {
    const { lines, size } = posterName(name)
    const longest = Math.max(...lines.map((l) => l.length))
    assert.ok(longest * CAP * size <= POSTER.nameWidth, `${name} fits across`)
    assert.ok(lines.length * LEADING * size <= POSTER.nameHeight, `${name} fits above the band`)
    assert.ok((longest * CAP * (size + 1) > POSTER.nameWidth) || (lines.length * LEADING * (size + 1) > POSTER.nameHeight), `${name} could not be a pixel larger`)
  }
  assert.ok(posterName("REPO THEM").size >= 170, "the template's own name is a poster's size")
  assert.ok(64 + POSTER.nameWidth <= POSTER.boxLeft + (BOX.left * POSTER.boxWidth) / BOX.width, "the name's room stops at the box")
})

test("the box's picture names no site: the card sets the name beside it", async () => {
  const art = await readFile("scripts/art/demo-pictures.tsx", "utf8")
  assert.match(art, /file: "box\.png", out: "assets\/og", clear: true/)
  const drawn = /function CardBox\(\)[\s\S]*?\n}\n/.exec(art)[0]
  assert.doesNotMatch(drawn, /brand|TEMPLATE_NAME|SITE_NAME/)
})
