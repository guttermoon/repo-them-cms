/**
 * Notion's formatting in the words the site reads from a property: a Site
 * Copy row, a quotation, an answer, a description, a bio.
 *
 * Those words travel as strings (the copy map, a row's fields, the build's
 * snapshot). Words with no formatting but links travel as they always have:
 * plain text, each link as `[label](url)` (lib/inline-links.ts). Words with
 * any other formatting (bold, italic, underline, strikethrough, code, a
 * colour) travel as Notion's runs, after a mark nobody types (`STYLED`), so
 * plain words read exactly as before and no escaping rule can eat a
 * character somebody meant.
 *
 * Whatever prints words reads them through here: `inlineRuns` for nodes
 * (`<T>` and `LinkedText` draw them, components/system/linked-text.tsx), and
 * `inlineWords` for a string (an attribute, a title, a feed, structured data,
 * a search). tests/dom/every-word.test.tsx renders every page with every row
 * styled and finds the mark nowhere.
 *
 * Imports nothing but lib/inline-links.ts, so `npm test` loads it as it is
 * (tests/inline-text.test.mjs) and a client component can too.
 */
import { linkPieces } from "./inline-links"

/** The mark before styled words: a private-use character, which no keyboard
 *  types and Notion never sends. */
export const STYLED = ""

/** One run of words and what Notion did to them: bold, italic, underline,
 *  strikethrough, code, a colour (Notion's name for it: "red",
 *  "red_background"), a link. */
export type InlineRun = { t: string; b?: 1; i?: 1; u?: 1; s?: 1; c?: 1; col?: string; href?: string }

/** What `styledText` reads of a Notion rich-text run. */
export type RunLike = {
  plain_text?: string
  href?: string | null
  annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean; color?: string }
}

const formatted = (run: RunLike) => {
  const a = run.annotations ?? {}
  return Boolean(a.bold || a.italic || a.strikethrough || a.underline || a.code || (a.color && a.color !== "default"))
}

/** A link `[label](url)` could not carry: a bracket in its words, or an
 *  address the markup's reader would stop short in (lib/inline-links.ts).
 *  Such words travel as runs, where the address is kept apart. */
const unwritable = (run: RunLike) => Boolean(run.href) && (/[[\]]/.test(run.plain_text ?? "") || !/^(?:[^()\s]|\([^()\s]*\))+$/.test(run.href as string))

/**
 * A rich-text property as the site keeps it. With no formatting but links,
 * plain words with each link as `[label](url)`; with any, `STYLED` and the
 * runs. Words that are only spaces, however formatted, are "" (a blank row
 * hides its slot whatever Notion did to the blank).
 */
export function styledText(runs: RunLike[] | undefined): string {
  const list = (runs ?? []).filter((run) => run.plain_text)
  if (!list.some(formatted) && !list.some(unwritable)) return list.map((run) => (run.href ? `[${run.plain_text}](${run.href})` : (run.plain_text as string))).join("")
  if (!list.map((run) => run.plain_text).join("").trim()) return ""
  const out: InlineRun[] = list.map((run) => {
    const a = run.annotations ?? {}
    return {
      t: run.plain_text as string,
      ...(a.bold ? { b: 1 as const } : {}),
      ...(a.italic ? { i: 1 as const } : {}),
      ...(a.underline ? { u: 1 as const } : {}),
      ...(a.strikethrough ? { s: 1 as const } : {}),
      ...(a.code ? { c: 1 as const } : {}),
      ...(a.color && a.color !== "default" ? { col: a.color } : {}),
      ...(run.href ? { href: run.href } : {}),
    }
  })
  return STYLED + JSON.stringify(out)
}

export const isStyled = (text: string): boolean => text.startsWith(STYLED)

const FLAGS = ["b", "i", "u", "s", "c"] as const

/** A run as it was kept, or nothing when it is not one: the snapshot and the
 *  cache are files, and a damaged one must print words or nothing, never
 *  its insides. */
function run(value: unknown): InlineRun | undefined {
  if (!value || typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  if (typeof v.t !== "string") return undefined
  const out: InlineRun = { t: v.t }
  for (const flag of FLAGS) if (v[flag]) out[flag] = 1
  if (typeof v.col === "string" && /^[a-z_]+$/.test(v.col)) out.col = v.col
  if (typeof v.href === "string" && v.href) out.href = v.href
  return out
}

/**
 * The runs of some words, in order. A link typed as `[label](url)` inside a
 * run (Notion refuses a bare path as a link, so the setup writes a link to
 * one of the site's pages that way) becomes a run of its own with the
 * formatting round it. Plain words are runs too, so a reader of runs reads
 * both.
 */
export function inlineRuns(text: string): InlineRun[] {
  let runs: InlineRun[] = [{ t: text }]
  if (isStyled(text)) {
    try {
      const parsed: unknown = JSON.parse(text.slice(STYLED.length))
      runs = Array.isArray(parsed) ? parsed.map(run).filter((r): r is InlineRun => Boolean(r)) : []
    } catch {
      runs = []
    }
  }
  return runs.flatMap((r) => (r.href ? [r] : linkPieces(r.t).map((piece) => (piece.href ? { ...r, t: piece.text, href: piece.href } : { ...r, t: piece.text }))))
}

/** The words alone, as a string: a link as its words, formatting gone, line
 *  breaks kept. For whatever cannot hold an element. */
export function inlineWords(text: string): string {
  return inlineRuns(text)
    .map((r) => r.t)
    .join("")
}
