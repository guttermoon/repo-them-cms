/**
 * Notion's text colours as this site's classes (`n-c-red`, `n-bg-red`, in
 * app/globals.css, where the contrast test checks each against the page in
 * both themes). One list for a page's blocks and for the words of a row, so
 * a colour looks the same wherever an editor uses it.
 *
 * No imports, so a client component and `npm test` load it as it is.
 */
const COLORS = new Set(["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"])

/**
 * Every colour class the site builds from Notion's data at runtime: a text
 * colour and a highlight (`n-c-red`, `n-bg-red`), a select option's pill
 * (`n-tag-red`, and `n-tag-default`), and Notion's light grey for an icon.
 * Tailwind keeps only the classes it finds written in the code, and a class
 * made from a row's colour is never written, so tailwind.config.ts keeps
 * these by name (its `safelist`). tests/notion-colors.test.mjs builds the
 * stylesheet and finds each.
 */
export const NOTION_COLOR_CLASSES: readonly string[] = [
  ...[...COLORS].flatMap((c) => [`n-c-${c}`, `n-bg-${c}`, `n-tag-${c}`]),
  "n-tag-default",
  "n-c-lightgray",
]

/** Notion's colour name ("red", "red_background") as this site's class, or
 *  "" for the default and anything unknown. */
export function colorClass(color: string | undefined): string {
  if (!color || color === "default") return ""
  if (color.endsWith("_background")) {
    const base = color.slice(0, -"_background".length)
    return COLORS.has(base) ? `n-bg-${base}` : ""
  }
  return COLORS.has(color) ? `n-c-${color}` : ""
}

/** The class a coloured run of words takes: a background colour gets a
 *  little room round the words, as Notion draws it. */
export const colorRunClass = (cls: string): string => (cls.startsWith("n-bg") ? `${cls} rounded-text px-[2px]` : cls)
