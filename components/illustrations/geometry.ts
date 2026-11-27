/**
 * The geometry of the packs (components/illustrations/packs.tsx), kept apart
 * from the drawing so the tests can hold it (tests/packs.test.mjs):
 *
 * - where a label's words land on a round pack, so they curve exactly as the
 *   pack's bands do;
 * - how far each pack's shadow reaches, so no picture cuts one off;
 * - how packs stand on a shelf: as deep as they are, evenly spaced, every
 *   shadow on the shelf.
 *
 * Every drawing reads its shapes from here, so what the tests measure is
 * what the reader sees. Numbers only and no JSX, so node runs it as it is.
 */

/** How far a unit of depth runs right and up: the oblique view every pack is
 *  drawn in, its front square on to the reader. */
export const DX = 0.46
export const DY = 0.3

/** The blur of a soft shadow, and of the dark line where a pack meets the
 *  ground. A Gaussian blur is gone three deviations out, so a shadow is drawn
 *  that far past its shape and no further: each one's filter region is
 *  exactly that (`shadowRegion`). */
export const SOFT = 10
export const TIGHT = 3

export type Point = [number, number]
export type Rect = { left: number; top: number; right: number; bottom: number }

export type Shape = { kind: "poly"; points: Point[] } | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
export type Shadow = { shape: Shape; blur: number; opacity: number }

export type BoxSpec = { kind: "box"; x: number; y: number; w: number; h: number; d: number }
export type CartonSpec = { kind: "carton"; x: number; y: number; w: number; h: number; d: number; gable: number }
/** `top`: the middle of the lid; `h`: from there to the middle of the base. */
export type CanSpec = { kind: "can"; x: number; top: number; w: number; h: number; ry: number }
export type CupSpec = { kind: "cup"; cx: number; top: number; wTop: number; wBottom: number; h: number; ry: number }
export type BagSpec = { kind: "bag"; x: number; y: number; w: number; h: number }
export type PackSpec = BoxSpec | CartonSpec | CanSpec | CupSpec | BagSpec

/**
 * A pack's outline as drawn: its left and right edges (side faces, lids and
 * bulges included), its highest point, and its base: `front`, the base's
 * nearest point (lowest on screen), and `back`, its farthest.
 */
export type Outline = { left: number; right: number; top: number; front: number; back: number }

export const grow = (r: Rect, by: number): Rect => ({ left: r.left - by, top: r.top - by, right: r.right + by, bottom: r.bottom + by })

export function union(rects: Rect[]): Rect {
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  }
}

export function shapeRect(shape: Shape): Rect {
  if (shape.kind === "ellipse") return { left: shape.cx - shape.rx, top: shape.cy - shape.ry, right: shape.cx + shape.rx, bottom: shape.cy + shape.ry }
  const xs = shape.points.map(([x]) => x)
  const ys = shape.points.map(([, y]) => y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

/** Everything a shadow can darken: its shape and three deviations of blur. */
export const shadowRegion = (s: Shadow): Rect => grow(shapeRect(s.shape), 3 * s.blur)

/** The bag's half-width at its widest, past its seal: its sides bulge out by this much. */
export const bagBulge = (w: number): number => Math.max(6, w * 0.03)
/**
 * A bag's outline: a pillowed pouch whose sides bulge out past its seal and
 * whose base rounds down, under a seal pressed flat and crimped. `seal` is
 * the seal's height (by default 7% of the bag's), `body` the pouch's path,
 * and `crimps` where the seal's crimp lines fall. One drawing for the bag on
 * the shelf (packs.tsx, Bag) and the cookie question's bag
 * (components/layout/cookie-notice.tsx).
 */
export function bagOutline(x: number, y: number, w: number, h: number, seal = Math.max(18, Math.round(h * 0.07))) {
  const bulge = bagBulge(w)
  const body = [
    `M${x + 6},${y + seal}`,
    `C${x - bulge},${y + seal + h * 0.25} ${x - bulge},${y + h * 0.8} ${x + 10},${y + h}`,
    `Q${x + w / 2},${y + h + bulge} ${x + w - 10},${y + h}`,
    `C${x + w + bulge},${y + h * 0.8} ${x + w + bulge},${y + seal + h * 0.25} ${x + w - 6},${y + seal}`,
    "Z",
  ].join(" ")
  const crimps = Array.from({ length: Math.floor((w - 24) / 9) }, (_, n) => x + 14 + n * 9)
  return { seal, bulge, body, crimps }
}

/** The cup's base ellipse, smaller than its lid's in step with its width. */
export const cupBaseRy = (p: Pick<CupSpec, "ry" | "wTop" | "wBottom">): number => p.ry * (p.wBottom / p.wTop)
/** How deep a bag's base runs on screen: a pouch is about a quarter as deep as it is wide. */
const bagDepth = (w: number): number => w * 0.25 * DY

export function outline(p: PackSpec): Outline {
  switch (p.kind) {
    case "box":
      return { left: p.x, right: p.x + p.w + p.d * DX, top: p.y - p.d * DY, front: p.y + p.h, back: p.y + p.h - p.d * DY }
    case "carton": {
      const dy = p.d * DY
      const ridge = p.y - dy / 2 - p.gable
      return { left: p.x, right: p.x + p.w + p.d * DX, top: ridge - Math.max(8, p.gable * 0.22), front: p.y + p.h, back: p.y + p.h - dy }
    }
    case "can":
      return { left: p.x, right: p.x + p.w, top: p.top - p.ry, front: p.top + p.h + p.ry, back: p.top + p.h - p.ry }
    case "cup": {
      const ryB = cupBaseRy(p)
      return { left: p.cx - p.wTop / 2 - 4, right: p.cx + p.wTop / 2 + 4, top: p.top - p.ry - 3, front: p.top + p.h + ryB, back: p.top + p.h - ryB }
    }
    case "bag": {
      // the sides are cubic curves whose controls stand `bulge` outside the
      // seal: at their widest they reach three quarters of the way to them
      const bulge = bagBulge(p.w)
      const front = p.y + p.h + bulge / 2
      return { left: p.x + 2 - 0.75 * bulge, right: p.x + p.w - 2 + 0.75 * bulge, top: p.y, front, back: front - bagDepth(p.w) }
    }
  }
}

/**
 * A pack's shadows, in one light for every pack, from the top left and in
 * front: a soft shadow thrown back and to the right of its base (further at
 * the back), and a dark line where it meets the ground. The box's are the
 * corn flakes box's; a round pack's and a bag's are their bases thrown the
 * same way.
 */
export function shadows(p: PackSpec): Shadow[] {
  if (p.kind === "box" || p.kind === "carton") {
    const dx = p.d * DX
    const dy = p.d * DY
    const b = p.y + p.h
    return [
      {
        shape: {
          kind: "poly",
          points: [
            [p.x + 6, b],
            [p.x + p.w + 26, b + 4],
            [p.x + p.w + dx + 70, b - dy + 8],
            [p.x + dx + 24, b - dy + 2],
          ],
        },
        blur: SOFT,
        opacity: 0.16,
      },
      {
        shape: {
          kind: "poly",
          points: [
            [p.x + 2, b - 1],
            [p.x + p.w + 4, b - 1],
            [p.x + p.w + 4, b + 5],
            [p.x + 2, b + 5],
          ],
        },
        blur: TIGHT,
        opacity: 0.22,
      },
    ]
  }
  if (p.kind === "bag") {
    const b = p.y + p.h
    return [
      { shape: { kind: "ellipse", cx: p.x + p.w / 2 + 24, cy: b - 6, rx: p.w / 2 + 12, ry: 12 }, blur: SOFT, opacity: 0.16 },
      { shape: { kind: "ellipse", cx: p.x + p.w / 2, cy: b + 2, rx: p.w / 2 - 6, ry: 7 }, blur: TIGHT, opacity: 0.22 },
    ]
  }
  const base = p.kind === "can" ? { cx: p.x + p.w / 2, b: p.top + p.h, r: p.w / 2, ry: p.ry } : { cx: p.cx, b: p.top + p.h, r: p.wBottom / 2, ry: cupBaseRy(p) }
  return [
    // the base thrown back and to the right: its left side stays hidden behind the pack
    { shape: { kind: "ellipse", cx: base.cx + 24, cy: base.b - base.ry * 0.25, rx: base.r + 20, ry: base.ry * 0.95 }, blur: SOFT, opacity: 0.16 },
    { shape: { kind: "ellipse", cx: base.cx, cy: base.b + 2, rx: base.r - 2, ry: base.ry * 0.75 }, blur: TIGHT, opacity: 0.2 },
  ]
}

/** All a pack draws: its outline and every shadow's reach. */
export function bounds(p: PackSpec): Rect {
  const o = outline(p)
  return union([{ left: o.left, top: o.top, right: o.right, bottom: o.front }, ...shadows(p).map(shadowRegion)])
}

/** The same pack, moved so its outline's left edge is at `left` and its base's front at `front`. */
export function placed<P extends PackSpec>(pack: P, left: number, front: number): P {
  const p: PackSpec = pack
  const o = outline(p)
  const dx = left - o.left
  const dy = front - o.front
  switch (p.kind) {
    case "can":
      return { ...p, x: p.x + dx, top: p.top + dy } as P
    case "cup":
      return { ...p, cx: p.cx + dx, top: p.top + dy } as P
    default:
      return { ...p, x: p.x + dx, y: p.y + dy } as P
  }
}

/** A round pack where a line of its label lies: its middle, its radius there
 *  and the half-height of the ellipse a band round it makes there. */
export type Round = { cx: number; r: number; ry: number }

export const canRound = (p: CanSpec): Round => ({ cx: p.x + p.w / 2, r: p.w / 2, ry: p.ry })

/**
 * The round of a cup at the line whose front lies at height `at`. The cup
 * narrows from its lid to its base, so each line has its own radius: that of
 * the ring through it, which is lower at the front than at the sides by its
 * own ellipse.
 */
export function cupRound(p: CupSpec, at: number): Round {
  const half = (y: number) => (p.wTop + (p.wBottom - p.wTop) * ((y - p.top) / p.h)) / 2
  const ryAt = (y: number) => p.ry * ((half(y) * 2) / p.wTop)
  // the ring's sides sit higher than its front by its own ellipse, which
  // depends on where they are: a few rounds settle it
  let side = at - p.ry
  for (let n = 0; n < 4; n++) side = at - ryAt(side)
  return { cx: p.cx, r: half(side), ry: ryAt(side) }
}

/**
 * Where a point of a flat label lands on a round pack seen from a little
 * above. The label is drawn as on a sheet in front of the pack, its middle at
 * `cx` and each line's height taken at the front. A point `u` across it is an
 * angle θ = (u − cx) / r round the pack: it lands at x = cx + r·sin θ and
 * rises by ry·(1 − cos θ), the ellipse a band round the pack follows. So a
 * line curves exactly as its band does, lower in the middle; letters narrow
 * towards the edges; upright strokes stay upright.
 */
export function wrapPoint(u: number, v: number, round: Round): Point {
  const theta = (u - round.cx) / round.r
  return [round.cx + round.r * Math.sin(theta), v - round.ry * (1 - Math.cos(theta))]
}

/** One slice of a flat label, `from`–`to` across it, the matrix that lays it
 *  on the pack, and the slice to draw (`clip`), a little wider than the slice
 *  so neighbours overlap and no seam shows between them. */
export type Strip = { from: number; to: number; clip: [number, number]; matrix: [number, number, number, number, number, number] }

/** How many slices round the front half: each about six units wide, and at
 *  most 90 (2° each). Either way every point lies within a twentieth of a
 *  unit of the true curve, on the largest pack drawn (a 270 radius) too. */
export const stripCount = (r: number): number => Math.min(90, Math.max(24, Math.ceil((Math.PI * r) / 6)))

/**
 * A label wrapped round a round pack, as slices: each one a narrow upright
 * slice of the flat label, moved by its own matrix so both its edges land
 * exactly on the curve (`wrapPoint`). Neighbours meet edge to edge, the
 * curve between is a chord of it, and only the front half (θ from −90° to
 * 90°) is drawn: the rest of the label is round the back.
 */
export function wrapStrips(round: Round, count = stripCount(round.r)): Strip[] {
  const start = round.cx - (round.r * Math.PI) / 2
  const step = (round.r * Math.PI) / count
  const lift = (u: number) => wrapPoint(u, 0, round)
  // short numbers for the markup; the offsets are worked out from the
  // rounded slopes, so both edges of a slice still land within a thousandth
  const fine = (n: number) => Math.round(n * 1e6) / 1e6
  const near = (n: number) => Math.round(n * 1e3) / 1e3
  return Array.from({ length: count }, (_, n) => {
    const from = start + n * step
    const to = from + step
    const [x0, y0] = lift(from)
    const [x1, y1] = lift(to)
    const a = fine((x1 - x0) / step)
    const b = fine((y1 - y0) / step)
    // half a unit of overlap on screen, however narrow the slice is drawn
    const over = Math.min(step / 2, 0.5 / Math.max(a, 1e-6))
    return { from, to, clip: [near(from - over), near(to + over)], matrix: [a, b, 0, 1, near(x0 - a * from), near(y0 - b * from)] }
  })
}

/** Where a slice's matrix puts a point of the flat label. */
export const applyMatrix = (m: Strip["matrix"], [u, v]: Point): Point => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]

/** A shelf: its top's front edge from `x` to `x + w` at height `y`, running
 *  back `d` (in units of depth), and its front edge `lip` thick. */
export type ShelfSpec = { x: number; y: number; w: number; d: number; lip: number }

export const shelfRect = (s: ShelfSpec): Rect => ({ left: s.x, top: s.y - s.d * DY, right: s.x + s.w + s.d * DX, bottom: s.y + s.lip })

export type ShelfLayout = { packs: PackSpec[]; shelf: ShelfSpec; gap: number; viewBox: Rect }

/**
 * Packs on a shelf, in the order given:
 *
 * - each stands `inset` behind the shelf's front edge;
 * - the shelf is as deep as the deepest of them, with `inset` in front and
 *   `margin` behind;
 * - they are spaced evenly by their outlines: the same gap between each pair
 *   and at both ends;
 * - the gap is never less than `minGap`, nor than the last pack's shadow
 *   reaches past it, so every shadow lands on the shelf;
 * - the picture (`viewBox`) holds the shelf, its end, every pack and every
 *   shadow, with `pad` round them.
 */
export function shelfLayout(packs: PackSpec[], o: { x: number; y: number; inset: number; margin: number; minGap: number; lip: number; pad: number }): ShelfLayout {
  const last = packs[packs.length - 1]
  const reach = last ? Math.max(...shadows(last).map((s) => shadowRegion(s).right)) - outline(last).right : 0
  const gap = Math.max(o.minGap, Math.ceil(reach))
  let left = o.x + gap
  const placedPacks = packs.map((p) => {
    const q = placed(p, left, o.y - o.inset)
    left = outline(q).right + gap
    return q
  })
  const deepest = Math.max(0, ...placedPacks.map((p) => outline(p).front - outline(p).back))
  const shelf: ShelfSpec = { x: o.x, y: o.y, w: left - o.x, d: (o.inset + deepest + o.margin) / DY, lip: o.lip }
  const viewBox = grow(union([shelfRect(shelf), ...placedPacks.map(bounds)]), o.pad)
  return { packs: placedPacks, shelf, gap, viewBox }
}

/** The viewBox attribute for a rect. */
export const viewBoxOf = (r: Rect): string => [r.left, r.top, r.right - r.left, r.bottom - r.top].map((n) => Math.round(n * 100) / 100).join(" ")
