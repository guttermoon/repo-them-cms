/**
 * The contact form's message as an email: a plain-text part, which is the
 * letter, and an HTML part laid over it so a link someone sends can be
 * clicked.
 *
 * The danger of an HTML part is exactly the link, so two rules hold the
 * whole design:
 *
 * 1. **Escape the entire message before a single tag is added.** Once tags
 *    are in the string there is no way to escape the rest without breaking
 *    them, and every attempt to escape "just the writer's part" eventually
 *    meets a case where it is not clear which part that was. A message
 *    reading `<script>alert(1)</script>` arrives as those characters, printed.
 *
 * 2. **A link's visible text is its destination, always.** Not a label the
 *    sender chose. Link-based phishing lives in the gap between what a link
 *    says and where it goes, and refusing to carry a label closes it: the
 *    owner can read the address before visiting it. It also means there is
 *    no syntax for a sender to learn or abuse: they type an address, they
 *    get a link.
 *
 * Only http and https are linked. mailto:, javascript:, data: and the rest
 * stay as text; a scheme that does something other than open a page is not
 * worth making one-click in mail sent by strangers.
 *
 * Imports nothing, so `npm test` loads it (tests/routes.test.mjs).
 */

const MAX_LINKS = 10

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Escaped text with bare http(s) URLs turned into links.
 *
 * The trailing-punctuation trim matters more than it looks: a URL at the end
 * of a sentence would otherwise swallow the full stop and 404, and a URL in
 * brackets would swallow the bracket. Runs past MAX_LINKS are left as text —
 * a letter with fifty links in it is not a letter.
 */
export function linkify(text: string): string {
  const escaped = escapeHtml(text)
  let used = 0
  // an address ends at a quote or a bracket, which by now is an entity
  return escaped.replace(/https?:\/\/(?:(?!&(?:quot|gt|lt|#39);)[^\s<])+/g, (match) => {
    if (used >= MAX_LINKS) return match
    // &amp; from escaping ends in ; — do not treat that as sentence punctuation
    const trimmed = match.replace(/(?<!&[a-z]+|&#\d+)[.,;:!?)\]}'"]+$/i, "")
    const tail = match.slice(trimmed.length)
    if (!/^https?:\/\/[^\s]+\.[^\s]/.test(trimmed)) return match
    used++
    return `<a href="${trimmed}" rel="noopener noreferrer nofollow">${trimmed}</a>${tail}`
  })
}

export type Letter = {
  name: string
  email: string
  company?: string
  type?: string
  message: string
}

/** The plain-text part. Every mail client can read this, and it is what the
 *  letter is; the HTML part is a convenience laid over the top of it. */
export function letterText(letter: Letter): string {
  const head = [
    `From: ${letter.name} <${letter.email}>`,
    letter.company ? `Company: ${letter.company}` : "",
    letter.type ? `Type: ${letter.type}` : "",
  ].filter(Boolean)
  // a blank line between who it is from and what they wrote, as in any letter
  return [...head, "", letter.message].join("\n")
}

export function letterHtml(letter: Letter): string {
  const head = [
    `<strong>From:</strong> ${escapeHtml(letter.name)} &lt;${escapeHtml(letter.email)}&gt;`,
    letter.company && `<strong>Company:</strong> ${escapeHtml(letter.company)}`,
    letter.type && `<strong>Type:</strong> ${escapeHtml(letter.type)}`,
  ]
    .filter(Boolean)
    .join("<br>")

  const body = linkify(letter.message).replace(/\n/g, "<br>")

  return (
    `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#111">` +
    `<p style="font-family:monospace;font-size:12px;color:#555;margin:0 0 16px">${head}</p>` +
    `<div>${body}</div>` +
    `</div>`
  )
}
