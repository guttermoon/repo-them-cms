import type React from "react"

import { bounds, viewBoxOf, type PackSpec } from "./geometry"
import { STILL_LIFE } from "./layouts"
import { Bag, BRAND, Box, Can, Carton, fitSize, MONO, PackDefs, Shelf, SLAB } from "./packs"

/**
 * The template's picture on /features: a shelf of generic groceries, white
 * packs in three dimensions with a lowercase word and the band round them,
 * each one a part of the site. Drawn as SVG (components/illustrations/packs),
 * in the site's own lettering, so it is sharp at any size and costs no
 * request.
 *
 * The packs stand evenly spaced on a shelf as deep as they are, and the
 * picture holds every shadow (./layouts, ./geometry). The words on the packs
 * are the page's to give (`features.art.*` in Site Copy, these as the
 * built-in wording), and the box carries the site's own name.
 */
export const STILL_LIFE_WORDS = {
  web: "web",
  site: "site",
  weight: "NET WT 1 WEBSITE",
  keep: "KEEP IN A COOL DRY DATABASE",
  blog: "blog",
  feed: "POSTS · FEED",
  pages: "pages",
  write: "WRITE IN NOTION",
  tick: "TICK PUBLISHED",
  copy: "copy",
  row: "EVERY WORD A ROW",
  trackers: "CONTAINS NO TRACKERS",
}
export type StillLifeWords = Record<keyof typeof STILL_LIFE_WORDS, string>
/** A pack that can be picked up: it rises under the pointer (`data-pack`,
 *  app/globals.css). */
function Pick({ name, children }: { name: PackName; children: React.ReactNode }) {
  return <g data-pack={name}>{children}</g>
}
export type PackName = "box" | "can" | "carton" | "bag"
/** The packs in the shelf's order. */
const PACK_NAMES: PackName[] = ["box", "can", "carton", "bag"]

/** A pack's place in the picture, in hundredths of the picture's size. */
function hitBox(pack: PackSpec): React.CSSProperties {
  const view = STILL_LIFE.viewBox
  const box = bounds(pack)
  const pc = (n: number, of: number) => `${Math.round((n / of) * 1000) / 10}%`
  const [w, h] = [view.right - view.left, view.bottom - view.top]
  return { left: pc(box.left - view.left, w), top: pc(box.top - view.top, h), width: pc(box.right - box.left, w), height: pc(box.bottom - box.top, h) }
}

/**
 * The "web site" box's lettering, under the site's name: the two big words,
 * as large as both fit, and the small print. The share card's box
 * (scripts/art/demo-pictures.tsx) is lettered with this too, so the two
 * boxes never drift apart.
 */
export function BoxWords({ x, y, w, words }: { x: number; y: number; w: number; words: Pick<StillLifeWords, "web" | "site" | "weight" | "keep"> }) {
  const big = Math.min(fitSize(words.web, w - 50, 96), fitSize(words.site, w - 50, 96))
  return (
    <>
      <text x={x + 24} y={y + 146} fill={BRAND} style={{ ...SLAB, letterSpacing: "-2px" }} fontSize={big}>
        {words.web}
      </text>
      <text x={x + 24} y={y + 226} fill={BRAND} style={{ ...SLAB, letterSpacing: "-2px" }} fontSize={big}>
        {words.site}
      </text>
      <text x={x + 26} y={y + 320} fill={BRAND} style={MONO} fontSize="14">
        {words.weight}
      </text>
      <text x={x + 26} y={y + 342} fill={BRAND} style={MONO} fontSize="14">
        {words.keep}
      </text>
    </>
  )
}

/** `brand`: the site's name as the copy has it, lettered on the box.
 *  `links`: where pressing each pack goes. */
export function StillLife({
  label,
  words,
  brand,
  links,
  className = "",
}: {
  label: string
  words: StillLifeWords
  brand: string
  links?: Partial<Record<PackName, string>>
  className?: string
}) {
  const uid = "still"
  const [box, can, carton, bag] = STILL_LIFE.packs
  // the can's band at its sides, its front a lid's ellipse lower: the words
  // are set by the front and wrap round with the band
  const canBand = { y: can.top + 108, h: 30 }
  const canFront = canBand.y + can.ry
  const canMid = can.x + can.w / 2
  return (
    <div className="shelf-picture relative">
      <svg viewBox={viewBoxOf(STILL_LIFE.viewBox)} role="img" aria-label={label} className={`h-auto w-full ${className}`.trim()}>
        <PackDefs uid={uid} />
        <Shelf uid={uid} shelf={STILL_LIFE.shelf} />

        {/* a cereal box: "website" */}
        <Pick name="box">
          <Box uid={uid} name="box" x={box.x} y={box.y} w={box.w} h={box.h} d={box.d} band={{ y: box.y + 254, h: 36 }}>
            <text x={box.x + 26} y={box.y + 46} fill={BRAND} style={SLAB} fontSize="22">
              {brand.toLowerCase()}
            </text>
            <BoxWords x={box.x} y={box.y} w={box.w} words={words} />
          </Box>
        </Pick>

        {/* a can: "blog", wrapped round it */}
        <Pick name="can">
          <Can uid={uid} name="can" x={can.x} top={can.top} w={can.w} h={can.h} ry={can.ry} bands={[canBand]}>
            <text x={canMid} y={canFront - 24} textAnchor="middle" fill={BRAND} style={{ ...SLAB, letterSpacing: "-1px" }} fontSize={fitSize(words.blog, 150, 62)}>
              {words.blog}
            </text>
            <text x={canMid} y={canFront + canBand.h + 24} textAnchor="middle" fill={BRAND} style={MONO} fontSize="13">
              {words.feed}
            </text>
          </Can>
        </Pick>

        {/* a carton: "pages" */}
        <Pick name="carton">
          <Carton uid={uid} name="carton" x={carton.x} y={carton.y} w={carton.w} h={carton.h} d={carton.d} gable={carton.gable} band={{ y: carton.y + 110, h: 26 }}>
            <text x={carton.x + 16} y={carton.y + 84} fill={BRAND} style={{ ...SLAB, letterSpacing: "-1px" }} fontSize={fitSize(words.pages, 114, 50)}>
              {words.pages}
            </text>
            <text x={carton.x + 16} y={carton.y + 174} fill={BRAND} style={MONO} fontSize="12">
              {words.write}
            </text>
            <text x={carton.x + 16} y={carton.y + 194} fill={BRAND} style={MONO} fontSize="12">
              {words.tick}
            </text>
          </Carton>
        </Pick>

        {/* a bag: "copy" */}
        <Pick name="bag">
          <Bag uid={uid} name="bag" x={bag.x} y={bag.y} w={bag.w} h={bag.h} band={{ y: bag.y + 140, h: 30 }}>
            <text x={bag.x + 24} y={bag.y + 116} fill={BRAND} style={{ ...SLAB, letterSpacing: "-2px" }} fontSize={fitSize(words.copy, 178, 84)}>
              {words.copy}
            </text>
            <text x={bag.x + 24} y={bag.y + 210} fill={BRAND} style={MONO} fontSize="13">
              {words.row}
            </text>
            <text x={bag.x + 24} y={bag.y + 232} fill={BRAND} style={MONO} fontSize="13">
              {words.trackers}
            </text>
          </Bag>
        </Pick>
      </svg>
      {/* where a pack is pressed: a link laid over it, for the pointer
          alone. The picture is one image to a screen reader, and the page
          gives the same ways in as ordinary links beside it. */}
      {links
        ? PACK_NAMES.map((name, n) =>
            links[name] ? <a key={name} href={links[name]} data-for={name} aria-hidden="true" tabIndex={-1} className="pack-hit absolute" style={hitBox(STILL_LIFE.packs[n])} /> : null,
          )
        : null}
    </div>
  )
}
