"use client"

import { useEffect } from "react"

import { onConsentChange, readConsent } from "@/lib/consent"
import { GA_CONSENT, GA_MEASUREMENT_ID, GA_PATH, gaCookieNames, gaSettings } from "@/lib/google-analytics"

/**
 * Google Analytics 4. Renders nothing; it starts GA4 only once the reader has
 * said yes in the cookie notice, through this site (lib/google-analytics.ts).
 *
 *  - No answer yet: nothing. Not the script, not a cookie, not a request.
 *  - "Yes": the script loads from /ga/gtag/js and GA4 counts the visit,
 *    sending to /ga.
 *  - "No", now or later: GA4's own off switch (`ga-disable-<ID>`) and its
 *    cookies deleted, at once.
 *  - Cookie settings reopens the question, which changes nothing until it is
 *    answered, as for PostHog.
 *
 * Nothing at all without a measurement ID (`GA_MEASUREMENT_ID`, from
 * NEXT_PUBLIC_GA_MEASUREMENT_ID at build time).
 */

type GtagWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
} & Record<string, unknown>

let started = false

function start(id: string) {
  const w = window as unknown as GtagWindow
  w[`ga-disable-${id}`] = false
  if (started) return
  started = true
  w.dataLayer = w.dataLayer || []
  // gtag reads its queue as `arguments` objects, which is why this is not an
  // arrow function and does not spread
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  // the settings are set globally BEFORE the tag starts, and that is the copy
  // that holds; the config repeats them (see gaSettings())
  const settings = gaSettings(window.location.origin)
  w.gtag("consent", "default", GA_CONSENT)
  w.gtag("set", settings)
  w.gtag("js", new Date())
  w.gtag("config", id, settings)
  const script = document.createElement("script")
  script.async = true
  script.src = `${GA_PATH}/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)
}

function stop(id: string) {
  const w = window as unknown as GtagWindow
  w[`ga-disable-${id}`] = true
  // GA4 sets its cookies on the site's own domain with a leading dot, so each
  // name is expired there and on the bare host, whichever it landed on
  const host = window.location.hostname
  const domains = ["", host, `.${host.replace(/^www\./, "")}`]
  for (const name of gaCookieNames(id)) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`
    }
  }
}

export function GoogleAnalytics() {
  useEffect(() => {
    const id = GA_MEASUREMENT_ID
    if (!id) return
    if (readConsent() === "accepted") start(id)
    return onConsentChange((value) => {
      if (value === "accepted") start(id)
      else if (value === "rejected") stop(id)
      // null: the question reopened; nothing changes until it is answered
    })
  }, [])

  return null
}
