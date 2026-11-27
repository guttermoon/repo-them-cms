/**
 * The one piece of markup in plain copy: `[label](url)`. (Words Notion
 * formatted travel as its runs instead: lib/inline-text.ts.)
 *
 * It is how a Notion hyperlink arrives (`styledText` in lib/inline-text.ts
 * writes it), and how words written in code put a link on themselves. `<T>`
 * and `LinkedText` draw it (components/system/linked-text.tsx) and the
 * structured data reads it; all of them read it here, so they cannot disagree
 * about what is a link (whether an address may contain a space, say).
 *
 * Square brackets on their own are not links: "[start time]" in a message is
 * a blank for the reader to fill in. An address may hold balanced brackets,
 * as Wikipedia's do (…/Notion_(app)), the way CommonMark reads them.
 *
 * No imports, so `npm test` and the build scripts can load it as it is
 * (tests/inline-links.test.mjs).
 */

export type LinkPiece = { text: string; href?: string }

const LINK = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g

/**
 * Where a link in the copy may point: the web, mail, a telephone, or a page
 * or anchor on this site. A row in Notion is typed by a person, and a
 * `javascript:` or `data:` address in one would run in every reader's
 * browser, so anything else comes back undefined and is drawn as its words
 * alone. The same posture as `safeDestination` in lib/content/redirects.ts, which
 * is stricter because a redirect cannot go to a mail client.
 */
export function safeHref(raw: string): string | undefined {
  const href = raw.trim()
  // a browser drops a tab or a line break inside an address, so "/\t/host"
  // is "//host"; and it reads "/\host" as "//host" too: both leave the site
  // while looking like a path on it
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(href)) return undefined
  if (/^https?:\/\/[^/\s]/i.test(href)) return href
  if (/^(mailto|tel):\S/i.test(href)) return href
  if (/^\/(?![/\\])/.test(href) || /^#\S/.test(href)) return href
  return undefined
}

/**
 * Words with their `[label](url)` links as the rich text Notion takes in a
 * write (the setup and seeding scripts): a link to the web becomes a real
 * Notion link, which is how an editor will see and change it; any other
 * (a page here, an email address) stays as its markup, which the site reads
 * the same way and Notion would refuse as a link. Runs are cut at Notion's
 * 2,000 characters.
 */
export function richTextRequest(text: string): TextRun[] {
  return linkPieces(text).flatMap((piece) => {
    const web = piece.href && /^https?:\/\//i.test(piece.href) ? piece.href : undefined
    return textRequest(piece.href && !web ? `[${piece.text}](${piece.href})` : piece.text, web)
  })
}

/** A run of text as Notion takes it in a write. */
export type TextRun = { type: "text"; text: { content: string; link?: { url: string } } }

/** Words as they are, as the runs Notion takes in a write, cut at its 2,000
 *  characters a run, each a link to `url` when one is given. */
export function textRequest(content: string, url?: string): TextRun[] {
  return (content.match(/[\s\S]{1,2000}/g) ?? []).map((chunk) => ({ type: "text" as const, text: { content: chunk, ...(url ? { link: { url } } : {}) } }))
}

/** The text in order, each link as its words and its (safe) address. A link
 *  to somewhere `safeHref` refuses keeps its words and loses the address. */
export function linkPieces(text: string): LinkPiece[] {
  const pieces: LinkPiece[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) pieces.push({ text: text.slice(last, at) })
    const href = safeHref(m[2])
    pieces.push(href ? { text: m[1], href } : { text: m[1] })
    last = at + m[0].length
  }
  if (last < text.length) pieces.push({ text: text.slice(last) })
  return pieces
}
