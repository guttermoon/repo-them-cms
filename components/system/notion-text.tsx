import type React from "react"
import type { SiteCopy } from "@/lib/notion/rows"
import { recordCopyKey } from "@/lib/copy-dump"
import { FROM_NOTION, fillIn, fromNotion, plainText, siteDescriptor, siteName, siteNoun, slotHidden, slotHref, slotText } from "@/lib/slots"
import { inlineNodes } from "@/components/system/linked-text"

export type { SiteCopy }
export { fillIn, plainText, siteDescriptor, siteName, siteNoun, slotHidden, slotHref, slotText }

/**
 * Builds a <T> component bound to the site's copy map. Each text slot
 * resolves to one of three states for the Site Copy row titled `<k>`:
 *   - a ticked row with text                 → the Notion text
 *   - an unticked row, or a ticked one empty → hidden (renders nothing)
 *   - no row at all                          → hidden once Notion is
 *     connected; the built-in children on the starter site (FROM_NOTION)
 * Published means shown, for a text as for a page: unticking a row is how an
 * editor takes a slot away, and only words in Notion reach a connected site. The row's line breaks, links and formatting
 * (bold, italic, underline, strikethrough, code, colour) come through as
 * Notion shows them (components/system/linked-text.tsx).
 *
 * Pass `colon` to bold each line's lead-in up to and including its first colon
 * (e.g. "Brevo:"), as the privacy notice's list of processors does.
 *
 * Pass `words` where the slot is itself the words of a link the code draws
 * (a link inside a link is invalid HTML, and React reports it as a hydration
 * error): a link in the row is then kept as its words.
 */
export function makeT(content: SiteCopy) {
  return function T({
    k,
    children,
    colon,
    words,
  }: {
    k: string
    children?: React.ReactNode
    colon?: boolean
    words?: boolean
  }) {
    // a no-op in production and in the browser — see lib/copy-dump.ts
    recordCopyKey(k, children)

    const v = content[k]
    // no row: nothing once Notion is connected, the default on the starter site
    if (v == null) return fromNotion(content) ? null : <>{children}</>
    // an unticked row, or a ticked one left blank → hidden
    if (v.trim() === "") return null
    return <>{inlineNodes(v, { key: k, words, colon })}</>
  }
}

/**
 * The subset of the copy map whose keys start with `<prefix>`.
 *
 * For client components. Handing one the whole map serialises every row on the
 * site into the RSC payload for the sake of half a dozen labels, and it grows
 * every time an editor adds a slot; this keeps a form's own copy with the form
 * and nothing else on the wire.
 */
export function pickCopy(content: SiteCopy, prefix: string): SiteCopy {
  // the mark goes with the words, so a slot with no row hides in the browser too
  const out: SiteCopy = fromNotion(content) ? { [FROM_NOTION]: "1" } : {}
  for (const [k, v] of Object.entries(content)) {
    if (k.startsWith(prefix)) out[k] = v
  }
  return out
}

/** A page's bound `<T>`, for components that take one as a prop. */
export type T = ReturnType<typeof makeT>
