/**
 * Next's own control-flow signals (a page bailing out of static rendering, a
 * redirect, a not-found) are thrown as errors and must reach Next. Swallowed
 * by a catch meant for an API's failures, a bail-out becomes whatever that
 * catch returns, baked into a static page: an empty blog over posts that are
 * sitting in Notion.
 *
 * Call it first in any catch on a render path. No imports, so `npm test`
 * loads it (tests/next-signal.test.mjs).
 */
export function rethrowNextSignal(error: unknown): void {
  const digest = (error as { digest?: unknown } | null)?.digest
  if (typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"))) {
    throw error
  }
}
