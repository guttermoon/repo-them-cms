import type React from "react"

import {
  bagOutline,
  canRound,
  cupBaseRy,
  cupRound,
  DX,
  DY,
  shadowRegion,
  shadows,
  wrapStrips,
  type PackSpec,
  type Round,
  type Shadow,
  type ShelfSpec,
} from "./geometry"

/**
 * Generic packs, drawn in three dimensions: a box, a can, a gable-top
 * carton, a cup and a bag, each with the lowercase word and the band round
 * it, standing in light from the top left. One set of drawings for every
 * picture of them: the still life on /features, the pack on /about, and the
 * shop's pictures and the team's portraits (scripts/build-demo-images.mjs
 * renders these same components), so they all match.
 *
 * Matte, like card and paper: the faces turned from the light are shaded
 * and nothing shines, because a sheen washes out the words under it. Words
 * on a round pack wrap round it (`RoundLabel`), curving exactly as its bands
 * do. Where words land, how far each shadow reaches and how packs stand on a
 * shelf is worked out in ./geometry, where tests/packs.test.mjs holds it.
 *
 * Drawn as SVG in the site's own lettering: sharp at any size, no request,
 * and the words stay words (a picture on a page takes its words as props,
 * from Notion slots).
 *
 * The depth runs up and to the right (an oblique view), so a pack's front is
 * square on to the reader and its words are never skewed.
 */

export const BRAND = "#283FA6"
export const TINT = "#E6EAF9"
export const SLAB = { fontFamily: "var(--font-slab), Rockwell, Georgia, serif", fontWeight: 700 } as const
export const MONO = { fontFamily: "var(--font-mono), ui-monospace, monospace" } as const
export const SANS = { fontFamily: "var(--font-sans), Inter, system-ui, sans-serif" } as const

const EDGE = "#C3CADB"
export const INK = "#1B2552"
/** A lid's pressed panel, a shade below its rim, and the line round it. */
const PANEL = "#EEF1F7"
const PANEL_EDGE = "#CBD2E1"

/**
 * The shading over a round pack, left to right, as [where, how dark]: lit
 * from the top left, so lightest a fifth of the way across, turning from the
 * light to about the box's side at the right edge. Ink at these strengths
 * over the print: it only darkens, as a matte surface does.
 */
export const MATTE: [number, number][] = [
  [0, 0.08],
  [0.1, 0.03],
  [0.22, 0],
  [0.5, 0.03],
  [0.75, 0.09],
  [0.9, 0.14],
  [1, 0.17],
]

/** A pouch's: flat across its face, darker only where its sides turn away. */
export const POUCH: [number, number][] = [
  [0, 0.08],
  [0.08, 0.02],
  [0.2, 0],
  [0.75, 0.015],
  [0.92, 0.07],
  [1, 0.13],
]

/** A font size that fits `text` in `width`, at most `max`: the slab's
 *  lowercase runs about half an em a letter. */
export function fitSize(text: string, width: number, max: number, perChar = 0.54): number {
  return Math.max(12, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * perChar))))
}

/** Ink shading from `stops`, across whatever it fills or across `x1`–`x2`. */
function Shading({ id, stops, span }: { id: string; stops: [number, number][]; span?: [number, number] }) {
  return (
    <linearGradient id={id} {...(span ? { gradientUnits: "userSpaceOnUse", x1: span[0], x2: span[1], y1: 0, y2: 0 } : { x1: 0, x2: 1, y1: 0, y2: 0 })}>
      {stops.map(([offset, opacity]) => (
        <stop key={offset} offset={offset} stopColor={INK} stopOpacity={opacity} />
      ))}
    </linearGradient>
  )
}

/** The gradients every pack shares; `uid` keeps two pictures on one page
 *  from sharing ids. */
export function PackDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#EEF1F8" />
      </linearGradient>
      <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#E2E6F1" />
        <stop offset="1" stopColor="#CBD2E4" />
      </linearGradient>
      <linearGradient id={`${uid}-top`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#EDF0F7" />
      </linearGradient>
      <Shading id={`${uid}-matte`} stops={MATTE} />
      <Shading id={`${uid}-pouch`} stops={POUCH} />
      <linearGradient id={`${uid}-shelf`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#E9EDF6" />
        <stop offset="1" stopColor="#F4F6FB" />
      </linearGradient>
    </defs>
  )
}

/** The band: a dark line, a pale band, a dark line, across a front. */
export function FrontBand({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const e = Math.max(3, Math.round(h / 6.5))
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={TINT} />
      <rect x={x} y={y} width={w} height={e} fill={BRAND} />
      <rect x={x} y={y + h - e} width={w} height={e} fill={BRAND} />
    </g>
  )
}

/** The band carried round onto a side, which runs back at (dx, -dy). */
function SideBand({ x, y, h, dx, dy }: { x: number; y: number; h: number; dx: number; dy: number }) {
  const e = Math.max(3, Math.round(h / 6.5))
  const quad = (top: number, height: number) => `M${x},${top}L${x + dx},${top - dy}L${x + dx},${top - dy + height}L${x},${top + height}Z`
  return (
    <g>
      <path d={quad(y, h)} fill={TINT} />
      <path d={quad(y, e)} fill={BRAND} />
      <path d={quad(y + h - e, e)} fill={BRAND} />
      <path d={quad(y, h)} fill={INK} opacity="0.14" />
    </g>
  )
}

/**
 * A pack's shadows (geometry.ts, `shadows`), each blurred inside a filter
 * region exactly as large as its blur reaches: nothing past it is drawn,
 * and nothing within it is cut.
 */
function Shadows({ uid, name, pack }: { uid: string; name: string; pack: PackSpec }) {
  return (
    <g>
      {shadows(pack).map((shadow, n) => (
        <ShadowShape key={n} id={`${uid}-${name}-shadow${n}`} shadow={shadow} />
      ))}
    </g>
  )
}

function ShadowShape({ id, shadow }: { id: string; shadow: Shadow }) {
  const r = shadowRegion(shadow)
  const s = shadow.shape
  const paint = { fill: INK, opacity: shadow.opacity, filter: `url(#${id})` }
  return (
    <g>
      <filter id={id} filterUnits="userSpaceOnUse" x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top}>
        <feGaussianBlur stdDeviation={shadow.blur} />
      </filter>
      {s.kind === "ellipse" ? <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...paint} /> : <path d={`M${s.points.map(([x, y]) => `${x},${y}`).join("L")}Z`} {...paint} />}
    </g>
  )
}

/**
 * A label wrapped round a round pack (geometry.ts, `wrapStrips`). The label
 * is drawn once, flat, in <defs>, its middle at the pack's and each line's
 * height taken at the front; it is shown slice by slice, each slice a <use>
 * of it moved onto the curve. So the words stay text (sharp at any size, and
 * on the page once) and curve exactly as the bands round the pack do.
 *
 * Each slice is cut out with a mask, not a clip path: a clip path cuts each
 * shape separately, so at its soft edge whatever lies under the words (the
 * nutrition panel's white) shows through as a thin line, where a mask cuts
 * the slice as a whole. `top` and `bottom` bound the label.
 */
function RoundLabel({ id, round, top, bottom, children }: { id: string; round: Round; top: number; bottom: number; children: React.ReactNode }) {
  const strips = wrapStrips(round)
  const height = bottom - top
  return (
    <g>
      <defs>
        <g id={id}>{children}</g>
        {strips.map((strip, n) => {
          const width = Math.round((strip.clip[1] - strip.clip[0]) * 1000) / 1000
          return (
            // the mask's region is wider than its slice, so only the slice's own soft edge cuts
            <mask key={n} id={`${id}-${n}`} maskUnits="userSpaceOnUse" x={strip.clip[0] - 2} y={top} width={width + 4} height={height}>
              <rect x={strip.clip[0]} y={top} width={width} height={height} fill="#FFFFFF" />
            </mask>
          )
        })}
      </defs>
      {strips.map((strip, n) => (
        <use key={n} href={`#${id}`} mask={`url(#${id}-${n})`} transform={`matrix(${strip.matrix.join(" ")})`} />
      ))}
    </g>
  )
}

/**
 * A pack's face: its outline `d` in the front's light, and what is printed
 * on it (`children`: the band, the words, the shading over them) cut to that
 * outline, by a clip path named for the pack (`uid`-`name`).
 */
function Face({ uid, name, d, children }: { uid: string; name: string; d: string; children: React.ReactNode }) {
  return (
    <>
      <path d={d} fill={`url(#${uid}-front)`} />
      <clipPath id={`${uid}-${name}`}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${uid}-${name})`}>{children}</g>
    </>
  )
}

/** The light catching a flat front's left and top edges. */
function LitEdge({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return <path d={`M${x + 1},${y + h - 2}V${y + 1}H${x + w - 2}`} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeOpacity="0.9" />
}

type PackProps = {
  uid: string
  /** names this pack's clip path, unique in its picture */
  name: string
  x: number
  /** the top of the front */
  y: number
  w: number
  h: number
  /** how deep: the side and the top run back by this much */
  d: number
  /** where the band crosses the front, if it has one */
  band?: { y: number; h: number }
  children?: React.ReactNode
}

/** A box: front, top and right side, the band carried round. */
export function Box({ uid, name, x, y, w, h, d, band, children }: PackProps) {
  const dx = d * DX
  const dy = d * DY
  const front = `M${x},${y}H${x + w}V${y + h}H${x}Z`
  return (
    <g>
      <Shadows uid={uid} name={name} pack={{ kind: "box", x, y, w, h, d }} />
      <path d={`M${x},${y}L${x + w},${y}L${x + w + dx},${y - dy}L${x + dx},${y - dy}Z`} fill={`url(#${uid}-top)`} />
      <path d={`M${x + w},${y}L${x + w + dx},${y - dy}L${x + w + dx},${y + h - dy}L${x + w},${y + h}Z`} fill={`url(#${uid}-side)`} />
      {band ? <SideBand x={x + w} y={band.y} h={band.h} dx={dx} dy={dy} /> : null}
      <Face uid={uid} name={name} d={front}>
        {band ? <FrontBand x={x} y={band.y} w={w} h={band.h} /> : null}
        {children}
      </Face>
      {/* the silhouette, the edges between faces, and the light catching the lit edges */}
      <path
        d={`M${x},${y + h}V${y}L${x + dx},${y - dy}H${x + w + dx}V${y + h - dy}L${x + w},${y + h}Z`}
        fill="none"
        stroke={EDGE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={`M${x},${y}H${x + w}L${x + w + dx},${y - dy}M${x + w},${y}V${y + h}`} fill="none" stroke={EDGE} strokeWidth="1.2" strokeOpacity="0.8" />
      <LitEdge x={x} y={y} w={w} h={h} />
    </g>
  )
}

/** A gable-top carton: a box whose front and back slope up to a sealed
 *  ridge, with a triangle on the side. */
export function Carton({ uid, name, x, y, w, h, d, band, gable, children }: PackProps & { gable: number }) {
  const dx = d * DX
  const dy = d * DY
  const ridgeY = y - dy / 2 - gable
  const fin = Math.max(8, gable * 0.22)
  const front = `M${x},${y}H${x + w}V${y + h}H${x}Z`
  return (
    <g>
      <Shadows uid={uid} name={name} pack={{ kind: "carton", x, y, w, h, d, gable }} />
      <path d={`M${x + w},${y}L${x + w + dx},${y - dy}L${x + w + dx},${y + h - dy}L${x + w},${y + h}Z`} fill={`url(#${uid}-side)`} />
      {band ? <SideBand x={x + w} y={band.y} h={band.h} dx={dx} dy={dy} /> : null}
      {/* the side's gable, in shade */}
      <path d={`M${x + w},${y}L${x + w + dx},${y - dy}L${x + w + dx / 2},${ridgeY}Z`} fill={`url(#${uid}-side)`} />
      <path d={`M${x + w},${y}L${x + w + dx},${y - dy}L${x + w + dx / 2},${ridgeY}Z`} fill={INK} opacity="0.06" />
      {/* the front's roof, facing the light */}
      <path d={`M${x},${y}L${x + w},${y}L${x + w + dx / 2},${ridgeY}L${x + dx / 2},${ridgeY}Z`} fill={`url(#${uid}-top)`} />
      {/* the sealed fin along the ridge */}
      <path d={`M${x + dx / 2},${ridgeY}H${x + w + dx / 2}V${ridgeY - fin}H${x + dx / 2}Z`} fill="#F7F8FC" stroke={EDGE} strokeWidth="1.2" />
      <Face uid={uid} name={name} d={front}>
        {band ? <FrontBand x={x} y={band.y} w={w} h={band.h} /> : null}
        {children}
      </Face>
      <path
        d={`M${x},${y + h}V${y}L${x + dx / 2},${ridgeY}H${x + w + dx / 2}L${x + w + dx},${y - dy}V${y + h - dy}L${x + w},${y + h}Z`}
        fill="none"
        stroke={EDGE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={`M${x},${y}H${x + w}L${x + w + dx / 2},${ridgeY}M${x + w},${y}L${x + w + dx},${y - dy}M${x + w},${y}V${y + h}`} fill="none" stroke={EDGE} strokeWidth="1.2" strokeOpacity="0.8" />
      <LitEdge x={x} y={y} w={w} h={h} />
    </g>
  )
}

/** The front half of a ring round a can, between two heights at its sides. */
function ringPath(x: number, w: number, ry: number, top: number, bottom: number): string {
  const rx = w / 2
  return `M${x},${top}A${rx},${ry} 0 0 0 ${x + w},${top}V${bottom}A${rx},${ry} 0 0 1 ${x},${bottom}Z`
}

/** The band round a round pack: a dark line, a pale band, a dark line. */
function RingBand({ ring, y, h }: { ring: (top: number, bottom: number) => string; y: number; h: number }) {
  const e = Math.max(3, Math.round(h / 6.5))
  return (
    <g>
      <path d={ring(y, y + h)} fill={TINT} />
      <path d={ring(y, y + e)} fill={BRAND} />
      <path d={ring(y + h - e, y + h)} fill={BRAND} />
    </g>
  )
}

/**
 * A can: a cylinder, the band printed round it, the label wrapped round it,
 * and a lid (with a ring pull for a drink, a ridge for a tin).
 *
 * A band's `y` is the height of its sides; it dips by `ry` at the front. The
 * label (`children`) is drawn flat, its middle at the can's, each line's
 * height taken at the front: so a line set just under a band's front stays
 * just under it all the way round.
 */
export function Can({
  uid,
  name,
  x,
  top,
  w,
  h,
  ry,
  bands = [],
  ribs = false,
  pull = false,
  children,
}: {
  uid: string
  name: string
  x: number
  /** the middle of the lid */
  top: number
  w: number
  /** from the lid to the bottom rim */
  h: number
  /** the lid's ellipse, its height over two */
  ry: number
  bands?: { y: number; h: number }[]
  ribs?: boolean
  pull?: boolean
  children?: React.ReactNode
}) {
  const rx = w / 2
  const cx = x + rx
  const bottom = top + h
  const body = `M${x},${top}V${bottom}A${rx},${ry} 0 0 0 ${x + w},${bottom}V${top}Z`
  return (
    <g>
      <Shadows uid={uid} name={name} pack={{ kind: "can", x, top, w, h, ry }} />
      <Face uid={uid} name={name} d={body}>
        {bands.map((b, n) => (
          <RingBand key={n} ring={(y1, y2) => ringPath(x, w, ry, y1, y2)} y={b.y} h={b.h} />
        ))}
        {ribs
          ? Array.from({ length: 5 }, (_, n) => {
              const yy = top + h * (0.16 + n * 0.17)
              return <path key={n} d={`M${x},${yy}A${rx},${ry} 0 0 0 ${x + w},${yy}`} fill="none" stroke={INK} strokeOpacity="0.08" strokeWidth="4" />
            })
          : null}
        {children ? (
          <RoundLabel id={`${uid}-${name}-label`} round={canRound({ kind: "can", x, top, w, h, ry })} top={top - ry} bottom={bottom + ry}>
            {children}
          </RoundLabel>
        ) : null}
        <path d={body} fill={`url(#${uid}-matte)`} />
      </Face>
      <path d={body} fill="none" stroke={EDGE} strokeWidth="1.5" />
      {/* the lid: its rim, the panel pressed into it, and a ring pull or a tin's ridge */}
      <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={`url(#${uid}-top)`} stroke={EDGE} strokeWidth="1.5" />
      <ellipse cx={cx} cy={top + ry * 0.12} rx={rx * 0.86} ry={ry * 0.72} fill={PANEL} stroke={PANEL_EDGE} strokeWidth="1.2" />
      {ribs ? <ellipse cx={cx} cy={top + ry * 0.12} rx={rx * 0.6} ry={ry * 0.48} fill="none" stroke={PANEL_EDGE} strokeWidth="1.5" /> : null}
      {pull ? (
        <g>
          <ellipse cx={cx} cy={top + ry * 0.05} rx={rx * 0.22} ry={ry * 0.34} fill="#E3E7EF" stroke="#B9C1D1" strokeWidth="1.5" />
          <ellipse cx={cx} cy={top + ry * 0.05} rx={rx * 0.1} ry={ry * 0.15} fill={PANEL} stroke="#B9C1D1" strokeWidth="1.2" />
          <ellipse cx={cx + rx * 0.18} cy={top + ry * 0.36} rx={rx * 0.12} ry={ry * 0.12} fill="#D5DBE6" />
        </g>
      ) : null}
    </g>
  )
}

/** A cup, as instant noodles come in: wider at the top than the bottom, the
 *  band following its taper, a foil lid with a tab, and each line of its
 *  label wrapped at its own height (`lines`, each with the height of its
 *  front, `at`), since the cup is narrower lower down. */
export function Cup({
  uid,
  name,
  cx,
  top,
  wTop,
  wBottom,
  h,
  ry,
  band,
  lines = [],
}: {
  uid: string
  name: string
  /** the middle, across */
  cx: number
  /** the middle of the lid */
  top: number
  wTop: number
  wBottom: number
  h: number
  /** the lid's ellipse, its height over two; the base's is smaller in step */
  ry: number
  band?: { y: number; h: number }
  lines?: { at: number; label: React.ReactNode }[]
}) {
  const spec = { kind: "cup", cx, top, wTop, wBottom, h, ry } as const
  const bottom = top + h
  const ryB = cupBaseRy(spec)
  // the cup's half-width at a height, for the band to follow the taper
  const half = (y: number) => (wTop + (wBottom - wTop) * ((y - top) / h)) / 2
  const ryAt = (y: number) => ry * ((half(y) * 2) / wTop)
  const body = `M${cx - wTop / 2},${top}L${cx - wBottom / 2},${bottom}A${wBottom / 2},${ryB} 0 0 0 ${cx + wBottom / 2},${bottom}L${cx + wTop / 2},${top}Z`
  const ring = (y1: number, y2: number) =>
    `M${cx - half(y1)},${y1}A${half(y1)},${ryAt(y1)} 0 0 0 ${cx + half(y1)},${y1}L${cx + half(y2)},${y2}A${half(y2)},${ryAt(y2)} 0 0 1 ${cx - half(y2)},${y2}Z`
  // shaded across its width halfway down, so the shading follows the taper fairly at the top and the base alike
  const mid = (wTop + wBottom) / 4
  return (
    <g>
      <Shadows uid={uid} name={name} pack={spec} />
      <defs>
        <Shading id={`${uid}-${name}-matte`} stops={MATTE} span={[cx - mid, cx + mid]} />
      </defs>
      <Face uid={uid} name={name} d={body}>
        {band ? <RingBand ring={ring} y={band.y} h={band.h} /> : null}
        {lines.map((line, n) => (
          <RoundLabel key={n} id={`${uid}-${name}-line${n}`} round={cupRound(spec, line.at)} top={top - ry} bottom={bottom + ryB}>
            {line.label}
          </RoundLabel>
        ))}
        <path d={body} fill={`url(#${uid}-${name}-matte)`} />
      </Face>
      <path d={body} fill="none" stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* the rolled rim, then the foil lid pressed onto it, its tab lifting at the front */}
      <ellipse cx={cx} cy={top} rx={wTop / 2 + 4} ry={ry + 3} fill={`url(#${uid}-top)`} stroke={EDGE} strokeWidth="1.5" />
      <ellipse cx={cx} cy={top} rx={wTop / 2 - 6} ry={ry - 3} fill={PANEL} stroke={PANEL_EDGE} strokeWidth="1.2" />
      <path d={`M${cx + wTop * 0.18},${top + ry * 0.7}l${wTop * 0.1},${ry * 0.55}l${wTop * 0.12},${-ry * 0.2}l${-wTop * 0.06},${-ry * 0.5}Z`} fill="#E6E9F0" stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  )
}

/** A bag: a pillowed pouch with a crimped seal across the top. Its face is
 *  near flat, so its band and its words run straight. */
export function Bag({
  uid,
  name,
  x,
  y,
  w,
  h,
  band,
  children,
}: {
  uid: string
  name: string
  x: number
  y: number
  w: number
  h: number
  band?: { y: number; h: number }
  children?: React.ReactNode
}) {
  const { seal, body, crimps: crimp } = bagOutline(x, y, w, h)
  return (
    <g>
      <Shadows uid={uid} name={name} pack={{ kind: "bag", x, y, w, h }} />
      <Face uid={uid} name={name} d={body}>
        {band ? <FrontBand x={x - 20} y={band.y} w={w + 40} h={band.h} /> : null}
        {children}
        <path d={body} fill={`url(#${uid}-pouch)`} />
      </Face>
      <path d={body} fill="none" stroke={EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      {/* the seal, pressed flat and crimped */}
      <path d={`M${x + 4},${y}H${x + w - 4}V${y + seal}H${x + 4}Z`} fill="#F5F7FB" stroke={EDGE} strokeWidth="1.5" />
      <g stroke={INK} strokeOpacity="0.14" strokeWidth="2">
        {crimp.map((cx) => (
          <path key={cx} d={`M${cx},${y + 4}V${y + seal - 4}`} />
        ))}
      </g>
    </g>
  )
}

/** A shelf for packs to stand on (laid out by geometry.ts, `shelfLayout`):
 *  its top running back, its front edge, and its right end. */
export function Shelf({ uid, shelf }: { uid: string; shelf: ShelfSpec }) {
  const { x, y, w, d, lip } = shelf
  const dx = d * DX
  const dy = d * DY
  return (
    <g>
      <path d={`M${x},${y}H${x + w}L${x + w + dx},${y - dy}H${x + dx}Z`} fill={`url(#${uid}-shelf)`} />
      <path d={`M${x},${y}H${x + w}V${y + lip}H${x}Z`} fill="#DCE1EC" />
      <path d={`M${x + w},${y}L${x + w + dx},${y - dy}V${y - dy + lip}L${x + w},${y + lip}Z`} fill="#CBD2E1" />
      <path d={`M${x},${y + lip}V${y}L${x + dx},${y - dy}H${x + w + dx}V${y - dy + lip}L${x + w},${y + lip}Z`} fill="none" stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M${x},${y}H${x + w}`} stroke="#FFFFFF" strokeWidth="1.5" />
    </g>
  )
}
