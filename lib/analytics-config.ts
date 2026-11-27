/**
 * Whether this build counts anything at all, decided at build time from the
 * two public variables. When neither is set the privacy notice says the site
 * counts nothing, and the cookie question is an example that says so.
 */
import { analyticsKey } from "./analytics"
import { GA_MEASUREMENT_ID } from "./google-analytics"
import type { SiteCopy } from "./notion/rows"
import { plainText, slotHidden } from "./slots"

/** The PostHog project key, when it is one. */
export const POSTHOG_KEY = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY)
export const POSTHOG_ON = Boolean(POSTHOG_KEY)
export const GA_ON = Boolean(GA_MEASUREMENT_ID)
export const ANALYTICS_ON = POSTHOG_ON || GA_ON

/**
 * Whether the cookie question is asked, and "Cookie settings" offered: always
 * when the site counts anything; with nothing to count, as an example, as
 * the forms are until an email platform is set, unless `cookies.example` is
 * published blank, which is how a copy that would rather not show it
 * removes it.
 */
export function asksCookies(content: SiteCopy, analyticsOn: boolean = ANALYTICS_ON): boolean {
  return analyticsOn || !slotHidden(content, "cookies.example")
}

/**
 * The shapes the cookie question can take (components/layout/cookie-notice.tsx):
 * the bag of cookies, a plain box in the middle of the screen, or a banner
 * along the bottom of it.
 */
export const COOKIE_SHAPES = ["bag", "box", "banner"] as const
export type CookieShape = (typeof COOKIE_SHAPES)[number]

/**
 * The shape the site's owner chose: the `cookies.shape` row's words, bag,
 * box or banner, in any case. No row, a blank or unticked one, or a word
 * the site doesn't know is the bag, so a typo never takes the question away.
 */
export function cookieShape(content: SiteCopy): CookieShape {
  const word = plainText(content, "cookies.shape", "bag").trim().toLowerCase()
  return (COOKIE_SHAPES as readonly string[]).includes(word) ? (word as CookieShape) : "bag"
}
