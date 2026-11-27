import { cleanUrl, shortenIp } from "./analytics"

/**
 * Google Analytics 4, beside or instead of PostHog, held to the site's rule
 * that no visitor's browser talks to a third party.
 *
 * ── Only after a yes ──────────────────────────────────────────────────────
 *
 * GA4 loads only once the reader has said yes in the cookie notice, never
 * before an answer, never after a no, and a later no switches it off and
 * deletes its cookies (components/layout/google-analytics.tsx).
 *
 * ── Through this site ─────────────────────────────────────────────────────
 *
 * The browser never contacts Google. Google's script is fetched by our server
 * and served from /ga/gtag/js, and GA4 is told to send its hits to /ga
 * (`transport_url`, set globally before the tag starts: see `gaSettings()`);
 * the route handler (app/ga/[...path]/route.ts) passes them on to Google with:
 *
 *  - the reader's IP address SHORTENED (`shortenIp()`, as PostHog's is), in
 *    the `_uip` parameter Google's own server-side tagging uses for it, so a
 *    rough location survives and the full address never leaves;
 *  - every page address cleaned (`cleanUrl()`, as PostHog's are), so a
 *    query parameter carrying a name or an address reaches Google as the
 *    bare page;
 *  - no user-provided data: GA4 can pick email addresses, phone numbers and
 *    postal addresses out of the page's forms and send them hashed (`em`,
 *    `emd` and the `ec_` parameters). The contact and newsletter forms are
 *    such forms, so they are dropped here whatever GA4's admin says
 *    (`USER_DATA`);
 *  - none of the reader's cookies, and no referrer header.
 *
 * Only the configured measurement ID's script is fetched (`gaUpstreamFor()`),
 * and only GA4's collection path is forwarded, so /ga is not a proxy for
 * anybody else's tag.
 *
 * Google signals and ad personalisation are off in the tag itself, and
 * Consent Mode says no to every advertising purpose. Three switches live only
 * in GA4's admin and must be set there: Data collection → Google signals off,
 * Data collection → User-provided data collection off, and Account settings →
 * Data sharing all off. The privacy notice depends on all three.
 *
 * Imports only lib/analytics.ts, so `npm test` loads it.
 */

/** Where GA4's script and hits go on this site. */
export const GA_PATH = "/ga"

/** Google's own hosts, which only our server ever talks to. */
export const GA_HOSTS = {
  script: "https://www.googletagmanager.com",
  collect: "https://region1.google-analytics.com",
} as const

/** How long GA4's cookies last: 13 months rather than its default two years,
 *  the longest the privacy notice promises for anything. In seconds, as
 *  gtag's `cookie_expires` wants it. */
export const GA_COOKIE_SECONDS = 13 * 30 * 24 * 60 * 60

/**
 * The measurement ID GA4 runs under, or null for none: `NEXT_PUBLIC_GA_
 * MEASUREMENT_ID` on Vercel, read at build time. Only a GA4 ID ("G-" and
 * letters and digits) counts, so a stray value turns GA4 off rather than
 * printing something odd into a script address. Unset, nothing about GA4
 * renders anywhere: no loader, no line in the cookie notice, no rows in the
 * privacy notice.
 */
export function gaMeasurementId(raw: string | undefined): string | null {
  const id = raw?.trim().toUpperCase()
  return id && /^G-[A-Z0-9]{4,16}$/.test(id) ? id : null
}

/** The ID this build runs under (see `gaMeasurementId()`). */
export const GA_MEASUREMENT_ID = gaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)

/** GA4's own cookie names for an ID: `_ga`, and `_ga_` with the ID's letters
 *  after the "G-". The privacy notice prints these. */
export function gaCookieNames(id: string): string[] {
  return ["_ga", `_ga_${id.replace(/^G-/, "")}`]
}

/**
 * The settings GA4 runs with: its hits to our own address, nothing for
 * advertising, and cookies that last 13 months. `origin` is the page's own
 * (location.origin), since the address must be a full one.
 *
 * They are given twice, and the first is the one that holds:
 * `gtag("set", …)` before the tag starts, then `gtag("config", ID, …)`.
 * Google's script can hand a config's settings to the tag's own container
 * rather than apply them, and the tag then sends straight to Google: it did
 * for this tag in November 2026, the address in the config ignored. A global
 * set is read for every hit, whichever way the script runs.
 *
 * `transport_url`, not `server_container_url`: the first is the plain address
 * hits go to; the second also tells the script it is talking to a server-side
 * tagging container, which /ga is not.
 *
 * Deliberately NOT `page_location`: set here, GA4 reuses it for every later
 * page view, and every visit would look like one page. The page addresses are
 * cleaned on our server instead, on the way through.
 */
export function gaSettings(origin: string) {
  return {
    transport_url: `${origin}${GA_PATH}`,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: GA_COOKIE_SECONDS,
    cookie_flags: "SameSite=Lax;Secure",
  }
}

/** Consent Mode, set before anything else: counting yes (this only ever runs
 *  after the reader said yes), every advertising purpose no. */
export const GA_CONSENT = {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const

/**
 * Where a request to /ga/<path> goes at Google, or null to refuse it.
 *
 *  - `gtag/js` and `gtag/destination`: Google's script, only for OUR
 *    measurement ID (its one `id` parameter must be it), so nobody can load
 *    a tag of their own through this site.
 *  - `g/collect`: GA4's hits.
 *
 * Anything else is refused. `hosts` is a stand-in for testing.
 */
export function gaUpstreamFor(
  path: string,
  params: URLSearchParams,
  measurementId: string | null,
  hosts: { script: string; collect: string } = GA_HOSTS,
): string | null {
  if (!measurementId) return null
  if (path === "gtag/js" || path === "gtag/destination") {
    // one id, and ours: a second one would have Google send its tag as well
    const ids = params.getAll("id")
    return ids.length === 1 && ids[0].toUpperCase() === measurementId ? `${hosts.script}/${path}` : null
  }
  if (path === "g/collect") return `${hosts.collect}/${path}`
  return null
}

/** The parameters in a GA4 hit that carry a page address. */
const ADDRESS_PARAMS = ["dl", "dr", "ep.page_location", "ep.page_referrer"]

/** The parameters that carry user-provided data (hashed email addresses,
 *  phone numbers and postal addresses, and how they were found), which never
 *  go on. */
const USER_DATA = /^(em|emd|ec_.*)$/

const decode = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "))
  } catch {
    return s
  }
}

/**
 * One hit's parameters, in their query-string form, with every page address
 * cleaned (`cleanUrl()`), and `_uip` and any user-provided data taken out.
 * Every other pair goes on exactly as the browser wrote it, encoding and order
 * and all: only what has to change is touched.
 */
function cleanPairs(form: string, ownHost: string): string[] {
  return form
    .split("&")
    .filter(Boolean)
    .flatMap((pair) => {
      const at = pair.indexOf("=")
      const key = decode(at < 0 ? pair : pair.slice(0, at))
      if (key === "_uip" || USER_DATA.test(key)) return []
      if (!ADDRESS_PARAMS.includes(key) || at < 0) return [pair]
      const value = decode(pair.slice(at + 1))
      const clean = cleanUrl(value, ownHost)
      return [clean === value ? pair : `${pair.slice(0, at)}=${encodeURIComponent(clean)}`]
    })
}

/**
 * A GA4 hit's query string as it leaves for Google: page addresses cleaned,
 * and the reader's IP address, shortened, as `_uip` (replacing any the
 * browser sent). An address that cannot be shortened is not sent at all.
 */
export function gaQuery(search: string, forwardedFor: string | null, ownHost = ""): string {
  const pairs = cleanPairs(search.replace(/^\?/, ""), ownHost)
  const ip = shortenIp(forwardedFor)
  if (ip) pairs.push(`_uip=${encodeURIComponent(ip)}`)
  return pairs.length ? `?${pairs.join("&")}` : ""
}

/**
 * A batched GA4 hit's body as it leaves for Google. Each line is one event's
 * parameters in the query-string form; each is cleaned the way the query is.
 */
export function gaBody(body: string, ownHost = ""): string {
  return body
    .split("\n")
    .map((line) => (line ? cleanPairs(line, ownHost).join("&") : line))
    .join("\n")
}
