/**
 * The words of a blog category's or tag's page, and of its metadata and
 * share card, from Site Copy (`blog.category.*`, `blog.tag.*`).
 */
import type { SiteCopy } from "./notion/rows"
import { cutAtWord, SEARCH_LIMITS } from "./page-meta"
import { fillIn, plainText } from "./slots"

export type Kind = "Category" | "Tag"

/**
 * A description with `{titles}` filled in: as many of the titles as fit
 * the length a search result prints whole (`SEARCH_LIMITS`), newest first,
 * each in quotation marks, so every archive describes itself in its own
 * words rather than one sentence with a name swapped in. The first is kept
 * however long it is, cut at a word if it must be; with none, the sentence
 * ends where they would have begun. Wording without
 * `{titles}` (an owner's own row, say) is filled in and left as it is.
 */
export function fillTitles(text: string, values: Record<string, string | number>, titles: string[], max: number = SEARCH_LIMITS.description.max): string {
  if (!text.includes("{titles}")) return fillIn(text, values)
  // nothing to name: the sentence ends where the titles would have begun
  if (!titles.length) return fillIn(text.replace(/[\s,;:–—-]*\{titles\}/g, ""), values)
  const quoted = titles.map((title) => `“${title.trim()}”`)
  for (let n = quoted.length; n > 1; n--) {
    const filled = fillIn(text, { ...values, titles: quoted.slice(0, n).join(", ") })
    if (filled.length <= max) return filled
  }
  return cutAtWord(fillIn(text, { ...values, titles: quoted.slice(0, 1).join("") }), max)
}

/** The page's words, with `{name}` and `{count}` filled in from its posts,
 *  and its search description with the titles of its newest (`titles`). */
export function filterWords(content: SiteCopy, kind: Kind, name: string, count: number, titles: string[] = []) {
  const base = kind === "Category" ? "blog.category" : "blog.tag"
  const word = (key: string, fallback: string) => fillIn(plainText(content, `${base}.${key}`, fallback), { name, count })
  const meta = (fallback: string) => fillTitles(plainText(content, `${base}.meta`, fallback), { name, count }, titles)
  return kind === "Category"
    ? {
        label: word("label", "Category"),
        description: count === 1 ? word("one", "1 post filed under {name}.") : word("many", "{count} posts filed under {name}."),
        title: word("title", "{name} posts"),
        meta: meta("Posts filed under {name}, {count} so far, newest first: {titles}."),
      }
    : {
        label: word("label", "Tag"),
        description: count === 1 ? word("one", "1 post tagged {name}.") : word("many", "{count} posts tagged {name}."),
        title: word("title", "Posts tagged {name}"),
        meta: meta("Posts tagged {name}, {count} so far, newest first: {titles}."),
      }
}
