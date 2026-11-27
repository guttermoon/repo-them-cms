/**
 * Where a Redirect row may send somebody.
 *
 * `/go/<slug>` is a redirector by design (a QR code printed on a poster
 * cannot change, so it points here and the row decides), so the usual
 * "never redirect to a caller's URL" rule does not apply: the caller chooses
 * only the slug. But the destination still comes from a database row, and a
 * row is typed by a person: an absolute web address, a path on this site, an
 * email or a phone number, and nothing else. No `javascript:`, no `data:`,
 * no protocol-relative `//elsewhere` (which reads as a path and leaves).
 *
 * Imports nothing, so `npm test` loads it.
 */
export function safeDestination(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const url = raw.trim()
  if (!url || /[\s<>"'`]/.test(url)) return undefined
  if (/^https?:\/\/[^/]/i.test(url)) return url
  if (/^(mailto|tel):[^/]/i.test(url)) return url
  if (url === "/" || /^\/[^/\\]/.test(url)) return url
  return undefined
}
