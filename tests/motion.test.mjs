// Motion (docs/design.md): what moves on its own is in app/globals.css, and
// is held here to the rules a reader, a printer and an agent depend on.
// Nothing moves for a reader who asked for less, the one loop can be stopped, and what
// follows the scroll never hides a thing that has not been reached.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { sources } from "./support/sources.mjs"

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

/** The body of the first block that opens with `head`, braces matched. */
function block(source, head) {
  const start = source.indexOf(head)
  assert.notEqual(start, -1, `no block ${head}`)
  const open = source.indexOf("{", start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++
    if (source[i] === "}" && --depth === 0) return { body: source.slice(open + 1, i), rest: source.slice(0, start) + source.slice(i + 1) }
  }
  assert.fail(`unclosed block ${head}`)
}

/** Every rule in a piece of CSS, as [selector, declarations]. */
const rules = (source) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])

const willing = block(css, "@media (prefers-reduced-motion: no-preference)")

test("nothing animates outside the block for readers who have not asked for less motion", () => {
  const outside = rules(willing.rest.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""))
    .filter(([, body]) => /(^|[\s;])animation(-name)?\s*:\s*(?!none)/.test(body))
    .map(([selector]) => selector)
  assert.deepEqual(outside, [])
  assert.match(willing.body, /\.settle > \*/)
})

test("for a reader who asked for less motion, a transition takes no time at all, so a size set is a size read", () => {
  const reduced = block(css, "@media (prefers-reduced-motion: reduce)")
  // a hundredth of a millisecond is still a transition: code that sets a
  // size and measures it reads the old one, and the cookie bag's word swung
  // between two sizes twenty times a second
  assert.match(reduced.body, /transition-duration:\s*0s\s*!important/)
  assert.match(reduced.body, /transition-delay:\s*0s\s*!important/)
  assert.doesNotMatch(reduced.body, /transition-duration:\s*0\.0\d*m?s/)
  // and the word that is fitted is measured with no transition of its own
  assert.match(css, /\.fit-word \{\s*transition: none !important;\s*\}/)
  assert.match(readFileSync(new URL("../components/layout/cookie-notice.tsx", import.meta.url), "utf8"), /<span ref=\{word\} className="fit-word /)
})

test("one thing loops, the row that passes by, and a reader can stop it three ways", () => {
  const looping = rules(css.replace(/@media[^{]+\{/g, "").replace(/@supports[^{]+\{/g, "")).filter(([, body]) => /\binfinite\b/.test(body)).map(([selector]) => selector)
  assert.deepEqual(looping, [".marquee[data-loop] > .marquee-track"], "a second loop needs its own way to be stopped (WCAG 2.2.2)")
  // under the pointer, with its Pause box, and by putting the keyboard in it
  assert.match(willing.body, /\.marquee\[data-loop\]:hover > \.marquee-track,[^{]*\.marquee-pause:checked[^{]*\{\s*animation-play-state:\s*paused/)
  assert.match(willing.body, /\.marquee\[data-loop\]:focus-within > \.marquee-track \{[^}]*animation:\s*none/)
  // it has no fade at its ends: nothing masks it
  assert.doesNotMatch(css, /\.marquee[^{]*\{[^}]*mask/)
  // and at rest (no motion asked for) its second run of cards is not drawn
  assert.match(willing.rest, /\.marquee-clone,\s*\.marquee-toggle \{\s*display:\s*none/)
})

test("the site moves at one pace: the hand's movements share their timings", () => {
  for (const token of ["--ease", "--spring", "--t-in", "--t-out"]) assert.match(css, new RegExp(`${token}:\\s*[^;]+;`), token)
  const rule = (selector) => (rules(willing.rest).find(([s]) => s === selector) ?? [])[1] ?? ""
  for (const selector of [".press", ".lit"]) {
    // calm to let go, eager to answer
    assert.match(rule(selector), /var\(--t-out\)/, `${selector} lets go at the shared time`)
    assert.match(css, new RegExp(`\\${selector}:hover[^{]*\\{[^}]*transition-duration:\\s*var\\(--t-in\\)`), `${selector} answers at the shared time`)
  }
})

test("a component names a movement, it does not write one: no transition, duration or easing class in markup", async () => {
  // the one exception: a sheet slides in and out by its library's own states, at their own lengths
  const typed = sources(["app", "components"], /\.tsx$/)
    .filter(({ path }) => path !== "components/system/sheet.tsx")
    .flatMap(({ path: file, text }) => [...text.matchAll(/(?<![\w-])(transition(?:-[a-z]+|-\[[^\]]+\])?|duration-\d+|ease-(?:in|out|in-out|linear|\[[^\]]+\]))(?=[ "`'])/g)].filter((m) => !/^\s*(\/\/|\*)/.test(m.input.slice(m.input.lastIndexOf("\n", m.index) + 1, m.index))).map((m) => `${file}: ${m[0]}`))
  assert.deepEqual(typed, [])
  for (const name of [".tone", ".turn"]) assert.match(css, new RegExp(`\\${name} \\{[^}]*var\\(--t-out\\)`), `${name} keeps the shared time`)
})

test("a card is lit, not lifted: no shadow under it, and it does not jump", () => {
  const hover = (rules(willing.rest).find(([s]) => s.replace(/\s+/g, " ") === ".lit:hover, .lit:focus-within") ?? [])[1] ?? ""
  assert.match(hover, /--glow:\s*1/)
  assert.match(hover, /border-color/)
  assert.doesNotMatch(hover, /translate|drop-shadow|shadow-pop/)
  // the only shadow is a 1px ring: no offset, no blur
  assert.match(hover, /box-shadow:\s*0 0 0 1px /)
  // and no card anywhere rests on a blurred shadow, in the looks that are not rainbow's hard offset
  const cards = [...css.matchAll(/--shadow-card:\s*([^;]+);/g)].map((m) => m[1])
  assert.equal(cards.length, 4)
  assert.equal(cards.filter((value) => /^rgba?\([^)]*\) 0 0 0 1px$/.test(value.trim())).length, 3, "light, dark and mono are a hairline alone")
})

test("what follows the scroll needs a browser that can, and hides nothing it has not reached", () => {
  const scrolling = block(willing.body, "@supports (animation-timeline: view())")
  assert.doesNotMatch(scrolling.rest, /animation-timeline/, "a scroll-driven animation outside @supports")
  // a rule that animates is tied to the scroll: the window's own timeline, or
  // a named one (the belt's); one that does not only sets the scene
  const driven = rules(scrolling.body).filter(([, body]) => /(^|[\s;])animation\s*:(?!\s*none)/.test(body))
  assert.ok(driven.length >= 5)
  for (const [selector, body] of driven) {
    assert.match(body, /animation-timeline:\s*(view\(\)|--[\w-]+)/, selector)
    // a backwards fill would hold the first frame (invisible) until the
    // reader scrolls there: blank to a printer, a capture or an agent
    assert.doesNotMatch(body, /\b(both|backwards)\b/, `${selector} fills backwards`)
  }
})

test("nothing jumps as it begins: a scroll-driven movement starts out of sight, or from how the thing already stands", () => {
  // with no backwards fill a thing is drawn as it stands until its range
  // begins, then takes its first keyframe at once. So a movement with a
  // first keyframe must begin where nobody is looking: as its subject meets
  // the window's foot. One with no first keyframe
  // begins as the thing stands, and may begin anywhere.
  const frames = Object.fromEntries([...css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map((m) => [m[1], m[2]]))
  const scrolling = block(willing.body, "@supports (animation-timeline: view())")
  const parts = (body, property) => (body.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1] ?? "").split(",").map((part) => part.trim())
  let checked = 0
  for (const [selector, body] of rules(scrolling.body).filter(([, body]) => /(^|[\s;])animation\s*:(?!\s*none)/.test(body))) {
    const names = parts(body, "animation").map((part) => part.split(/\s+/)[0])
    const ranges = parts(body, "animation-range")
    names.forEach((name, i) => {
      assert.ok(frames[name], `${selector}: no @keyframes ${name}`)
      if (!/(^|[\s}])(from|0%)[\s,{]/.test(frames[name])) return
      checked++
      assert.match(ranges[i] ?? ranges[0], /^(entry 0%|cover 0%) /, `${selector}: ${name} has a first keyframe and begins in sight`)
    })
  }
  assert.ok(checked >= 6)
})

test("what follows the scroll only moves, grows, turns and clears: nothing the browser must draw again each frame", () => {
  const frames = Object.fromEntries([...css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map((m) => [m[1], m[2]]))
  const scrolling = block(willing.body, "@supports (animation-timeline: view())")
  const names = new Set(rules(scrolling.body).flatMap(([, body]) => (body.match(/(?:^|[\s;])animation:\s*([^;]+);/)?.[1] ?? "").split(",").map((part) => part.trim().split(/\s+/)[0])).filter((name) => name && name !== "none"))
  assert.ok(names.size >= 8)
  // a panel's ground is a flat colour, cheap to draw: its corners may square up;
  // and things turn in depth to face the reader, which is a transform
  const extra = { open: "|border-radius", face: "|transform", spread: "|transform" }
  const allowed = (name) => new RegExp(`^(opacity|translate|scale|rotate${extra[name] ?? ""})$`)
  for (const name of names) {
    const properties = [...frames[name].matchAll(/([\w-]+)\s*:/g)].map((m) => m[1])
    assert.deepEqual(properties.filter((property) => !allowed(name).test(property)), [], `${name} animates something that is drawn again every frame`)
  }
  // and each reveal takes a set length of scroll, not a share of its own height
  for (const [selector, body] of rules(scrolling.body).filter(([, body]) => /animation:\s*(slide|spread|clear|open) /.test(body))) assert.match(body, /animation-range:\s*entry 0% cover \d+px/, selector)
})

test("a row of cards spreads from its middle: every grid that arrives says how many columns it has, and each is dealt from the middle", async () => {
  const scrolling = block(willing.body, "@supports (animation-timeline: view())").body
  // the columns on either side of the middle start the same distance from it, on opposite sides
  for (const n of [2, 3, 4]) {
    const starts = Array.from({ length: n }, (_, k) => Number(scrolling.match(new RegExp(`\\.arrive-each\\.grid-cols-${n} > :nth-child\\(${n}n \\+ ${k + 1}\\) \\{\\s*--from:\\s*(-?\\d+)% 0`))?.[1]))
    assert.ok(starts.every(Number.isFinite), `no start for a grid of ${n}`)
    assert.deepEqual(starts.map((x, k) => x + starts[n - 1 - k]), Array(n).fill(0), `a grid of ${n} is not dealt evenly`)
    assert.ok(starts[0] > 0, "the first column starts to its right, toward the middle")
    // and a card never crosses its neighbour: it moves a fraction of its own width
    assert.ok(Math.max(...starts) <= 30, `a card in a grid of ${n} moves too far`)
  }
  // no card comes up from under the page
  assert.doesNotMatch(css.match(/@keyframes spread \{[\s\S]*?\n\}/)[0], /translate:\s*0 /)
  // and every column class a grid in the markup uses has its rule
  const used = new Set(sources(["app", "components"], /\.tsx$/).flatMap(({ text }) => text.split("\n").filter((line) => line.includes("arrive-each")).flatMap((line) => line.match(/(?:\w+:)?grid-cols-\d/g) ?? [])))
  assert.ok(used.size >= 5)
  for (const name of used) assert.ok(scrolling.includes(`.arrive-each.${name.replace(":", "\\:")} >`), `no spread for ${name}`)
})

test("the site moves side to side, as the belt does: nothing follows the scroll up, down or on a diagonal", () => {
  const moving = css.slice(css.indexOf("@keyframes settle"))
  const scrolling = block(willing.body, "@supports (animation-timeline: view())").body
  const names = new Set(rules(scrolling).flatMap(([, body]) => (body.match(/(?:^|[\s;])animation:\s*([^;]+);/)?.[1] ?? "").split(",").map((part) => part.trim().split(/\s+/)[0])).filter((name) => name && name !== "none"))
  // where a thing starts from is across, never up or down
  const starts = [...moving.matchAll(/--from:\s*([^;]+);/g), ...moving.matchAll(/var\(--from, ([^)]+)\)/g)].map((m) => m[1].trim())
  assert.ok(starts.length > 20)
  // (the belt's own start is a number its ride is worked out from, not a place)
  assert.deepEqual(starts.filter((start) => !start.startsWith("calc(") && !/^-?[\d.]+(px|%)? 0$/.test(start)), [])
  // and no movement that follows the scroll shifts a thing up or down
  for (const name of names) {
    const frames = moving.match(new RegExp(`@keyframes ${name} \\{[\\s\\S]*?\\n\\}`))[0]
    for (const [, value] of frames.matchAll(/translate:\s*([^;]+);/g)) assert.match(value.trim(), /^var\(--from, [^)]+\)$| 0$/, `${name} moves a thing up or down: ${value}`)
    assert.doesNotMatch(frames, /translateY/, `${name} moves a thing up or down`)
  }
})

test("every movement has a name of its own: a second @keyframes of a name replaces the first without a word", () => {
  const names = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1])
  assert.deepEqual(names.filter((name, i) => names.indexOf(name) !== i), [])
})

test("the scanner's light is a token in every look, and has no hue in mono", () => {
  const lights = [...css.matchAll(/--c-scan:\s*(\d+) (\d+) (\d+);/g)].map((m) => m.slice(1, 4).map(Number))
  assert.equal(lights.length, 4, "one for light, dark, mono and rainbow")
  assert.ok(lights.some(([r, g, b]) => r === g && g === b), "mono's is a grey")
  assert.doesNotMatch(css.replace(/--c-scan:[^;]+;/g, ""), /#(ff0000|f00|e11|d62828)\b/i, "a red typed where the token belongs")
})

test("rainbow's title arrives whole: a word moving alone would fall out of its gradient", () => {
  const [, body] = rules(willing.body).find(([selector]) => selector === ':root[data-theme="rainbow"] .kinetic-word') ?? []
  assert.match(body ?? "", /animation:\s*none/)
})
