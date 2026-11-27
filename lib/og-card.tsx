import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

import { MARK_BRAND, MARK_R_PATH, MARK_RIM, MARK_TINT, MARK_VIEWBOX } from "./brand/mark"
import { OG_SIZE } from "./seo"
import type { OgWords } from "./og-words"
import { SITE_HOST } from "./site"

/**
 * A share card in the house style: the generic label, drawn on demand by
 * next/og (Satori) from the site's own files (the fonts in assets/fonts:
 * Satori reads WOFF, not WOFF2; the box in assets/og, drawn by
 * `npm run demo-images`), so a card is the same wherever it is drawn.
 * One thing is fetched, by next/og itself and from the server alone: a
 * character the bundled faces lack (another script, an emoji) is drawn from
 * Google Fonts or the Twemoji set on jsDelivr, which are sent those
 * characters of the card and nothing else. No reader's browser or address
 * is part of it, and next/og offers no way to turn it off.
 *
 * - The home page's card, the one a shared site shows, is a poster: the
 *   site's name in lowercase, as the label letters everything, as large as
 *   its room allows, its descriptor, and the
 *   "web site" box, with the band carried from the card's edge onto the box.
 *   No other words.
 * - Every other page's is the label: the mark and the name at the top, the
 *   page's title in lowercase Roboto Slab, the band, the small print at the
 *   foot, and the box standing on the band where a short title leaves room.
 */
type Face = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }
let fonts: Promise<Face[]> | null = null

function loadFonts(): Promise<Face[]> {
  const dir = path.join(process.cwd(), "assets", "fonts")
  const face = (file: string, name: string, weight: Face["weight"]) =>
    readFile(path.join(dir, file)).then((data) => ({ name, data, weight, style: "normal" as const }))
  fonts ??= Promise.all([
    face("roboto-slab-latin-700-normal.woff", "Roboto Slab", 700),
    face("inter-latin-400-normal.woff", "Inter", 400),
    face("inter-latin-600-normal.woff", "Inter", 600),
  ])
  return fonts
}

/** The box's picture, and where its parts are in it (in its own pixels):
 *  its band on the front, the foot of the front, and the front's left edge. */
export const BOX = { width: 1040, height: 958, band: { top: 640, bottom: 720 }, foot: 874, left: 62 }
let box: Promise<string> | null = null
/** As a data address, which is how Satori takes a picture. */
function loadBox(): Promise<string> {
  box ??= readFile(path.join(process.cwd(), "assets", "og", "box.png")).then((data) => `data:image/png;base64,${data.toString("base64")}`)
  return box
}

/** Fit the title: shorter titles are set bigger. */
export function titleSize(title: string): number {
  const n = title.length
  if (n <= 12) return 150
  if (n <= 24) return 112
  if (n <= 44) return 84
  if (n <= 70) return 64
  return 52
}

/** A title this short leaves the foot of the card's right half free, and
 *  the box stands there. */
export const BOX_FITS = 44

/** The poster: the box on the right at this width, and the name's room to
 *  its left, above the band. */
export const POSTER = { boxWidth: 560, boxLeft: 608, boxTop: 70, nameWidth: 548, nameHeight: 350 }
/** A lowercase letter of Roboto Slab bold is about this much of its size
 *  wide (an m is nearer the whole of it). */
const CAP = 0.68
const LEADING = 0.94

/** The site's name for the poster: on two lines when it has two words or
 *  more (as near equal as they go), set as large as its room allows. */
export function posterName(name: string): { lines: string[]; size: number } {
  const words = name.trim().split(/\s+/).filter(Boolean)
  let lines = [words.join(" ")]
  if (words.length > 1) {
    let best = Infinity
    for (let cut = 1; cut < words.length; cut++) {
      const pair = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")]
      const longest = Math.max(pair[0].length, pair[1].length)
      if (longest < best) [best, lines] = [longest, pair]
    }
  }
  const longest = Math.max(1, ...lines.map((line) => line.length))
  const size = Math.floor(Math.min(POSTER.nameWidth / (longest * CAP), POSTER.nameHeight / (lines.length * LEADING)))
  return { lines, size }
}

const INK = "#37352F"
const SUB = "#6B6A66"
const PAD = 64

function Head({ name, descriptor }: { name: string; descriptor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: `48px ${PAD}px 0` }}>
      <svg width="76" height="76" viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
        <rect x={MARK_RIM.x} y={MARK_RIM.y} width={MARK_RIM.size} height={MARK_RIM.size} rx={MARK_RIM.radius} fill={MARK_TINT} stroke={MARK_BRAND} strokeWidth={MARK_RIM.stroke} />
        <path d={MARK_R_PATH} fill={MARK_BRAND} />
      </svg>
      <div style={{ display: "flex", fontFamily: "Roboto Slab", fontSize: 44, fontWeight: 700, color: MARK_BRAND, textTransform: "lowercase", letterSpacing: -0.5 }}>{name}</div>
      <div style={{ display: "flex", fontSize: 26, color: SUB, marginLeft: 4 }}>{descriptor}</div>
    </div>
  )
}

const slab = (size: number) =>
  ({ fontFamily: "Roboto Slab", fontSize: size, fontWeight: 700, lineHeight: 0.96, letterSpacing: -size * 0.028, color: MARK_BRAND, textTransform: "lowercase" }) as const

const picture = (src: string, width: number) => {
  const height = Math.round((width * BOX.height) / BOX.width)
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- Satori draws this into the card; nothing reads it
  return <img src={src} width={width} height={height} style={{ width, height }} />
}

function Band({ width }: { width?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: width ?? "100%" }}>
      <div style={{ display: "flex", height: 7, background: MARK_BRAND }} />
      <div style={{ display: "flex", height: 26, background: MARK_TINT }} />
      <div style={{ display: "flex", height: 7, background: MARK_BRAND }} />
    </div>
  )
}

/** The home page's card. Everything is placed from the box: the band meets
 *  the box's own, the name fills the room above it, the descriptor sits
 *  under it. */
function Poster({ name, descriptor, src }: { name: string; descriptor: string; src: string }) {
  const scale = POSTER.boxWidth / BOX.width
  const bandTop = Math.round(POSTER.boxTop + BOX.band.top * scale)
  const bandHeight = Math.round((BOX.band.bottom - BOX.band.top) * scale)
  const { lines, size } = posterName(name)
  const edge = Math.round(bandHeight * 0.17)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#ffffff", fontFamily: "Inter" }}>
      {/* the band, from the card's edge to behind the box, where the box's own takes over */}
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, top: bandTop, width: POSTER.boxLeft + POSTER.boxWidth / 2 }}>
        <div style={{ display: "flex", height: edge, background: MARK_BRAND }} />
        <div style={{ display: "flex", height: bandHeight - 2 * edge, background: MARK_TINT }} />
        <div style={{ display: "flex", height: edge, background: MARK_BRAND }} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "absolute",
          left: PAD,
          top: 0,
          width: POSTER.nameWidth + 40,
          height: bandTop - 20,
          fontFamily: "Roboto Slab",
          fontWeight: 700,
          fontSize: size,
          lineHeight: LEADING,
          letterSpacing: -size * 0.02,
          color: MARK_BRAND,
          textTransform: "lowercase",
        }}
      >
        {lines.map((line) => (
          <div key={line} style={{ display: "flex" }}>
            {line}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", position: "absolute", left: PAD, top: bandTop + bandHeight + 34, width: POSTER.nameWidth, fontSize: 46, fontWeight: 600, lineHeight: 1.12, letterSpacing: -0.8, color: MARK_BRAND }}>
        {descriptor}
      </div>
      <div style={{ display: "flex", position: "absolute", left: POSTER.boxLeft, top: POSTER.boxTop }}>{picture(src, POSTER.boxWidth)}</div>
    </div>
  )
}

export async function ogCard({ title, label, name, descriptor, front }: OgWords): Promise<ImageResponse> {
  const words = title.length > 110 ? `${title.slice(0, 107)}...` : title
  const src = await loadBox()
  // the box beside a title: its foot on the band
  const beside = 250
  const card = front ? (
    <Poster name={name} descriptor={descriptor} src={src} />
  ) : (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Inter" }}>
      <Head name={name} descriptor={descriptor} />
      {words.length <= BOX_FITS ? (
        <div style={{ flex: 1, display: "flex", position: "relative", padding: `44px ${PAD}px 0`, ...slab(titleSize(words)) }}>
          {words}
          <div style={{ display: "flex", position: "absolute", right: PAD - 30, bottom: -Math.round(((BOX.height - BOX.foot) * beside) / BOX.width) }}>{picture(src, beside)}</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: `0 ${PAD}px`, ...slab(titleSize(words)) }}>{words}</div>
      )}
      <Band />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `22px ${PAD}px 30px` }}>
        <span style={{ fontFamily: "Roboto Slab", fontSize: 30, fontWeight: 700, color: MARK_BRAND, textTransform: "lowercase" }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 600, color: INK }}>{SITE_HOST}</span>
      </div>
    </div>
  )
  return new ImageResponse(card, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  })
}
