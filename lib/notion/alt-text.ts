/**
 * Alt text, which Notion's API does not give: Notion's editor has an alt text
 * setting for a picture, but the API returns only the file and its caption.
 * So an editor writes it where the site can read it:
 *
 * - **A picture in a page or a post** (an image block): a line of its caption
 *   that starts with "Alt:" (or "Alt text:") is what a screen reader reads,
 *   and is not shown. The rest of the caption is shown under the picture. A
 *   bare "Alt:" marks the picture as decoration.
 * - **A product's picture** (Image, Gallery): the file's name in Notion.
 *   The importer writes the shop's own alt text there, and a picture uploaded
 *   by hand is named with what it shows ("The front of the box.webp", read
 *   without its ending); a name that is only a file name ("IMG_1234.jpg") is
 *   not a description.
 */
import type { MediaRef, RichRun } from "./rows"

/** A line that starts with "Alt:" or "Alt text:", in any case. */
const ALT_LINE = /(^|\n)[ \t]*alt(?:[ \t]+text)?[ \t]*:[ \t]*([^\n]*)/i

export type SplitCaption = {
  /** what is shown under the picture: the caption without its alt line */
  caption: RichRun[]
  /** what a screen reader reads: the alt line's words, "" for a picture
   *  marked as decoration, or null when the caption has no alt line */
  alt: string | null
}

/** A copy of a text run holding only `text`. */
const sliceRun = (run: RichRun, text: string): RichRun => ({
  ...run,
  plain_text: text,
  ...(run.text ? { text: { ...run.text, content: text } } : {}),
})

/** The runs with the characters from `from` to `to` (of their joined text)
 *  taken out. A mention or an equation is kept whole unless all of it is
 *  inside the cut: only a text run can be split. */
function cut(runs: RichRun[], from: number, to: number): RichRun[] {
  const out: RichRun[] = []
  let at = 0
  for (const run of runs) {
    const text = run.plain_text ?? ""
    const start = at
    const end = at + text.length
    at = end
    if (end <= from || start >= to) {
      out.push(run)
      continue
    }
    if (start >= from && end <= to) continue
    if ((run.type ?? "text") !== "text") {
      out.push(run)
      continue
    }
    const before = text.slice(0, Math.max(0, from - start))
    const after = text.slice(Math.max(0, to - start))
    if (before) out.push(sliceRun(run, before))
    if (after) out.push(sliceRun(run, after))
  }
  return out
}

/** A picture's caption, split into what is shown and what is read. */
export function splitCaption(runs: RichRun[] | undefined): SplitCaption {
  const all = runs ?? []
  const text = all.map((r) => r.plain_text ?? "").join("")
  const match = ALT_LINE.exec(text)
  if (!match) return { caption: all, alt: null }
  // the line goes, and with it the line break that joined it to the rest
  const from = match.index
  let to = match.index + match[0].length
  if (!match[1] && text[to] === "\n") to += 1
  const caption = cut(all, from, to)
  const shown = caption.map((r) => r.plain_text ?? "").join("")
  return { caption: shown.trim() ? caption : [], alt: match[2].trim() }
}

/** A file name rather than a description: "IMG_1234.jpg", "corn-flakes-back",
 *  or the importer's own stand-in, "picture-3". */
export const isFileName = (name: string): boolean =>
  /^\S+\.[a-z0-9]{2,5}$/i.test(name) || /^picture-\d+$/i.test(name) || (/^\S+$/.test(name) && /[-_]/.test(name))

/** A picture's file ending, as Notion keeps it on an uploaded file's name. */
const PICTURE_ENDING = /\.(?:avif|gif|heic|jpe?g|png|svg|webp)$/i

/** A picture's description from its name in Notion, or "" when its name is
 *  only a file name (or it has none). A picture uploaded already named with
 *  what it shows ("The front of the box.webp") is read without its ending. */
export function nameAlt(media: Pick<MediaRef, "name"> | undefined): string {
  const name = media?.name?.trim() ?? ""
  return name && !isFileName(name) ? name.replace(PICTURE_ENDING, "").trim() : ""
}
