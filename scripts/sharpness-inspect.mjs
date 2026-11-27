// What npm run sharpness looks for on a page (scripts/sharpness-audit.mjs),
// on its own so tests/sharpness-inspect.test.mjs can hold it to planted
// cases. It runs inside the page (Playwright's evaluate), so it reaches for
// nothing outside itself.

/** Runs in the page: every picture too small for its box, and every word drawn soft. */
export function inspect(scale) {
  const found = []
  // a node is moved by its translate, rotate and scale, in that order, then by
  // its transform (the site's own motion sets the first three on their own)
  const PARTS = ["translate", "rotate", "scale", "transform"]
  const described = (style) => PARTS.filter((p) => style[p] && style[p] !== "none").map((p) => `${p}: ${style[p]}`).join("; ")
  /** A length of a node's own translate in pixels: a percentage is of its
   *  border box, across for x and down for y. */
  const pixels = (length, style, across) => {
    if (!length.endsWith("%")) return length
    const side = (a, b) => ["padding", "border"].reduce((sum, edge) => sum + parseFloat(style[`${edge}${a}${edge === "border" ? "Width" : ""}`]) + parseFloat(style[`${edge}${b}${edge === "border" ? "Width" : ""}`]), 0)
    const box = parseFloat(across ? style.width : style.height) + (style.boxSizing === "border-box" ? 0 : across ? side("Left", "Right") : side("Top", "Bottom"))
    return `${(parseFloat(length) / 100) * box}px`
  }
  /** Everything that moves a node, as one matrix; null when nothing does. */
  const moved = (style) => {
    const parts = []
    if (style.translate && style.translate !== "none") {
      const [x, y = "0px", z = "0px"] = style.translate.split(" ")
      parts.push(`translate3d(${pixels(x, style, true)}, ${pixels(y, style, false)}, ${z})`)
    }
    if (style.rotate && style.rotate !== "none") {
      const r = style.rotate.split(" ")
      parts.push(r.length === 1 ? `rotate(${r[0]})` : r.length === 2 ? `rotate${r[0].toUpperCase()}(${r[1]})` : `rotate3d(${r.join(", ")})`)
    }
    if (style.scale && style.scale !== "none") {
      const [x, y = x, z = "1"] = style.scale.split(" ")
      parts.push(`scale3d(${x}, ${y}, ${z})`)
    }
    if (style.transform && style.transform !== "none") parts.push(style.transform)
    if (!parts.length) return null
    try {
      return new DOMMatrixReadOnly(parts.join(" "))
    } catch {
      // a length the matrix cannot hold (a calc()): judged by the transform alone
      return style.transform && style.transform !== "none" ? new DOMMatrixReadOnly(style.transform) : null
    }
  }
  /**
   * Whether a transform leaves a flat node's words on whole pixels. Words lie
   * flat (z = 0), so what reaches the screen is the matrix's projection of
   * that plane: a perspective alone (m34) moves nothing on it, and leaves the
   * plain 2D matrix (m11, m12, m21, m22, m41, m42). A tilt toward the reader
   * (m14, m24), or a w other than 1, resamples. So does any turn but a
   * quarter, a half or a flip, any scale, and any offset between pixels.
   */
  const onPixels = (m, scale) => {
    const flat = Math.abs(m.m14) < 1e-9 && Math.abs(m.m24) < 1e-9 && Math.abs(m.m44 - 1) < 1e-9
    const whole = (v) => [-1, 0, 1].some((w) => Math.abs(v - w) < 0.001)
    const partPixel = (v) => Math.abs(v * scale - Math.round(v * scale)) > 0.05
    const [a, b, c, d] = [m.m11, m.m12, m.m21, m.m22]
    return flat && [a, b, c, d].every(whole) && Math.abs(Math.abs(a * d - b * c) - 1) < 0.001 && !partPixel(m.m41) && !partPixel(m.m42)
  }
  const describe = (el) => `<${el.tagName.toLowerCase()}${el.getAttribute("src") ? ` src="${el.getAttribute("src").slice(0, 70)}"` : ""}>`
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === "none" || style.visibility === "hidden") return false
    }
    return true
  }

  for (const img of document.images) {
    if (!shown(img) || !img.complete || !img.naturalWidth) continue
    if (/\.svg($|\?)/i.test(img.currentSrc || img.src) || img.currentSrc.startsWith("data:image/svg")) continue
    const r = img.getBoundingClientRect()
    const fit = getComputedStyle(img).objectFit
    // the scale the browser draws the picture's pixels at, after its crop
    const ratio =
      fit === "cover"
        ? Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight)
        : fit === "contain" || fit === "scale-down"
          ? Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight)
          : Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight)
    const needed = ratio * scale
    if (needed > 1.02) found.push(`blurred picture: ${describe(img)} is ${img.naturalWidth}×${img.naturalHeight}, drawn ${Math.round(r.width)}×${Math.round(r.height)} (needs ${needed.toFixed(2)}× its pixels)`)
  }

  const soft = new Set()
  for (const el of document.body.querySelectorAll("*")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own || !shown(el)) continue
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (soft.has(node)) break
      const style = getComputedStyle(node)
      if (style.filter && style.filter !== "none" && /blur/.test(style.filter)) {
        soft.add(node)
        found.push(`text under a blur: <${node.tagName.toLowerCase()}> "${(node.textContent || "").trim().slice(0, 40)}"`)
        break
      }
      const m = moved(style)
      if (m && !onPixels(m, scale)) {
        soft.add(node)
        found.push(`text moved by part of a pixel: <${node.tagName.toLowerCase()}> "${(node.textContent || "").trim().slice(0, 40)}" (${described(style)})`)
        break
      }
    }
  }
  return [...new Set(found)]
}
