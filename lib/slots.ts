/**
 * A Site Copy slot as words, for the places that need a string rather than
 * nodes: an attribute, a page's title, a feed, /llms.txt. `<T>`
 * (components/system/notion-text.tsx) is the same slot as nodes, and
 * re-exports these so a component imports both from one place.
 */
import { recordCopyKey } from "./copy-dump"
import { safeHref } from "./inline-links"
import { inlineRuns, inlineWords } from "./inline-text"
import { sitePathFromHref } from "./notion/links"
import { SITE_DESCRIPTOR, SITE_NAME, SITE_NOUN, SITE_URL } from "./site"
import type { SiteCopy } from "./notion/rows"

/**
 * The copy map's mark that its rows are a connected Notion database's. With
 * it, only words in Notion show: a slot with no row shows nothing, as an
 * unticked one does, so no word reaches the site that its owner has not
 * seen in Notion (a slot a code update adds, a row trashed instead of
 * unticked, a Title mistyped). Without it, the starter site with no Notion
 * shows the words written into the code. The store marks what it reads
 * from Notion (lib/content/store.ts), and `pickCopy` carries the mark to the
 * browser. A control's own name (`plainText`) still falls back, so a field
 * or a button never loses the words that say what it does.
 */
export const FROM_NOTION = "\u0000notion"

/** Slots that never get a row, so `notion:seed-copy` leaves them out and
 *  `notion:check` does not ask for one: `demo.default` is /features' live
 *  example of a slot with no row. */
export const ROWLESS_SLOTS: readonly string[] = ["demo.default"]

/** Whether a copy map is a connected database's (see FROM_NOTION). */
export const fromNotion = (content: SiteCopy): boolean => content[FROM_NOTION] === "1"

/** A copy map marked as a connected database's (see FROM_NOTION). */
export const notionCopy = (copy: SiteCopy): SiteCopy => ({ ...copy, [FROM_NOTION]: "1" })

/**
 * One slot as a plain STRING rather than as nodes.
 *
 * For the places that cannot take an element: an `<option>`, an
 * `aria-label`, a `title`. `<T>` renders links, line breaks and Notion's
 * formatting as real nodes, and an `<a>` inside an `<option>` is invalid HTML
 * that browsers quietly throw away.
 *
 * It differs from `<T>` in two ways, and deliberately. A Published row with
 * EMPTY text falls back to the default here rather than rendering nothing: a
 * hidden paragraph is an editor making a slot optional; a hidden `<option>`
 * is a control with a blank line in it, which is a fault rather than a choice.
 * And a link in the row is kept as its words: an attribute cannot hold one,
 * and Notion makes a link of an address it recognises (you@example.com) on
 * its own, so a placeholder would otherwise read "[you@example.com](mailto:…)".
 *
 * It records the key for `npm run copy`, as `<T>` does, so an attribute's
 * slot gets its Notion row too.
 */
export function plainText(content: SiteCopy, k: string, fallback: string): string {
  recordCopyKey(k, fallback)
  const v = content[k]
  if (v == null) return fallback
  // a link as its words, formatting dropped (lib/inline-text.ts)
  const words = inlineWords(v)
  return words.trim() === "" ? fallback : words
}

/**
 * One slot as the reader sees it, as a plain string, for words that are not
 * a control's name (a line of /llms.txt, structured data): the row's words,
 * and nothing when the row hides the slot, as `<T>` hides it. With no row,
 * the default on the starter site, and nothing once Notion is connected
 * (FROM_NOTION). A link is reduced to its words, formatting to the words
 * it formats (lib/inline-text.ts), a line break to a space.
 */
export function slotText(content: SiteCopy, k: string, fallback: string): string {
  recordCopyKey(k, fallback)
  const v = content[k]
  return (v == null ? (fromNotion(content) ? "" : fallback) : inlineWords(v)).replace(/\s*\n\s*/g, " ").trim()
}

/**
 * Whether a slot's words are hidden: its row unticked or published blank,
 * or, once Notion is connected, no row at all (FROM_NOTION). Whatever is
 * drawn only to go with those words (an icon beside a heading) goes too, so
 * a missing row never leaves a lone icon standing for a title.
 */
export function slotHidden(content: SiteCopy, k: string): boolean {
  const v = content[k]
  return v == null ? fromNotion(content) : v.trim() === ""
}

/**
 * A slot's words with `{name}` blanks filled in from code: for words round a
 * value only code knows (a count, a tag's name, a video's provider), so the
 * row can still be reworded around it. A blank with no value is left as it
 * was written.
 */
export function fillIn(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

/**
 * The site's name as a reader sees it, in the header, the footer, a page's
 * title and its share card: the `site.name` row, or the name in lib/site.ts.
 * A row left blank falls back, as a name must. Notion's brand rules keep
 * "Notion" out of a product's name (docs/brand.md).
 */
export const siteName = (content: SiteCopy): string => plainText(content, "site.name", SITE_NAME)

/** What the site is, said less prominently than its name: the `site.descriptor` row. */
export const siteDescriptor = (content: SiteCopy): string => plainText(content, "site.descriptor", SITE_DESCRIPTOR)

/** The noun on the label, what is in the box: the `site.noun` row. */
export const siteNoun = (content: SiteCopy): string => plainText(content, "site.noun", SITE_NOUN)

/**
 * Where a button goes, as its row says: the address of the first link in
 * the row's words, or `fallback` when there is none. So an editor repoints a
 * button from Notion by linking its words, and a copy's rows, which hold no
 * link, keep the code's address. A link to one of this site's pages becomes
 * its path (lib/notion/links.ts); one to anywhere unsafe is ignored. The
 * button draws its words with `<T words>`, so the link is never drawn twice.
 */
export function slotHref(content: SiteCopy, k: string, fallback: string): string {
  const v = content[k]
  const href = v ? inlineRuns(v).find((run) => run.href)?.href : undefined
  return (href && safeHref(sitePathFromHref(href, SITE_URL) ?? href)) || fallback
}
