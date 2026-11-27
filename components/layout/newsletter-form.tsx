"use client"

import type React from "react"
import { useRef, useState } from "react"

import { useRevealOutcome } from "@/components/hooks/use-reveal"
import { capturePostHogEvent } from "@/components/layout/posthog-analytics"
import { ExampleNotice } from "@/components/system/notice"
import { makeT, plainText, type SiteCopy } from "@/components/system/notion-text"
import { buttonClass } from "@/components/ui/button"
import { looksLikeEmail, NOT_AN_EMAIL } from "@/lib/email/address"

/**
 * The mailing list: a first name (optional), an address, and a button. It
 * posts to /api/subscribe, which hands the address to whichever email
 * platform the site is configured with (lib/email). It says it worked only
 * when the route says so, and says "check your inbox" when the platform
 * sends a confirmation first.
 *
 * Until an email platform is set (`ready` false), it is a placeholder and
 * says so: it sends nothing anywhere, and pressing the button opens a
 * dialog that says nothing was sent or kept, and where to write instead.
 */
export function NewsletterForm({ content = {}, ready = true }: { content?: SiteCopy; ready?: boolean }) {
  const T = makeT(content)
  const [placeholder, setPlaceholder] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  // bots fill every field they find, including this one nobody is shown
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "subscribed" | "pending">("idle")
  const [error, setError] = useState<string | null>(null)
  const outcome = useRef<HTMLParagraphElement>(null)
  useRevealOutcome(outcome, state === "subscribed" || state === "pending", error)

  // every message the form can give, read now: a status or an error that went
  // blank would leave the reader not knowing what happened
  const failed = plainText(content, "newsletter.failed", "That did not work. Try again in a moment.")
  const pendingWords = plainText(content, "newsletter.pending", "Check your inbox. One click confirms it.")
  const doneWords = plainText(content, "newsletter.done", "You are on the list.")
  const sendingWords = plainText(content, "newsletter.sending", "Sending")
  /** what the route's refusal codes mean, in the page's words */
  const refusals: Record<string, string> = {
    "bad-email": plainText(content, "newsletter.bademail", NOT_AN_EMAIL),
    busy: plainText(content, "newsletter.busy", "Too many sign-ups from here at once. Try again in a minute."),
    "not-set-up": plainText(content, "newsletter.notsetup", "The mailing list is not set up yet. Please try again later."),
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) {
      // a placeholder: the address goes nowhere, not even to this site
      setPlaceholder(true)
      return
    }
    if (!looksLikeEmail(email)) {
      setError(refusals["bad-email"])
      return
    }
    setState("sending")
    setError(null)
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, website }),
      })
      const data = (await response.json().catch(() => ({}))) as { status?: string; code?: string }
      if (!response.ok) {
        setError((data.code && refusals[data.code]) || failed)
        setState("idle")
        return
      }
      const status = data.status === "pending" ? "pending" : "subscribed"
      setState(status)
      capturePostHogEvent("newsletter_subscription_completed", { status })
    } catch {
      setError(failed)
      setState("idle")
    }
  }

  if (state === "subscribed" || state === "pending") {
    return (
      <p ref={outcome} tabIndex={-1} className="text-ui text-ink outline-none" role="status">
        {state === "pending" ? pendingWords : doneWords}
      </p>
    )
  }


  return (
    <form onSubmit={submit} noValidate className="w-full">
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <label className="block">
          <span className="sr-only">
            <T k="newsletter.name">First name (optional)</T>
          </span>
          <input
            type="text"
            name="name"
            autoComplete="given-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={plainText(content, "newsletter.name.placeholder", "First name")}
            className="field"
          />
        </label>
        <label className="block">
          <span className="sr-only">
            <T k="newsletter.email">Email address</T>
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder={plainText(content, "newsletter.email.placeholder", "you@example.com")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "newsletter-error" : undefined}
            className="field"
          />
        </label>
        <button type="submit" disabled={state === "sending"} className={buttonClass("primary", "min-h-[44px] disabled:opacity-60")}>
          {state === "sending" ? sendingWords : plainText(content, "newsletter.button", "Subscribe")}
        </button>
      </div>
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      {error ? (
        <p ref={outcome} id="newsletter-error" tabIndex={-1} role="alert" className="mt-2 text-fine text-[color:var(--n-red)] outline-none">
          {error}
        </p>
      ) : null}
      {!ready ? (
        <>
          <p className="mt-2 text-fine text-sub">
            <T k="newsletter.placeholder.note">An example form: it sends nothing until the site is connected to an email platform.</T>
          </p>
          <ExampleNotice
            open={placeholder}
            onOpenChange={setPlaceholder}
            title={plainText(content, "newsletter.placeholder.title", "Just a placeholder")}
            closeLabel={plainText(content, "newsletter.placeholder.close", "Close")}
          >
            <T k="newsletter.placeholder.body">This mailing list is an example: nothing was sent, and nothing was kept. To get in touch, write to</T>
          </ExampleNotice>
        </>
      ) : null}
    </form>
  )
}
