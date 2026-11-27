// Alt text, which Notion's API does not give (lib/notion/alt-text.ts): a
// picture's caption line starting "Alt:", and a product picture's name.
import { test } from "node:test"
import assert from "node:assert/strict"

import { isFileName, nameAlt, splitCaption } from "../lib/notion/alt-text.ts"

const run = (text, extra = {}) => ({ type: "text", plain_text: text, href: null, text: { content: text, link: null }, annotations: {}, ...extra })
const words = (runs) => runs.map((r) => r.plain_text).join("")

test("a caption with no Alt: line is left as it is", () => {
  const caption = [run("Three bakers and one oven")]
  assert.deepEqual(splitCaption(caption), { caption, alt: null })
  assert.deepEqual(splitCaption(undefined), { caption: [], alt: null })
  assert.deepEqual(splitCaption([]), { caption: [], alt: null })
})

test("the Alt: line becomes the alt text and leaves the caption, before or after the rest", () => {
  const after = splitCaption([run("Opening day\nAlt: A green shopfront")])
  assert.equal(after.alt, "A green shopfront")
  assert.equal(words(after.caption), "Opening day")
  const before = splitCaption([run("Alt:  A green shopfront  \nOpening day")])
  assert.equal(before.alt, "A green shopfront")
  assert.equal(words(before.caption), "Opening day")
  const middle = splitCaption([run("Opening day\nalt text: A green shopfront\nPhoto: the owner")])
  assert.equal(middle.alt, "A green shopfront")
  assert.equal(words(middle.caption), "Opening day\nPhoto: the owner")
})

test("a bare Alt: is decoration; a word that only ends in alt is not the marker", () => {
  assert.deepEqual(splitCaption([run("Alt:")]), { caption: [], alt: "" })
  assert.equal(splitCaption([run("Salt: the only seasoning")]).alt, null)
  assert.equal(splitCaption([run("Altitude: 300 m")]).alt, null)
  assert.equal(splitCaption([run("A note. Alt: not at the start of a line")]).alt, null)
})

test("runs are cut where the line falls, keeping their formatting and both text fields", () => {
  const { caption, alt } = splitCaption([run("Fresh", { annotations: { bold: true } }), run(" every morning\nAlt: Rolls"), run(" on a tray", { annotations: { italic: true } })])
  assert.equal(alt, "Rolls on a tray")
  assert.equal(words(caption), "Fresh every morning")
  assert.deepEqual(caption.map((r) => [r.plain_text, r.text.content, r.annotations]), [
    ["Fresh", "Fresh", { bold: true }],
    [" every morning", " every morning", {}],
  ])
})

test("a mention is never split: kept whole unless all of it is inside the Alt: line", () => {
  const mention = { type: "mention", plain_text: "Ana", href: null, mention: { type: "user" }, annotations: {} }
  const kept = splitCaption([run("By "), mention, run("\nAlt: A loaf")])
  assert.equal(words(kept.caption), "By Ana")
  assert.ok(kept.caption.includes(mention))
  // an equation whose text runs into the Alt: line is kept whole, not cut to a stray part of itself
  const equation = { type: "equation", plain_text: "x^2\n", equation: { expression: "x^2" }, annotations: {} }
  const across = splitCaption([run("A curve, "), equation, run("Alt: A parabola")])
  assert.equal(across.alt, "A parabola")
  assert.ok(across.caption.includes(equation), "the equation is the same run, untouched")
  const inside = splitCaption([run("Alt: A portrait of "), mention])
  assert.equal(inside.alt, "A portrait of Ana")
  assert.deepEqual(inside.caption, [])
})

test("a picture's name describes it unless it is only a file name", () => {
  for (const name of ["IMG_1234.jpg", "corn-flakes.webp", "corn-flakes-back", "picture-3", "Screenshot_2026.PNG", "f0.png"]) assert.ok(isFileName(name), name)
  for (const name of ["The box", "Logo", "A white mug, handle to the right"]) assert.ok(!isFileName(name), name)
  assert.equal(nameAlt({ name: "  The back of the box " }), "The back of the box")
  assert.equal(nameAlt({ name: "IMG_1234.jpg" }), "")
  assert.equal(nameAlt({}), "")
  // a picture uploaded already named with what it shows: Notion keeps its ending
  assert.equal(nameAlt({ name: "The front of the box.webp" }), "The front of the box")
  assert.equal(nameAlt({ name: "A mug, handle to the right.JPEG" }), "A mug, handle to the right")
  // only a picture's ending goes, and only at the end
  assert.equal(nameAlt({ name: "Version 1.0 on the shelf" }), "Version 1.0 on the shelf")
  assert.equal(nameAlt({ name: "A box of St. Ives tea" }), "A box of St. Ives tea")
  assert.equal(nameAlt(undefined), "")
})
