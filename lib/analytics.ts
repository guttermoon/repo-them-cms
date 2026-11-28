import type { CaptureResult, PostHogConfig } from "posthog-js"

/**
 * PostHog, off unless a project key is set, and opt-in when it is on.
 *
 * ── Opt-in ──
 * Nothing of PostHog's loads before the reader says yes in the cookie
 * notice: no script, no cookie, no request (components/layout/
 * posthog-analytics.tsx). A later no stops it and deletes its cookie and
 * identifier. A template used in every country defaults to the strictest
 * reading of the law, and a fork that wants less can loosen it knowingly.
 *
 * ── Off without a key ──
 * NEXT_PUBLIC_POSTHOG_KEY turns it on (read at build time). There is no key
 * in the code: a fork never counts into somebody else's project.
 *
 * ── What keeps names out ──
 * - Everything goes through this site (`/ingest`, app/ingest), which shortens
 *   the reader's IP address before PostHog sees it (`shortenIp()`). A route
 *   handler rather than a rewrite, because a rewrite passes the platform's
 *   x-forwarded-for, the full address, straight on.
 * - Page addresses lose every query parameter but the campaign tags before
 *   they are sent (`scrubEvent()`), recordings' meta events included.
 * - Replay hides what is typed into every form (PostHog's default).
 * - No person profiles: the site never identifies anybody.
 *
 * Nothing here imports posthog-js at run time (the import above is a type),
 * so `npm test` can load it. tests/analytics.test.mjs pins every rule.
 */

/** Where the browser sends everything: this site, never PostHog. */
export const PROXY_PATH = "/ingest"

/** PostHog's two clouds. The project's region decides which: events sent to
 *  the other one are dropped. NEXT_PUBLIC_POSTHOG_REGION, "eu" unless "us". */
const REGIONS = {
  eu: { ingest: "https://eu.i.posthog.com", assets: "https://eu-assets.i.posthog.com", ui: "https://eu.posthog.com" },
  us: { ingest: "https://us.i.posthog.com", assets: "https://us-assets.i.posthog.com", ui: "https://us.posthog.com" },
} as const

export function posthogRegion(raw: string | undefined = process.env.NEXT_PUBLIC_POSTHOG_REGION): (typeof REGIONS)["eu" | "us"] {
  return raw?.trim().toLowerCase() === "us" ? REGIONS.us : REGIONS.eu
}

/** Whether the project is in PostHog's EU cloud, which the privacy notice says. */
export const POSTHOG_IN_EU = posthogRegion() === REGIONS.eu
export const POSTHOG_INGEST = posthogRegion().ingest
export const POSTHOG_ASSETS = posthogRegion().assets
export const POSTHOG_UI = posthogRegion().ui

/**
 * The key PostHog runs under, or null for none: NEXT_PUBLIC_POSTHOG_KEY when
 * it looks like a project key ("phc_…"), nothing when it is unset, "off" or
 * anything else. A placeholder left in a copied .env file turns nothing on.
 */
export function analyticsKey(envKey: string | undefined): string | null {
  const set = envKey?.trim()
  return set && /^phc_[A-Za-z0-9]{10,}$/.test(set) ? set : null
}

/** The cookie PostHog keeps after a yes, named in the privacy notice: one
 *  per project, `ph_<its key>_posthog`. */
export function posthogCookieName(key: string): string {
  return `ph_${key}_posthog`
}

/** What PostHog's support chat keeps in the browser after a yes, named in
 *  the privacy notice: one item per project, `ph_conv_<its key>`, holding the
 *  conversation a reader started and the name and email they typed into it.
 *  PostHog's own opt-out leaves it, so a no deletes it here. */
export function posthogChatStorageName(key: string): string {
  return `ph_conv_${key}`
}

/** The options PostHog is started with: its defaults, and the things this
 *  site needs on top of them. */
export function posthogOptions(apiHost: string = PROXY_PATH): Partial<PostHogConfig> {
  return {
    // through this site, which shortens the IP address on the way
    api_host: apiHost,
    ui_host: POSTHOG_UI,
    // every feature at PostHog's defaults of this date; replay and the rest
    // are switched on or off in the project's settings
    defaults: "2026-08-30",
    // unhandled browser errors and rejected promises feed Error Tracking;
    // console output is not an error-monitoring signal for this site
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    // a random identifier, and no stored profile for anybody: the site never
    // calls identify, and the 2026 defaults' habit of tagging a localhost
    // visit as an internal user (which starts a profile) is off
    person_profiles: "identified_only",
    internal_or_test_user_hostname: null,
    // a no deletes PostHog's cookie and identifier, not just the sending
    opt_out_persistence_by_default: true,
    // names and email addresses out of page addresses, recordings included
    before_send: scrubEvent,
  }
}

// ── page addresses ──────────────────────────────────────────────────────────

/** The only query parameters that survive: campaign tags, and the contact
 *  form's enquiry type. Everything else is dropped, whatever it is called,
 *  so a parameter added to a page later cannot leak by default. */
export const KEPT_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "type"]

/**
 * A page address with nothing that could name anybody in it.
 *
 * Our own pages keep their path and the parameters in KEPT_PARAMS. Another
 * site's (a referrer) keeps only its origin and path, since its query is
 * nothing of ours to pass on. The fragment goes everywhere. Anything that is
 * not a full http(s) address comes back unchanged.
 */
export function cleanUrl(value: string, ownHost: string = typeof window !== "undefined" ? window.location.hostname : ""): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return value
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return value
  // nothing to take out: the original, untouched (URL would add a slash)
  if (!url.search && !url.hash) return value
  const host = url.hostname.toLowerCase()
  const ours = (ownHost && host === ownHost.toLowerCase()) || host === "localhost" || host === "127.0.0.1"
  const kept = new URLSearchParams()
  if (ours) for (const [k, v] of url.searchParams) if (KEPT_PARAMS.includes(k)) kept.append(k, v)
  const query = kept.toString()
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`
}

/** Every string in an event's properties that is an address, cleaned. */
function cleanProps(props: Record<string, unknown> | undefined): void {
  if (!props) return
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) props[key] = cleanUrl(value)
  }
}

/** rrweb's meta (4) and custom (5) events carry the page address: the meta
 *  event in `data.href`, and PostHog's own custom events (`$json_ld`, among
 *  others) wherever they like. Both are cleaned all the way down. The page
 *  itself (full and incremental snapshots) is left as recorded: its only
 *  links with a name in them are in the panels that carry `ph-no-capture`. */
const RRWEB_META = 4
const RRWEB_CUSTOM = 5

/** Every http(s) string in a recording event, at any depth, cleaned. */
function cleanDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? cleanUrl(value) : value
  if (depth > 8 || !value || typeof value !== "object") return value
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = cleanDeep(value[i], depth + 1)
    return value
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) record[key] = cleanDeep(record[key], depth + 1)
  return record
}

/**
 * PostHog's `before_send`: every event, cleaned, just before it leaves.
 * Addresses in the properties and in `$set`/`$set_once`; for a recording,
 * the address each of its meta events carries.
 */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event
  cleanProps(event.properties)
  cleanProps(event.$set)
  cleanProps(event.$set_once)
  const snapshots = event.properties?.$snapshot_data
  if (Array.isArray(snapshots)) {
    for (const s of snapshots) {
      if (s && typeof s === "object" && (s.type === RRWEB_META || s.type === RRWEB_CUSTOM)) cleanDeep(s.data)
    }
  }
  return event
}

// ── the proxy ───────────────────────────────────────────────────────────────

/**
 * The reader's IP address, shortened before it is passed on: IPv4 to its
 * first three parts (a block of 256 addresses), IPv6 to its first three
 * groups (a network, never a household). Enough for PostHog to tell roughly
 * where a visit came from, not enough to point at anybody's connection.
 * Null for anything that is not an address.
 */
export function shortenIp(raw: string | null | undefined): string | null {
  // the first address in a forwarded list is the reader's; an IPv4 address
  // written the IPv6 way (::ffff:1.2.3.4) is shortened as the IPv4 it is
  const ip = raw?.split(",")[0]?.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "")
  if (!ip) return null
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const parts = v4.slice(1, 4).map(Number)
    if (parts.some((n) => n > 255) || Number(v4[4]) > 255) return null
    return `${parts.join(".")}.0`
  }
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) {
    const [head] = ip.split("::")
    const groups = head ? head.split(":") : []
    const first = [...groups, "0", "0", "0"].slice(0, 3).map((g) => g || "0")
    return `${first.join(":")}::`
  }
  return null
}

/** The first part of the path PostHog's browser library calls under the
 *  proxy. Anything else is refused, so /ingest is never an open proxy. */
const INGEST_ROOTS = ["e", "s", "i", "flags", "decide", "batch", "engage", "capture", "track", "api"]
const ASSET_ROOTS = ["static", "array"]

/**
 * Where a request to /ingest/<path> goes at PostHog, or null to refuse it.
 * `path` is everything after "/ingest/", trailing slash and all (PostHog's
 * endpoints keep theirs), without the query string.
 *
 * `array/<key>/…` is a project's own configuration, and with it the scripts
 * its owner added in PostHog (site apps): this site's project's only, `key`,
 * so no other project's scripts are ever served from this site's address.
 */
export function posthogUpstreamFor(
  path: string,
  hosts: { ingest: string; assets: string } = { ingest: POSTHOG_INGEST, assets: POSTHOG_ASSETS },
  key: string | null = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY),
): string | null {
  if (!/^[A-Za-z0-9._~\-/]+$/.test(path) || path.split("/").some((p) => p === "..")) return null
  const [root, project] = path.split("/")
  if (root === "array" && (!key || project !== key)) return null
  if (ASSET_ROOTS.includes(root)) return `${hosts.assets}/${path}`
  if (INGEST_ROOTS.includes(root)) return `${hosts.ingest}/${path}`
  return null
}
