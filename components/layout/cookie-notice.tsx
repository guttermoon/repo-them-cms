"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

import { useBeforePaint } from "@/components/hooks/use-before-paint"
import { makeT, type SiteCopy } from "@/components/system/notion-text"
import { buttonClass } from "@/components/ui/button"
import type { CookieShape } from "@/lib/analytics-config"
import { CONSENT_KEY, EXAMPLE_CONSENT_KEY, onConsentChange, readConsent, writeConsent } from "@/lib/consent"
import { bagBulge, bagOutline } from "@/components/illustrations/geometry"
import { fitSize, TITLE_FIT } from "@/lib/fit-text"
import { SITE_LANGUAGE } from "@/lib/site"


/**
 * The cookie question, in the shape the site's owner chose in Notion
 * (`cookies.shape`, lib/analytics-config.ts), the same words in each:
 *
 *  - bag (the default): a bag of cookies in the middle of the screen, the
 *    same pouch as the bag on the shelf (`bagOutline`), its seal crimped
 *    across the top, its sides bulging, the band across its face under the
 *    word. The bag is drawn at whatever size its words make it, in the
 *    look's own colours, and the words and buttons are the page's own, over
 *    it. "cookies" fills the face from edge to edge (lib/fit-text.ts),
 *    whatever it says and however wide the screen. The pack's own label
 *    (`cookies.kind`) is printed on it alone.
 *  - box: a plain panel in the middle of the screen.
 *  - banner: a bar along the bottom of the screen, the width of the page.
 *    It holds nothing back: the page stays usable and undimmed behind it,
 *    since nothing is counted until a yes, and room is left under the page
 *    so the bar never covers its end.
 *
 * The bag and the box dim the page behind them while they ask.
 *
 * Asked until it is answered. With no analytics set up it is an example
 * (`example`), as the mailing list and the contact form are until an email
 * platform is: it says nothing is counted whatever the answer, keeps that
 * answer apart from a real one (EXAMPLE_CONSENT_KEY), and a copy removes
 * it by publishing `cookies.example` blank (app/layout.tsx). The rules it
 * keeps:
 *
 *  - Analytics is opt-in: nothing is counted until "Yes", so the bag asks
 *    rather than informs, and says what a yes turns on.
 *  - The two answers are identical in size, weight, type and fill: both
 *    the main button, so each reads as a button and neither is the
 *    "obvious" one. Yes comes first, as the question asks it and as
 *    GOV.UK's cookie banner sets it; not on the right, where a hand used
 *    to OK goes by habit, since consent is a choice, not a reflex.
 *  - Focus goes to the question, not a button, so Return is never an answer
 *    the reader did not give. In the bag and the box, Tab stays inside
 *    while it is open, and a click on the dimmed page neither answers nor
 *    takes focus out of it; the banner holds nothing, so Tab goes on to the
 *    page.
 *  - Escape answers no. A dismissal is never read as permission.
 *  - Nothing renders on the server: the server cannot know what this
 *    browser chose, and drawing it there would flash the bag at everybody
 *    who already answered.
 */
/** What Escape closes before it answers: an open menu, list or dialog. */
const POPUPS = '[role="dialog"], [role="menu"], [role="listbox"], [data-menu]'

/** The seal's height on the cookie bag: fixed, so the words below it never
 *  move as the bag grows. */
const SEAL = 30

/**
 * The bag behind the question, at the size its words make it (`w` by `h`),
 * with the band across it `band` from the top. Its face and band are
 * clipped to the pouch, and its shadow falls back and to the right
 * (`.cookie-bag-face`); the outline and the crimped seal are drawn over
 * them. Decoration: the dialog's own words say what it is.
 */
function CookieBag({ w, h, band }: { w: number; h: number; band: number }) {
  // the pouch bulges out by bagBulge and its base rounds down by half that:
  // set in by as much, so the whole bag stays inside the dialog's box
  const inset = Math.ceil(bagBulge(w))
  const { seal, body, crimps } = bagOutline(inset, 0, w - 2 * inset, h - inset, SEAL)
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="cookie-bag-shadow absolute inset-0">
        <div className="cookie-bag-face absolute inset-0" style={{ clipPath: `path("${body}")` }}>
          <span className="stripe stripe-lg absolute inset-x-0" style={{ top: band }} />
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="absolute inset-0 overflow-visible" focusable="false">
        <path d={body} className="cookie-bag-edge" fill="none" strokeWidth="1.5" strokeLinejoin="round" />
        {/* the seal, pressed flat and crimped */}
        <path d={`M${inset + 4},0H${w - inset - 4}V${seal}H${inset + 4}Z`} className="cookie-bag-seal" strokeWidth="1.5" />
        <g className="cookie-bag-crimp" strokeWidth="2">
          {crimps.map((x) => (
            <path key={x} d={`M${x},4V${seal - 4}`} />
          ))}
        </g>
      </svg>
    </div>
  )
}

export function CookieNotice({
  content = {},
  shape = "bag",
  posthog,
  google,
  example = false,
}: {
  content?: SiteCopy
  /** the shape the question takes (`cookies.shape`) */
  shape?: CookieShape
  posthog: boolean
  google: boolean
  /** no analytics is set up: the question only shows how it looks */
  example?: boolean
}) {
  const T = makeT(content)
  const [asking, setAsking] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const word = useRef<HTMLSpanElement>(null)
  const bag = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  // the bag's drawing, at the size its words make it
  const [drawn, setDrawn] = useState<{ w: number; h: number; band: number } | null>(null)
  // the banner's height, kept free under the page
  const [room, setRoom] = useState(0)
  const modal = shape !== "banner"
  const key = example ? EXAMPLE_CONSENT_KEY : CONSENT_KEY

  useEffect(() => {
    setAsking(readConsent(key) === null)
    // the footer's "Cookie settings" clears the answer, which brings this back
    return onConsentChange((value) => setAsking(value === null), key)
  }, [key])

  // "cookies" as large as the face of the bag allows: measured at the
  // largest size, then scaled to the line's width; again when the bag
  // changes width, and once the face has loaded
  useBeforePaint(() => {
    const words = word.current
    const line = words?.parentElement
    if (!asking || shape !== "bag" || !words || !line) return
    const fit = () => {
      words.style.whiteSpace = "nowrap"
      words.style.fontSize = `${TITLE_FIT.max}px`
      const size = fitSize(words.getBoundingClientRect().width, TITLE_FIT.max, line.clientWidth)
      if (size === null) {
        words.style.fontSize = ""
        words.style.whiteSpace = ""
        return
      }
      words.style.fontSize = `${size}px`
      // words too long for one line even at the floor wrap there instead
      words.style.whiteSpace = size === TITLE_FIT.min ? "normal" : "nowrap"
    }
    fit()
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit)
    resized?.observe(line)
    void document.fonts?.ready.then(fit)
    return () => resized?.disconnect()
  }, [asking, shape])

  // the bag, drawn at the size the words make it: again whenever that
  // changes (the word fitted, the screen turned, a row reworded)
  useBeforePaint(() => {
    const node = bag.current
    if (!asking || shape !== "bag" || !node) return
    const measure = () => {
      const w = node.offsetWidth
      const h = node.offsetHeight
      const top = band.current ? band.current.getBoundingClientRect().top - node.getBoundingClientRect().top : 0
      setDrawn((was) => (!w || !h ? null : was && was.w === w && was.h === h && was.band === top ? was : { w, h, band: top }))
    }
    measure()
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    resized?.observe(node)
    return () => resized?.disconnect()
  }, [asking, shape])

  // the banner's height, left free at the end of the page so its last
  // words can be scrolled above the bar
  useBeforePaint(() => {
    const node = card.current
    if (!asking || shape !== "banner" || !node) return
    const measure = () => setRoom(node.offsetHeight)
    measure()
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    resized?.observe(node)
    return () => resized?.disconnect()
  }, [asking, shape])

  /** What had focus when the question appeared (the footer's link, on a
   *  second asking), to give it back when the question goes. */
  const before = useRef<HTMLElement | null>(null)

  const answer = useCallback(
    (value: "accepted" | "rejected") => {
      writeConsent(value, key)
      setAsking(false)
      const back = before.current
      before.current = null
      if (back?.isConnected && back !== document.body) back.focus()
    },
    [key],
  )

  useEffect(() => {
    if (!asking) return
    const node = card.current
    before.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape closing something else is an answer to that: outside the
        // bag or box anything; with the banner, an open menu, list or dialog
        const target = e.target instanceof Element && e.target !== document.body && e.target !== document.documentElement ? e.target : null
        const elsewhere = target !== null && !node?.contains(target) && (modal || target.closest(POPUPS) !== null)
        if (e.defaultPrevented || elsewhere) return
        e.preventDefault()
        answer("rejected")
        return
      }
      // the banner holds nothing: Tab goes on to the page
      if (e.key !== "Tab" || !node || !modal) return
      const focusable = node.querySelectorAll<HTMLElement>("a[href], button")
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [asking, answer, modal])

  if (!asking) return null

  // the tools' own names, listed in the site's language ("A and B")
  const tools = new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" }).format([posthog ? "PostHog" : "", google ? "Google Analytics" : ""].filter(Boolean))
  // one class for both answers (see above)
  const BUTTON = buttonClass("primary", "min-h-[44px] flex-1")

  // the same words and answers in every shape
  const question = (className: string) => (
    <p id="cookie-body" className={`text-ui leading-relaxed text-ink ${className}`}>
      <T k="cookies.body">May we count visits? It tells us which pages get read, what gets pressed and what breaks. Nothing is counted until you say yes, and no is just as easy.</T>
    </p>
  )
  // the side of the pack: its contents and where they go
  const label = (className: string) => (
    <p className={`small-print ${className}`}>
      <T k="cookies.weight">Net wt: 0 trackers until you say yes.</T>{" "}
      {example ? (
        <T k="cookies.example">An example: this site counts nothing yet, whatever you answer.</T>
      ) : (
        <>
          <T k="cookies.tools">Counted with</T> {tools}, <T k="cookies.through">through this site.</T>
        </>
      )}
    </p>
  )
  const answers = (className: string) => (
    <div className={`flex gap-2 ${className}`}>
      <button type="button" className={BUTTON} onClick={() => answer("accepted")}>
        <T k="cookies.yes">Yes</T>
      </button>
      <button type="button" className={BUTTON} onClick={() => answer("rejected")}>
        <T k="cookies.no">No</T>
      </button>
    </div>
  )
  const more = (className: string) => (
    <p className={`text-fine text-sub ${className}`}>
      <Link href="/privacy#cookies" className="n-link inline-flex min-h-target items-center">
        <T k="cookies.more">What we count</T>
      </Link>
    </p>
  )
  const dialog = {
    ref: card,
    role: "dialog",
    "aria-modal": modal,
    "aria-labelledby": "cookie-title",
    "aria-describedby": "cookie-body",
    tabIndex: -1,
    "data-cookie-shape": shape,
  } as const

  if (shape === "banner") {
    return (
      <>
        <div {...dialog} className="fixed inset-x-0 bottom-0 z-50 max-h-[100dvh] overflow-y-auto border-t border-line bg-card text-ink shadow-pop outline-none print:hidden">
          <div className="mx-auto flex w-full max-w-wide flex-col gap-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 sm:px-8 md:flex-row md:items-end md:gap-10">
            <div className="min-w-0 flex-1">
              <p id="cookie-title" className="title-slab text-head-s leading-tight">
                <T k="cookies.title">cookies</T>
              </p>
              {question("mt-1")}
              {label("mt-2")}
            </div>
            <div className="flex shrink-0 flex-col gap-2 md:w-[280px]">
              {answers("")}
              {more("")}
            </div>
          </div>
        </div>
        {/* room under the page, as tall as the bar */}
        <div aria-hidden="true" style={{ height: room }} />
      </>
    )
  }

  return (
    <div
      className="cookie-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      // a click on the dimmed page is not an answer, and must not move focus
      // out of the question (the Tab trap above keeps it there from then on)
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault()
      }}
    >
      {shape === "box" ? (
        <div {...dialog} className="w-full max-w-[440px] rounded-panel border border-line bg-card p-6 text-ink shadow-pop outline-none sm:p-8">
          <p id="cookie-title" className="title-slab text-head-l leading-tight">
            <T k="cookies.title">cookies</T>
          </p>
          {question("mt-3")}
          {label("mt-3")}
          {answers("mt-6")}
          {more("mt-3")}
        </div>
      ) : (
        <div ref={bag} data-pack="bag" className="cookie-bag relative w-full max-w-[400px]">
          {drawn ? <CookieBag {...drawn} /> : null}
          <div {...dialog} className="relative outline-none">
            {/* clear of the seal above and the bulging sides */}
            <div className="px-9 pb-10" style={{ paddingTop: SEAL + 24 }}>
              <p className="eyebrow text-fine">
                <T k="cookies.kind">generic, assorted</T>
              </p>
              <p id="cookie-title" className="title-slab title-display mt-1 text-display !leading-[0.95]">
                {/* fit-word: no transition, so the size the fit sets is the size it reads */}
                <span ref={word} className="fit-word inline-block">
                  <T k="cookies.title">cookies</T>
                </span>
              </p>
              {/* where the band runs across the bag (CookieBag draws it) */}
              <div ref={band} aria-hidden="true" className="-mx-9 mt-4 h-[28px]" />
              {question("mt-4")}
              {label("mt-3")}
              {answers("mt-4")}
              {more("mt-3")}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
