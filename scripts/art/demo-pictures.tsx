import type React from "react"

import { Bag, BRAND, Box, Can, Cup, FrontBand, fitSize, MONO, PackDefs, SANS, SLAB } from "../../components/illustrations/packs"
import { bounds, grow, viewBoxOf, type BoxSpec } from "../../components/illustrations/geometry"
import { BoxWords, STILL_LIFE_WORDS } from "../../components/illustrations/still-life"
import { BOX, COFFEE, DRINK, FLOOR, FOOD, NOODLES, SHRIMP, SIZE } from "./shots"

/**
 * The starter content's pictures (public/demo), drawn with the same packs as
 * the site's own illustrations: the shop's packshots, the team's portraits
 * (each person a pack, not a face) and the posts' covers. The words here are
 * the pictures' own, not slots: a picture's words are pixels once drawn.
 *
 * scripts/build-demo-images.mjs renders each at twice its size, so a
 * picture is never drawn larger than its pixels on a retina screen
 * (npm run sharpness checks). Where each pack stands is in ./shots, where
 * tests/packs.test.mjs checks every shadow stays inside its picture.
 *
 * The words on a can or a cup wrap round it: each is set at the middle, its
 * height taken at the front, a band's front being its side's height plus the
 * lid's ellipse.
 */

/** `out`: where it is written, when not public/demo. `clear`: no ground
 *  behind it, for a picture laid over something else. */
export type Picture = { file: string; width: number; height: number; element: React.ReactElement; out?: string; clear?: boolean }

/**
 * The share card's box (lib/og-card.tsx): the template's "web site" box on
 * its own, with no name on it, since the card sets the site's own name
 * beside it. Lettered as the still life on /features letters it.
 */
const CARD_BOX: BoxSpec = { kind: "box", x: 0, y: 0, w: 290, h: 360, d: 110 }
const cardBoxView = grow(bounds(CARD_BOX), 4)
/** Drawn this wide, and so twice it in pixels. */
const CARD_BOX_WIDTH = 520
const cardBoxHeight = Math.round((CARD_BOX_WIDTH * (cardBoxView.bottom - cardBoxView.top)) / (cardBoxView.right - cardBoxView.left))

function CardBox() {
  const { x, y, w, h, d } = CARD_BOX
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBoxOf(cardBoxView)}>
      <PackDefs uid="card" />
      <Box uid="card" name="box" x={x} y={y} w={w} h={h} d={d} band={{ y: y + 254, h: 36 }}>
        <BoxWords x={x} y={y} w={w} words={STILL_LIFE_WORDS} />
      </Box>
    </svg>
  )
}

const INK = "#37352F"

/** A packshot's studio: a pale wall, a pool of light on the floor. */
function Studio({ uid, children }: { uid: string; children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
      <PackDefs uid={uid} />
      <defs>
        <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8F9FD" />
          <stop offset="0.78" stopColor="#EEF1F8" />
          <stop offset="1" stopColor="#E7EBF5" />
        </linearGradient>
        <radialGradient id={`${uid}-pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={SIZE} height={SIZE} fill={`url(#${uid}-wall)`} />
      <ellipse cx={SIZE / 2} cy={FLOOR + 10} rx={540} ry={120} fill={`url(#${uid}-pool)`} />
      {children}
    </svg>
  )
}

/** A tall box with a line on top, a word or two, the band and the small print. */
function TallBox({ uid, top, words, note }: { uid: string; top: string; words: string[]; note: string }) {
  const { x, y, w, h, d } = BOX
  const pad = 46
  const bandY = y + h - 196
  // as large as fits across the front, and down between the top line and the band
  const down = Math.floor((bandY - 40 - (y + 110)) / (0.92 * words.length + 0.24))
  const size = Math.min(down, ...words.map((word) => fitSize(word, w - pad * 2, 168)))
  return (
    <Studio uid={uid}>
      <Box uid={uid} name="box" x={x} y={y} w={w} h={h} d={d} band={{ y: bandY, h: 72 }}>
        <text x={x + pad} y={y + 74} fill={BRAND} style={SLAB} fontSize="34">
          {top}
        </text>
        {words.map((word, n) => (
          <text key={word} x={x + pad - 4} y={y + 110 + size * 0.92 * (n + 1)} fill={BRAND} style={{ ...SLAB, letterSpacing: `-${size * 0.03}px` }} fontSize={size}>
            {word}
          </text>
        ))}
        {/* the small print, a line for each part */}
        {note.split(" · ").map((part, n, all) => (
          <text key={part} x={x + pad} y={y + h - 62 - (all.length - 1 - n) * 30} fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="20">
            {part.toUpperCase()}
          </text>
        ))}
      </Box>
    </Studio>
  )
}

/** Nutrition facts, as a pack's back carries them: drawn 430 wide and
 *  scaled to the width given, so a narrow can holds the same panel. */
function Facts({ x, y, w, title, rows }: { x: number; y: number; w: number; title: string; rows: [string, string][] }) {
  const line = 46
  const width = 430
  return (
    <g transform={`translate(${x} ${y}) scale(${w / width})`} style={SANS} fill={INK}>
      <rect width={width} height={150 + rows.length * line} fill="#FFFFFF" stroke={INK} strokeWidth="5" />
      <text x="22" y="58" fontSize="44" fontWeight="600" letterSpacing="-1">
        NUTRITION FACTS
      </text>
      <text x="22" y="96" fontSize="22">
        {title}
      </text>
      <rect x="22" y="112" width={width - 44} height="12" fill={INK} />
      {rows.map(([k, v], n) => (
        <g key={k}>
          <text x="22" y={162 + n * line} fontSize="24">
            {k}
          </text>
          <text x={width - 22} y={162 + n * line} fontSize="24" fontWeight="600" textAnchor="end">
            {v}
          </text>
          <rect x="22" y={176 + n * line} width={width - 44} height="1.5" fill={INK} />
        </g>
      ))}
    </g>
  )
}

function BoxBack({ uid, title, rows }: { uid: string; title: string; rows: [string, string][] }) {
  const { x, y, w, h, d } = BOX
  return (
    <Studio uid={uid}>
      <Box uid={uid} name="box" x={x} y={y} w={w} h={h} d={d} band={{ y: y + h - 120, h: 60 }}>
        <Facts x={x + 44} y={y + 54} w={w - 88} title={title} rows={rows} />
      </Box>
    </Studio>
  )
}

function DrinkCan({ uid, back }: { uid: string; back?: boolean }) {
  const { x, top, w, h, ry } = DRINK
  const cx = x + w / 2
  return (
    <Studio uid={uid}>
      <Can uid={uid} name="can" x={x} top={top} w={w} h={h} ry={ry} pull bands={back ? [{ y: top + 560, h: 44 }] : [{ y: top + 300, h: 60 }, { y: top + 384, h: 60 }]}>
        {back ? (
          <Facts x={x + 34} y={top + 96} w={w - 68} title="Serving size: 1 can" rows={[["Drink", "100%"], ["Flavour", "generic"], ["Fizz", "some"], ["Trackers", "0"]]} />
        ) : (
          <>
            <text x={cx} y={top + 300 + ry - 44} textAnchor="middle" fill={BRAND} style={{ ...SLAB, letterSpacing: "-3px" }} fontSize={fitSize("drink", w - 30, 118)}>
              drink
            </text>
            <text x={cx} y={top + 384 + 60 + ry + 66} textAnchor="middle" fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="20">
              12 FL OZ
            </text>
            <text x={cx} y={top + 384 + 60 + ry + 98} textAnchor="middle" fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="20">
              CONTAINS DRINK
            </text>
          </>
        )}
      </Can>
    </Studio>
  )
}

function FoodTin({ uid }: { uid: string }) {
  const { x, top, w, h, ry } = FOOD
  const cx = x + w / 2
  const band = { y: top + 250, h: 56 }
  return (
    <Studio uid={uid}>
      <Can uid={uid} name="tin" x={x} top={top} w={w} h={h} ry={ry} ribs bands={[band]}>
        <text x={cx} y={band.y + ry - 40} textAnchor="middle" fill={BRAND} style={{ ...SLAB, letterSpacing: "-4px" }} fontSize="140">
          food
        </text>
        <text x={cx} y={band.y + band.h + ry + 44} textAnchor="middle" fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="22">
          HEAT AND SERVE
        </text>
      </Can>
    </Studio>
  )
}

function ShrimpTin({ uid }: { uid: string }) {
  const { x, top, w, h, ry } = SHRIMP
  const cx = x + w / 2
  const band = { y: top + 196, h: 46 }
  const front = band.y + ry
  return (
    <Studio uid={uid}>
      <Can uid={uid} name="tin" x={x} top={top} w={w} h={h} ry={ry} pull bands={[band]}>
        <text x={cx} y={front - 130} textAnchor="middle" fill={BRAND} style={SLAB} fontSize="28">
          cooked and peeled
        </text>
        <text x={cx} y={front - 32} textAnchor="middle" fill={BRAND} style={{ ...SLAB, letterSpacing: "-3px" }} fontSize="104">
          shrimp
        </text>
        <text x={cx} y={front + band.h / 2 + 7} textAnchor="middle" fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="19">
          NET WT 4 OZ
        </text>
      </Can>
    </Studio>
  )
}

function NoodleCup({ uid }: { uid: string }) {
  const { cx, top, wTop, wBottom, h, ry } = NOODLES
  // each line wraps at its own height: `at` is the middle of its letters, at the front
  const line = (y: number, size: number, style: React.CSSProperties, text: string) => ({
    at: y - size * 0.36,
    label: (
      <text x={cx} y={y} textAnchor="middle" fill={BRAND} style={style} fontSize={size}>
        {text}
      </text>
    ),
  })
  return (
    <Studio uid={uid}>
      <Cup
        uid={uid}
        name="cup"
        cx={cx}
        top={top}
        wTop={wTop}
        wBottom={wBottom}
        h={h}
        ry={ry}
        band={{ y: top + 300, h: 56 }}
        lines={[
          line(top + 156, 32, SLAB, "instant"),
          line(top + 284, 112, { ...SLAB, letterSpacing: "-4px" }, "noodles"),
          line(top + 444, 19, { ...MONO, letterSpacing: "2px" }, "ADD WATER · WAIT 3 MIN"),
        ]}
      />
    </Studio>
  )
}

function CoffeeBag({ uid }: { uid: string }) {
  const { x, y, w, h } = COFFEE
  return (
    <Studio uid={uid}>
      <Bag uid={uid} name="bag" x={x} y={y} w={w} h={h} band={{ y: y + 470, h: 68 }}>
        <text x={x + 44} y={y + 140} fill={BRAND} style={SLAB} fontSize="30">
          ground, medium roast
        </text>
        <text x={x + 40} y={y + 300} fill={BRAND} style={{ ...SLAB, letterSpacing: "-4px" }} fontSize={fitSize("coffee", w - 84, 132)}>
          coffee
        </text>
        <text x={x + 46} y={y + 610} fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="20">
          NET WT 8 OZ
        </text>
        <text x={x + 46} y={y + 640} fill={BRAND} style={{ ...MONO, letterSpacing: "2px" }} fontSize="20">
          HOT WHEN MADE
        </text>
      </Bag>
    </Studio>
  )
}

/** A post's cover: Notion shows a cover cropped to a wide band (the page's
 *  full width, 30vh tall), so the word, the band and the note sit in the
 *  middle 220 of its 600, which a crop keeps on screens up to 1920 wide. */
function Cover({ word, note }: { word: string; note: string }) {
  const w = 1500
  const h = 600
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <rect width={w} height={h} fill="#FFFFFF" />
      <FrontBand x={0} y={322} w={w} h={34} />
      <text x={w / 2} y="300" textAnchor="middle" fill={BRAND} style={{ ...SLAB, letterSpacing: "-5px" }} fontSize={fitSize(word, 860, 170, 0.56)}>
        {word}
      </text>
      <text x={w / 2} y="392" textAnchor="middle" fill={BRAND} style={{ ...MONO, letterSpacing: "3px" }} fontSize="20">
        {note.toUpperCase()}
      </text>
    </svg>
  )
}

const portrait = (file: string, role: string, note: string): Picture => ({
  file,
  width: SIZE,
  height: SIZE,
  element: <TallBox uid="p" top={role} words={["one", "person"]} note={note} />,
})

export const PICTURES: Picture[] = [
  { file: "product-corn-flakes.webp", width: SIZE, height: SIZE, element: <TallBox uid="p" top="toasted corn cereal" words={["corn", "flakes"]} note="net wt 12 oz · keep dry" /> },
  {
    file: "product-corn-flakes-back.webp",
    width: SIZE,
    height: SIZE,
    element: <BoxBack uid="p" title="Serving size: 1 bowl" rows={[["Corn", "mostly"], ["Flakes", "many"], ["Milk", "not included"], ["Trackers", "0"]]} />,
  },
  { file: "product-shrimp.webp", width: SIZE, height: SIZE, element: <ShrimpTin uid="p" /> },
  { file: "product-instant-noodles.webp", width: SIZE, height: SIZE, element: <NoodleCup uid="p" /> },
  { file: "product-drink.webp", width: SIZE, height: SIZE, element: <DrinkCan uid="p" /> },
  { file: "product-drink-back.webp", width: SIZE, height: SIZE, element: <DrinkCan uid="p" back /> },
  { file: "product-food.webp", width: SIZE, height: SIZE, element: <FoodTin uid="p" /> },
  { file: "product-coffee.webp", width: SIZE, height: SIZE, element: <CoffeeBag uid="p" /> },
  portrait("person-founder.webp", "founder", "net wt 1 person · still answers the email"),
  portrait("person-product.webp", "product", "net wt 1 person · mostly says no"),
  portrait("person-design.webp", "design", "net wt 1 person · one colour only"),
  portrait("person-support.webp", "support", "net wt 1 person · replies in sentences"),
  { file: "cover-introducing.png", width: 1500, height: 600, element: <Cover word="generic" note="introducing · nothing to hide" /> },
  { file: "cover-questions.png", width: 1500, height: 600, element: <Cover word="5 questions" note="a guide · before you buy anything" /> },
  { file: "cover-release.png", width: 1500, height: 600, element: <Cover word="version 1" note="generic, finally" /> },
  { file: "sampler.png", width: 1500, height: 600, element: <Cover word="picture" note="served from this site · not from notion" /> },
  { file: "box.png", out: "assets/og", clear: true, width: CARD_BOX_WIDTH, height: cardBoxHeight, element: <CardBox /> },
]
