/**
 * Whether a string is shaped like an email address: something, an @, a
 * domain with a dot in it, and at least two characters after the last dot.
 *
 * Deliberately loose. The email platform does the authoritative check; this
 * only catches an obvious slip before a form sends anything, or before a
 * route spends an API call on it. One rule for every form and both routes,
 * so a form can never let through what a route refuses.
 *
 * Every route that takes an address calls it first; without it a route sends
 * whatever arrives, an empty string included, on to the platform.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** What both routes say when an address fails `looksLikeEmail`. */
export const NOT_AN_EMAIL = "That does not look like an email address."

export function looksLikeEmail(raw: string): boolean {
  return EMAIL.test(raw.trim())
}
