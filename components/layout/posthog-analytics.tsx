"use client"

import { useEffect } from "react"
import type { PostHog } from "posthog-js"

import { analyticsKey, posthogCookieName, PROXY_PATH, posthogOptions } from "@/lib/analytics"
import { onConsentChange, readConsent } from "@/lib/consent"
import { type FlagKey, flagValue } from "@/lib/flags"

/**
 * PostHog analytics. Renders nothing. Opt-in (lib/analytics.ts says why):
 *
 *  - No key (NEXT_PUBLIC_POSTHOG_KEY unset): nothing, ever.
 *  - No answer yet: nothing. Not the script, not a cookie, not a request.
 *  - Yes: posthog-js is fetched as a chunk of its own and started, sending
 *    through this site's /ingest.
 *  - No, now or later: `opt_out_capturing()`, which stops the sending and
 *    deletes PostHog's cookie and identifier.
 *  - Cookie settings reopens the question, which changes nothing until it is
 *    answered.
 */

const KEY = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY)

let loading: Promise<PostHog | null> | null = null

/** posthog-js, fetched and started once; null when it could not be. */
function load(key: string): Promise<PostHog | null> {
  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, posthogOptions(PROXY_PATH))
      return posthog
    })
    .catch(() => {
      // a blocked or failed download: try again on the next page
      loading = null
      return null
    })
  return loading
}

async function begin(key: string): Promise<PostHog | null> {
  const posthog = await load(key)
  if (posthog?.has_opted_out_capturing()) posthog.opt_in_capturing()
  return posthog
}

/** A product event (docs/analytics.md lists them), sent only after a yes,
 *  and never with anything that names the reader. */
export function capturePostHogEvent(event: string, properties?: Record<string, unknown>) {
  const key = KEY
  if (!key || readConsent() !== "accepted") return
  void begin(key).then((posthog) => posthog?.capture(event, properties))
}

/** An error the page could not recover from, sent only after a yes. */
export function capturePostHogException(error: Error) {
  const key = KEY
  if (!key || readConsent() !== "accepted") return
  void begin(key).then((posthog) => posthog?.captureException(error))
}

/**
 * A feature flag as PostHog has it for this reader (lib/flags.ts), told to
 * `listen` now and whenever it changes. Only after a yes: before an answer,
 * or after a no, PostHog is never asked and the flag keeps its fallback.
 * Returns what stops listening.
 */
export function onPostHogFlag(key: FlagKey, listen: (on: boolean) => void): () => void {
  let stopped = false
  let unhook: (() => void) | undefined
  const ask = () => {
    const posthogKey = KEY
    if (!posthogKey || readConsent() !== "accepted") return listen(flagValue(key, undefined))
    void begin(posthogKey).then((posthog) => {
      if (!posthog || stopped) return
      unhook?.()
      unhook = posthog.onFeatureFlags(() => {
        if (!stopped) listen(flagValue(key, posthog.getFeatureFlag(key)))
      })
    })
  }
  ask()
  const unconsent = onConsentChange(() => ask())
  return () => {
    stopped = true
    unhook?.()
    unconsent()
  }
}

/**
 * This visit as PostHog knows it (its random identifier and the session it is
 * recording), so feedback can point at the recording of what the reader saw.
 * Only after a yes, and only once PostHog has loaded; null otherwise.
 */
export async function postHogVisit(): Promise<{ distinctId: string; sessionId: string } | null> {
  const key = KEY
  if (!key || readConsent() !== "accepted") return null
  const posthog = await begin(key)
  const distinctId = posthog?.get_distinct_id()
  const sessionId = posthog?.get_session_id()
  return distinctId && sessionId ? { distinctId, sessionId } : null
}

/** Everything PostHog keeps in this browser under its project's name: its
 *  cookie, on the host and on the domain above it, and its stored copy. */
export function forget(key: string) {
  const name = posthogCookieName(key)
  const host = window.location.hostname
  for (const domain of ["", host, `.${host.replace(/^www\./, "")}`]) {
    document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`
  }
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      storage().removeItem(name)
    } catch {
      // storage switched off: nothing was kept there
    }
  }
}

export function PostHogAnalytics() {
  useEffect(() => {
    const key = KEY
    if (!key) return
    if (readConsent() === "accepted") void begin(key)
    return onConsentChange((value) => {
      if (value === "accepted") void begin(key)
      else if (value === "rejected" && loading) void loading.then((posthog) => posthog?.opt_out_capturing())
      // A no on a visit where PostHog never loaded (a yes on an earlier day,
      // the question reopened, then no): what that yes left is still in the
      // browser, and a no deletes it all the same.
      if (value === "rejected") forget(key)
      // null: the question reopened; nothing changes until it is answered
    })
  }, [])

  return null
}
