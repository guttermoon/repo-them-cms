import { viewBoxOf } from "./geometry"
import { ABOUT_PACK, ABOUT_VIEWBOX } from "./layouts"
import { Box, BRAND, fitSize, MONO, PackDefs, SLAB } from "./packs"

/**
 * One generic pack, in three dimensions: the white box, a lowercase word,
 * the band round it and a line or two of small print. The About page's
 * picture, drawn as SVG (components/illustrations/packs) in the site's own
 * lettering, so it costs no request and is sharp at any size. The picture is
 * just large enough for the box and its shadow (./layouts). The words come
 * in as props (slots, from the page).
 */
export function Pack({ top, word, lines, label, className = "" }: { top: string; word: string; lines: string[]; label: string; className?: string }) {
  const uid = "about-pack"
  const { x, y, w, h, d } = ABOUT_PACK
  return (
    <svg viewBox={viewBoxOf(ABOUT_VIEWBOX)} role="img" aria-label={label} className={`h-auto w-full ${className}`.trim()}>
      <PackDefs uid={uid} />
      <Box uid={uid} name="box" x={x} y={y} w={w} h={h} d={d} band={{ y: y + 256, h: 40 }}>
        <text x={x + 24} y={y + 48} fill={BRAND} style={SLAB} fontSize="22">
          {top}
        </text>
        {/* the word is an editor's: sized to fit between the box's edges */}
        <text x={x + 20} y={y + 172} fill={BRAND} style={{ ...SLAB, letterSpacing: "-2px" }} fontSize={fitSize(word, w - 48, 76)}>
          {word}
        </text>
        {lines.map((line, n) => (
          <text key={n} x={x + 24} y={y + 340 + n * 24} fill={BRAND} style={MONO} fontSize="14">
            {line}
          </text>
        ))}
      </Box>
    </svg>
  )
}
