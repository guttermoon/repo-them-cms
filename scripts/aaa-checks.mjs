// The WCAG 2.2 AAA criteria a rendered page is held to that axe does not
// measure, each a function run inside the page (Playwright's
// page.evaluate), so each carries everything it needs. scripts/a11y-audit.mjs
// runs them on every page, in every look and at every width.
//
// axe's own AAA contrast rule (color-contrast-enhanced) runs too, but it
// passes text it cannot place on a ground; this measures every element with
// words of its own against the colour actually behind it. Words on a
// drawing (the cookie bag, a picture under its veil, a gradient) have no one
// colour behind them in the stylesheet: those are judged from the pixels,
// with the words hidden (drawnGround, below).
import { inflateSync } from "node:zlib"

import { luminance, ratio } from "../lib/contrast.ts"

/**
 * 1.4.6 (7:1, or 4.5:1 for large text), 2.5.5 (44 by 44, a link inside a
 * sentence excepted) and 1.4.8 (running text at 1.5 line height, not
 * justified, at most 80 characters a line). Returns what fails.
 */
export function measure() {
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    // what a closed <details> holds, past its summary, is not drawn
    const folded = el.closest("details:not([open])")
    if (folded && !el.closest("summary")?.parentElement?.isSameNode(folded)) return false
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0 && !el.closest("[inert], [aria-hidden=true]")
  }
  const name = (el) => {
    const tag = el.tagName.toLowerCase()
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""
    const text = (el.getAttribute("aria-label") || el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 36)
    return `${tag}${el.id ? "#" + el.id : ""}${cls}${text ? ` "${text}"` : ""}`
  }
  const parse = (c) => (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number)
  const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  /** a drawing laid under the words in their own container: a child of `n`
   *  placed absolutely (the cookie bag, a hero's picture) that is or holds a
   *  picture, an illustration or a video, and covers part of the words */
  const DRAWING = "svg, img, canvas, video"
  const underlay = (n, el, box) =>
    [...n.children].some((c) => !c.contains(el) && getComputedStyle(c).position === "absolute" && (c.matches(DRAWING) || c.querySelector(DRAWING)) && overlaps(c.getBoundingClientRect(), box))
  /** the opaque colour behind an element, its translucent layers laid over
   *  it; null when a drawing or a gradient lies under its words, which only
   *  the pixels can judge */
  const behind = (el) => {
    const layers = []
    const box = el.getBoundingClientRect()
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage !== "none" && !/^linear-gradient\(rgba?\(0, 0, 0, 0\)/.test(s.backgroundImage)) return null
      if (n !== el && underlay(n, el, box)) return null
      const c = parse(s.backgroundColor)
      if (c.length < 4 || c[3] >= 1) return layers.reduceRight((ground, [r, g, b, a]) => [r * a + ground[0] * (1 - a), g * a + ground[1] * (1 - a), b * a + ground[2] * (1 - a)], c.slice(0, 3))
      if (c[3] > 0) layers.push(c)
    }
    return [255, 255, 255]
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  // 1.4.6: every element with words of its own; while a modal dialog is
  // open (the cookie bag), only its own, the page behind it being dimmed
  // and out of reach
  const modal = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].find(shown)
  const contrast = []
  // words on a drawing, marked for drawnGround to judge from the pixels
  const drawn = []
  for (const el of document.body.querySelectorAll("*")) {
    if (!shown(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    if (modal && !modal.contains(el)) continue
    // words a screen reader alone reads (sr-only, a 1px box) are not seen
    const seen = el.getBoundingClientRect()
    if (seen.width <= 1 || seen.height <= 1) continue
    // a logo's words, and words cut from a picture, are exempt (1.4.6)
    if (el.closest("[data-badge], svg, [data-logo]")) continue
    const s = getComputedStyle(el)
    // words drawn with a transparent fill are a gradient's (rainbow's titles): tested from the tokens
    if (parse(s.color)[3] === 0 || s.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue
    const size = parseFloat(s.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
    const needs = large ? 4.5 : 7
    const ground = behind(el)
    if (!ground) {
      el.dataset.aaaDrawn = String(drawn.length)
      drawn.push({ el: name(el), color: s.color, needs })
      continue
    }
    const [r, g, b, a = 1] = parse(s.color)
    const ink = [r * a + ground[0] * (1 - a), g * a + ground[1] * (1 - a), b * a + ground[2] * (1 - a)]
    const got = ratio(ink, ground)
    if (got < needs) contrast.push(`${name(el)}: ${got.toFixed(2)}:1, needs ${needs}:1`)
  }

  // 2.5.5: every target, a link in a sentence and a screen reader's own excepted
  // the block of text an inline link sits in: its nearest ancestor that is not inline
  const inSentence = (el) => {
    if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false
    let block = el.parentElement
    while (block && getComputedStyle(block).display === "inline") block = block.parentElement
    const words = (n) => n.textContent.trim().replace(/\s+/g, " ")
    return !!block && words(block) !== words(el)
  }
  const box = (el) => {
    // a radio or a checkbox is pressed through its label: the label is the target
    if (el.matches("input[type=radio], input[type=checkbox]")) {
      const label = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
      if (label) return label.getBoundingClientRect()
    }
    // a card's link whose ::after covers the card is pressed anywhere on it
    const after = getComputedStyle(el, "::after")
    if (after.content !== "none" && after.position === "absolute" && el.offsetParent) return el.offsetParent.getBoundingClientRect()
    return el.getBoundingClientRect()
  }
  const targets = []
  const seen = new Set()
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=option], [role=switch], [tabindex]:not([tabindex="-1"])')) {
    const r = box(el)
    const visible = el.matches("input[type=radio], input[type=checkbox]") ? r.width > 1 && r.height > 1 : shown(el) && r.width > 1 && r.height > 1
    if (!visible || inSentence(el)) continue
    // a listbox's options are reached by the arrow keys too, but are pressed: they count
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    const key = `${Math.round(r.left)},${Math.round(r.top)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (w < 44 || h < 44) targets.push(`${name(el)}: ${w}×${h}`)
  }

  // 1.4.8: running text
  const spacing = []
  const length = []
  for (const p of document.querySelectorAll("p, li, dd, blockquote, figcaption")) {
    if (!shown(p) || p.closest("nav, [role=listbox], [role=menu], table, [aria-hidden=true]")) continue
    const words = p.innerText.trim()
    if (words.length < 81) continue
    const s = getComputedStyle(p)
    const size = parseFloat(s.fontSize)
    const lh = s.lineHeight === "normal" ? 1.2 : parseFloat(s.lineHeight) / size
    // only text that runs to more than one line has a spacing to keep
    if (p.getBoundingClientRect().height > size * lh * 1.5 && lh < 1.5 - 0.005) spacing.push(`${name(p)}: line height ${lh.toFixed(2)}`)
    if (s.textAlign === "justify") spacing.push(`${name(p)}: justified`)
    // its own font's ch, as max-width: 80ch would count it
    const probe = document.createElement("span")
    probe.textContent = "0".repeat(50)
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;letter-spacing:inherit"
    p.appendChild(probe)
    const ch = probe.getBoundingClientRect().width / 50
    probe.remove()
    const inner = p.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
    const chars = ch ? Math.round(inner / ch) : 0
    if (chars > 80) length.push(`${name(p)}: ${chars} characters a line`)
  }
  return { contrast, drawn, targets, spacing, length }
}

/**
 * 2.4.7 and 2.4.13: the ring the keyboard draws on whatever is focused now,
 * at least 2px wide and 3:1 against what is round it. Run after a Tab.
 */
export function ring() {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const s = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const tag = el.tagName.toLowerCase()
  const label = `${tag}${el.id ? "#" + el.id : ""} "${(el.getAttribute("aria-label") || el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 30)}"`
  if (r.width <= 1 || r.height <= 1) return { label, ok: true }
  const parse = (c) => (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number)
  const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
  // the ring may be drawn on the thing pressed (a radio's pill), not the hidden input
  // an outline drawn in no colour (Tailwind's outline-none) is no ring
  const drawn = [el, el.nextElementSibling, el.parentElement].find((n) => {
    const o = n && getComputedStyle(n)
    return o && o.outlineStyle !== "none" && parseFloat(o.outlineWidth) > 0 && (parse(o.outlineColor)[3] ?? 1) > 0
  })
  if (!drawn) return { label, ok: false, why: "no ring" }
  const o = getComputedStyle(drawn)
  const width = parseFloat(o.outlineWidth)
  const offset = parseFloat(o.outlineOffset)
  // an inset ring lies on the control itself, an outset one on what is round it
  let ground = [255, 255, 255]
  for (let n = offset < 0 ? drawn : drawn.parentElement; n; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor)
    if (c.length < 4 || c[3] >= 1) {
      ground = c.slice(0, 3)
      break
    }
  }
  const [a, b] = [lum(parse(o.outlineColor)), lum(ground)].sort((x, y) => y - x)
  const contrast = (a + 0.05) / (b + 0.05)
  const ok = width >= 2 && contrast >= 3
  return { label, ok, why: ok ? "" : `${width}px ring at ${contrast.toFixed(2)}:1` }
}

/** A PNG's pixels as [r, g, b] (Playwright's screenshots: 8 bits, RGB or RGBA). */
export function pngPixels(png) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const channels = { 2: 3, 6: 4 }[png[25]]
  if (png[24] !== 8 || !channels) throw new Error(`a PNG this cannot read: depth ${png[24]}, type ${png[25]}`)
  const chunks = []
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at)
    const type = png.toString("ascii", at + 4, at + 8)
    if (type === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + length))
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * channels
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]
      const left = x >= channels ? out[y * stride + x - channels] : 0
      const up = y ? out[(y - 1) * stride + x] : 0
      const corner = y && x >= channels ? out[(y - 1) * stride + x - channels] : 0
      const p = left + up - corner
      const paeth = Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner) ? left : Math.abs(p - up) <= Math.abs(p - corner) ? up : corner
      out[y * stride + x] = (v + [0, left, up, (left + up) >> 1, paeth][filter]) & 255
    }
  }
  const pixels = []
  for (let i = 0; i < out.length; i += channels) pixels.push([out[i], out[i + 1], out[i + 2]])
  return pixels
}

/**
 * Words on a drawing, judged from the pixels: each marked element's words
 * are hidden, its box is photographed, and its colour is held against the
 * ground a quarter of the way from the worst (the darker side for dark
 * words), so a rule or an edge the box takes in does not decide it, but a
 * ground that is mostly too close does. Returns what fails.
 */
export async function drawnGround(page, drawn) {
  const fails = []
  for (const [i, item] of drawn.slice(0, 40).entries()) {
    const el = page.locator(`[data-aaa-drawn="${i}"]`)
    if (!(await el.count())) continue
    await el.scrollIntoViewIfNeeded()
    // the element's words and those of everything in it (a link, a count) go
    await el.evaluate((n) => {
      for (const m of [n, ...n.querySelectorAll("*")]) {
        m.dataset.aaaStyle = m.getAttribute("style") ?? ""
        for (const [prop, value] of [["color", "transparent"], ["-webkit-text-fill-color", "transparent"], ["text-decoration-color", "transparent"], ["text-shadow", "none"]]) m.style.setProperty(prop, value, "important")
      }
    })
    // two frames, so what was scrolled into view has settled before it is taken
    await el.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    const box = await el.boundingBox()
    const shot = box && box.width >= 1 && box.height >= 1 ? await page.screenshot({ clip: box, animations: "disabled" }) : null
    await el.evaluate((n) => {
      for (const m of [n, ...n.querySelectorAll("*")]) m.setAttribute("style", m.dataset.aaaStyle ?? "")
    })
    if (!shot) continue
    const ink = (item.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
    const dark = luminance(ink) < 0.18
    const ground = pngPixels(shot).sort((a, b) => luminance(a) - luminance(b))
    const at = ground[Math.floor(ground.length * (dark ? 0.25 : 0.75))]
    const got = ratio(ink, at)
    if (got < item.needs) fails.push(`${item.el}: ${got.toFixed(2)}:1 on its drawing, needs ${item.needs}:1`)
  }
  return fails
}
