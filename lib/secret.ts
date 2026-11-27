import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Comparing secrets and signatures in constant time, so a caller cannot
 * narrow one down a byte at a time by measuring how long a comparison took.
 * Node's crypto only, so `npm test` loads it.
 */
export function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A Notion webhook's signature: `sha256=` and the hex HMAC-SHA256 of the
 *  raw request body, keyed with the subscription's verification token. */
export function notionSignature(rawBody: string, token: string): string {
  return `sha256=${createHmac("sha256", token).update(rawBody).digest("hex")}`
}
