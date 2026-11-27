/**
 * The reader's answer to the cookie question, shared by the notice and the
 * two analytics loaders.
 *
 * Analytics is opt-in: nothing loads, sets a cookie or sends a request until
 * the answer is "accepted", and a later "rejected" switches it off and
 * deletes its cookies. Everything is tiny and synchronous so a loader can
 * decide on its first render.
 */

export type Consent = "accepted" | "rejected"

/** The localStorage key the answer is kept under (named in the privacy notice). */
export const CONSENT_KEY = "site-consent"

/**
 * Where the answer is kept while the question is only an example (no
 * analytics set up: the box says so, and nothing loads whatever the answer).
 * Apart from the real one, so a yes given while the site counted nothing is
 * never read as a yes to counting once analytics is switched on: then the
 * reader is asked again, for real.
 */
export const EXAMPLE_CONSENT_KEY = "site-consent-example"

export type ConsentKey = typeof CONSENT_KEY | typeof EXAMPLE_CONSENT_KEY

/** same-tab notification; the storage event only fires in *other* tabs */
const EVENT = "site-consent-change"

type Change = { key: ConsentKey; value: Consent | null }

/** null = not asked yet, or the reader cleared their browser storage */
export function readConsent(key: ConsentKey = CONSENT_KEY): Consent | null {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(key)
    return v === "accepted" || v === "rejected" ? v : null
  } catch {
    // private mode / storage blocked — treat as "no consent given"
    return null
  }
}

export function writeConsent(value: Consent, key: ConsentKey = CONSENT_KEY): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // if we cannot remember the choice we still honour it for this page view
  }
  window.dispatchEvent(new CustomEvent<Change>(EVENT, { detail: { key, value } }))
}

/** used by "change your mind" — puts the reader back to un-asked, for the
 *  real question and the example alike */
export function clearConsent(): void {
  for (const key of [CONSENT_KEY, EXAMPLE_CONSENT_KEY] as const) {
    try {
      window.localStorage.removeItem(key)
    } catch {}
    window.dispatchEvent(new CustomEvent<Change>(EVENT, { detail: { key, value: null } }))
  }
}

/** subscribe to changes to one answer, in this tab and in others; returns
 *  an unsubscribe */
export function onConsentChange(cb: (value: Consent | null) => void, key: ConsentKey = CONSENT_KEY): () => void {
  const local = (e: Event) => {
    const change = (e as CustomEvent<Change>).detail
    if (change?.key === key) cb(change.value)
  }
  const cross = (e: StorageEvent) => {
    if (e.key === key) cb(readConsent(key))
  }
  window.addEventListener(EVENT, local)
  window.addEventListener("storage", cross)
  return () => {
    window.removeEventListener(EVENT, local)
    window.removeEventListener("storage", cross)
  }
}
