import { NOTION_COLOR_CLASSES } from "./lib/notion-colors"
import type { Config } from "tailwindcss"

/**
 * REPO THEM's design tokens.
 *
 * Two vocabularies, kept apart on purpose:
 * - the generic label: a white ground, lowercase slab titles, and two blues,
 *   the dark `brand` and the pale `tint` (the band round the tin, the mark,
 *   the main button);
 * - Notion's content style: its text colour, greys, hairlines and the nine
 *   colours an editor can give text, backgrounds and tags (CSS variables in
 *   app/globals.css, named `--n-*`).
 *
 * Black is primary, as Notion's is: `ink` for the words and `strong` for
 * eyebrows, links and the secondary button (white on a dark page). The blue
 * is the accent: `heading`, `btn` and `cta` for titles and the main buttons,
 * `accent` for focus rings and small marks (dark on white, lighter on
 * dark), and `panel` the pale blue, used lightly. Notion's nine colours
 * belong to the content: they appear when an editor uses them, not as
 * decoration.
 */
const config: Config = {
  // the four looks (light, dark, mono, rainbow) are CSS variables
  // (app/globals.css) swapped by data-theme on <html>; `dark:` is there for
  // the few things that are not colours and that only a dark ground changes
  // (the badge, which Notion supplies in black and in white)
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  // classes made from a row's colour are never written in the code, so
  // Tailwind would drop them: a red tag drew plain (lib/notion-colors.ts)
  safelist: [...NOTION_COLOR_CLASSES],
  theme: {
    // The whole scale, not an extension of Tailwind's: a corner is a pill,
    // or one of four sizes, and nothing between (docs/design.md, "Shape";
    // the sizes are --r-* in app/globals.css). Tailwind's own names
    // (rounded, rounded-md, rounded-lg) draw nothing here, and
    // tests/shapes.test.mjs fails on them and on any rounded-[…].
    borderRadius: {
      none: "0",
      // a mark on words: inline code, a highlight, a checkbox
      text: "var(--r-text)",
      // a row in a column, or a small thing inside a card: a menu's option,
      // a thumbnail, a Notion block in a page
      block: "var(--r-block)",
      // a thing standing on its own in a grid or a list
      card: "var(--r-card)",
      // a ground the width of a section, and what covers the page
      panel: "var(--r-panel)",
      // a thing you press or type in that hugs its words
      full: "9999px",
    },
    extend: {
      colors: {
        // the page, and Notion's default text on it
        page: "rgb(var(--c-page) / <alpha-value>)",
        // what a thing sits on: the page, or the panel or card round it
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        // secondary text, darkened from Notion's grey until small type reads at 7:1 (AAA)
        sub: "rgb(var(--c-sub) / <alpha-value>)",
        // fills and hairlines, as Notion draws them
        wash: "rgb(var(--c-wash) / <alpha-value>)",
        well: "rgb(var(--c-well) / <alpha-value>)",
        card: "rgb(var(--c-card) / <alpha-value>)",
        line: "var(--c-line)",
        "line-strong": "var(--c-line-strong)",
        // the label's two colours (the band, the mark): the blues in light,
        // the glow in dark; mono and rainbow set their own
        brand: "rgb(var(--c-brand) / <alpha-value>)",
        tint: "rgb(var(--c-tint) / <alpha-value>)",
        // what the blues do in the current theme (app/globals.css)
        strong: "rgb(var(--c-strong) / <alpha-value>)",
        heading: "rgb(var(--c-heading) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        // the scanner's light: decoration, never text
        scan: "rgb(var(--c-scan) / <alpha-value>)",
        btn: { DEFAULT: "rgb(var(--c-btn) / <alpha-value>)", hover: "rgb(var(--c-btn-hover) / <alpha-value>)", ink: "rgb(var(--c-btn-ink) / <alpha-value>)" },
        cta: { DEFAULT: "rgb(var(--c-cta) / <alpha-value>)", hover: "rgb(var(--c-cta-hover) / <alpha-value>)", ink: "rgb(var(--c-cta-ink) / <alpha-value>)" },
        panel: { DEFAULT: "rgb(var(--c-panel) / <alpha-value>)", strong: "rgb(var(--c-panel-strong) / <alpha-value>)" },
      },
      fontFamily: {
        slab: ["var(--font-slab)", "Rockwell", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "ui-serif", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      // The type scale: ten sizes, each a kind of words, and four that grow
      // with the window for the titles that lead a page. Nothing is set in
      // a size typed into markup (tests/type-scale.test.mjs). A size sets
      // no leading: the words' own class does.
      fontSize: {
        micro: "11px", // labels in capitals, the small print
        fine: "13px", // captions, footnotes, tags
        small: "14px", // secondary lines, form labels
        ui: "15px", // buttons, the menus, a card's words
        body: "16px", // a paragraph
        lead: "18px", // a lede, an eyebrow
        "head-s": "22px", // a card's title
        "head-m": "28px", // a small section's title
        "head-l": "36px", // a section's title
        display: "56px", // a page's title where it does not grow
        "fluid-section": "clamp(28px, 4vw, 42px)",
        "fluid-title": "clamp(36px, 6vw, 64px)",
        "fluid-hero": "clamp(44px, 8vw, 88px)",
        "fluid-giant": "clamp(56px, 13vw, 148px)", // the 404's one word
      },
      maxWidth: {
        // Notion's page column, its full-width option, and the marketing grid
        page: "708px",
        wide: "1100px",
        site: "1240px",
        // the longest line running text may set: 80 characters (WCAG 1.4.8)
        measure: "80ch",
      },
      // every `transition` utility lets go at the site's one pace and on its
      // one curve (--t-out, --ease in app/globals.css)
      transitionDuration: { DEFAULT: "320ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)" },
      // the least a thing pressed may be, each way: 44 by 44 (WCAG 2.5.5),
      // whatever its words; a link inside a sentence is the one exception
      minHeight: { target: "44px" },
      minWidth: { target: "44px" },
      // the focus ring's one width (--focus-ring in app/globals.css), for a
      // control that draws its ring on a part of itself
      outlineWidth: { focus: "var(--focus-ring)" },
      boxShadow: {
        // Notion's popover and card shadows, per theme
        pop: "var(--shadow-pop)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
