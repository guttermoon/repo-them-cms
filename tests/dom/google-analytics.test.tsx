// Google Analytics 4 in the browser (components/layout/google-analytics.tsx)
// and where it is described (the cookie question, the privacy notice):
// nothing before a yes, nothing after a no, its cookies gone on a no, and not
// a word about it anywhere while there is no measurement ID.
import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { CONSENT_KEY } from "@/lib/consent"
import { checkWords } from "./support/checks"

const ID = "G-TEST1234"
type Gtag = Window & { dataLayer?: IArguments[] } & Record<string, unknown>

/** The modules afresh, with or without a measurement ID: it is read when
 *  lib/google-analytics.ts loads, as Next reads it at build time. */
async function load(id: string | undefined) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", id ?? "")
  vi.stubEnv("NOTION_TOKEN", "")
  vi.stubEnv("NOTION_DATABASE_ID", "")
  const consent = await import("@/lib/consent")
  const { GoogleAnalytics } = await import("@/components/layout/google-analytics")
  const { GA_ON } = await import("@/lib/analytics-config")
  return { ...consent, GoogleAnalytics, GA_ON }
}

const gaScripts = () => [...document.querySelectorAll<HTMLScriptElement>("script[src*='/ga/gtag/js']")]

beforeEach(() => {
  for (const s of gaScripts()) s.remove()
  const w = window as unknown as Gtag
  delete w.dataLayer
  delete w[`ga-disable-${ID}`]
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("the loader", () => {
  test("nothing before an answer: no script, no queue", async () => {
    const { GoogleAnalytics } = await load(ID)
    render(<GoogleAnalytics />)
    expect(gaScripts()).toHaveLength(0)
    expect((window as unknown as Gtag).dataLayer).toBeUndefined()
  })

  test("a yes loads Google's script from this site, set up to send to this site", async () => {
    const { GoogleAnalytics, writeConsent } = await load(ID)
    render(<GoogleAnalytics />)
    act(() => writeConsent("accepted"))
    const [script] = gaScripts()
    expect(script.getAttribute("src")).toBe(`/ga/gtag/js?id=${ID}`)
    const queue = ((window as unknown as Gtag).dataLayer ?? []).map((args) => [...args])
    expect(queue.map((args) => args[0])).toEqual(["consent", "set", "js", "config"])
    expect(queue[0]).toEqual(["consent", "default", expect.objectContaining({ ad_storage: "denied", analytics_storage: "granted" })])
    // the address is set globally, before the tag starts: Google's script can
    // ignore one given only in the config and send straight to Google
    const settings = { transport_url: `${window.location.origin}/ga`, allow_google_signals: false, allow_ad_personalization_signals: false }
    expect(queue[1][1]).toMatchObject(settings)
    expect(queue[3][1]).toBe(ID)
    expect(queue[3][2]).toMatchObject(settings)
  })

  test("a stored yes starts it on the next visit; a stored no never loads it", async () => {
    let mod = await load(ID)
    localStorage.setItem(CONSENT_KEY, "accepted")
    render(<mod.GoogleAnalytics />)
    expect(gaScripts()).toHaveLength(1)

    for (const s of gaScripts()) s.remove()
    mod = await load(ID)
    localStorage.setItem(CONSENT_KEY, "rejected")
    render(<mod.GoogleAnalytics />)
    expect(gaScripts()).toHaveLength(0)
  })

  test("a no after a yes switches it off and deletes its cookies, and only its own", async () => {
    const { GoogleAnalytics, writeConsent } = await load(ID)
    render(<GoogleAnalytics />)
    act(() => writeConsent("accepted"))
    document.cookie = "_ga=GA1.1.123; path=/"
    document.cookie = "_ga_TEST1234=GS1.1.456; path=/"
    document.cookie = "keep=me; path=/"
    act(() => writeConsent("rejected"))
    expect((window as unknown as Gtag)[`ga-disable-${ID}`]).toBe(true)
    expect(document.cookie).not.toMatch(/_ga/)
    expect(document.cookie).toMatch(/keep=me/)
    document.cookie = "keep=; Max-Age=0; path=/"
  })

  test("without a measurement ID, a yes loads nothing", async () => {
    const { GoogleAnalytics, writeConsent } = await load(undefined)
    render(<GoogleAnalytics />)
    act(() => writeConsent("accepted"))
    expect(gaScripts()).toHaveLength(0)
  })
})

describe("what the reader is told", () => {
  test("the cookie question names Google Analytics only where it runs", async () => {
    for (const [id, shown] of [
      [ID, true],
      [undefined, false],
    ] as const) {
      const { GA_ON } = await load(id)
      expect(GA_ON).toBe(shown)
      const { CookieNotice } = await import("@/components/layout/cookie-notice")
      const { container, unmount } = render(<CookieNotice posthog google={GA_ON} />)
      expect(container.textContent?.includes("Google Analytics")).toBe(shown)
      unmount()
      localStorage.clear()
    }
  })

  test("the privacy notice describes it, its cookies and where Google may take the data, only where it runs", async () => {
    for (const [id, shown] of [
      [ID, true],
      [undefined, false],
    ] as const) {
      await load(id)
      const { default: Privacy } = await import("@/app/privacy/page")
      const { container, unmount } = render(await Privacy())
      const text = container.textContent ?? ""
      expect(text.includes("Google Analytics")).toBe(shown)
      expect(text.includes("_ga_TEST1234")).toBe(shown)
      expect(text.includes("Google may handle what it receives in the United States")).toBe(shown)
      if (shown) {
        expect(text).toMatch(/13\s*months/)
        const policy = [...container.querySelectorAll("a")].find((a) => a.textContent === "Google's privacy policy")
        expect(policy?.getAttribute("href")).toBe("https://policies.google.com/privacy")
        checkWords(container)
      } else {
        expect(text).toContain("This site counts nothing.")
      }
      unmount()
    }
  })
})
