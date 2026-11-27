import localFont from "next/font/local"

/**
 * The site's four faces, served from this site's own files
 * (assets/fonts, from Fontsource, with their licences beside them). Nothing
 * is fetched from Google or anyone else, at build time or in a reader's
 * browser: the files are committed, and next/font serves them from
 * /_next/static/media. tests/third-parties.test.mjs fails on a
 * `next/font/google` import or a Google Fonts address anywhere.
 *
 * - Roboto Slab 700: titles, eyebrows and the wordmark (the generic label)
 * - Inter: the body and everything else (Notion's default page style)
 * - Source Serif 4 and IBM Plex Mono: Notion's Serif and Mono page styles,
 *   and code
 *
 * Each face comes in two halves, Latin and Latin Extended, each with the
 * unicode-range Fontsource gives it, so the extended file is downloaded
 * only by a page that has a character in it (a name like Łódź or Dvořák).
 * The two are chained in app/globals.css (`--font-sans` and the rest). The
 * Latin half has no fallback face of its own: a metric-matched fallback
 * covers every character, so it would stop the chain before the extended
 * half was reached. The extended half carries it instead.
 *
 * next/font needs every option written out where it is called, so the
 * repetition below is required, not an oversight.
 */
// The two ranges, as Fontsource gives them (next/font accepts only literals,
// so each call repeats its range):
//   Latin:          U+0000-00FF and the punctuation, € and ™ around it
//   Latin Extended: U+0100-02BA and the rest of Europe's accented letters

export const slabLatin = localFont({
  src: [{ path: "../assets/fonts/roboto-slab-latin-700-normal.woff2", weight: "700", style: "normal" }],
  variable: "--font-slab-latin",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
})
export const slabExt = localFont({
  src: [{ path: "../assets/fonts/roboto-slab-latin-ext-700-normal.woff2", weight: "700", style: "normal" }],
  variable: "--font-slab-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" }],
})

export const sansLatin = localFont({
  src: [
    { path: "../assets/fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/inter-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../assets/fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans-latin",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
})
export const sansExt = localFont({
  src: [
    { path: "../assets/fonts/inter-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/inter-latin-ext-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../assets/fonts/inter-latin-ext-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/inter-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" }],
})

export const serifLatin = localFont({
  src: [
    { path: "../assets/fonts/source-serif-4-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/source-serif-4-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../assets/fonts/source-serif-4-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif-latin",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
})
export const serifExt = localFont({
  src: [
    { path: "../assets/fonts/source-serif-4-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/source-serif-4-latin-ext-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../assets/fonts/source-serif-4-latin-ext-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" }],
})

export const monoLatin = localFont({
  src: [
    { path: "../assets/fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono-latin",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
})
export const monoExt = localFont({
  src: [
    { path: "../assets/fonts/ibm-plex-mono-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/ibm-plex-mono-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" }],
})

/** Every face's variables, for <html>'s className. */
export const FONT_VARIABLES = [slabLatin, slabExt, sansLatin, sansExt, serifLatin, serifExt, monoLatin, monoExt]
  .map((font) => font.variable)
  .join(" ")
