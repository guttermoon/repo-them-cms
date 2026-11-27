"use client"

import type React from "react"
import { useId, useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"

import { useFlag } from "@/components/hooks/use-flag"
import { capturePostHogEvent, postHogVisit } from "@/components/layout/posthog-analytics"
import { ExampleNotice } from "@/components/system/notice"
import { makeT, plainText, type SiteCopy } from "@/components/system/notion-text"
import { buttonClass } from "@/components/ui/button"
import { FEEDBACK_KINDS, type FeedbackKind, WORDS_MAX } from "@/lib/feedback"
import { THEMES } from "@/lib/theme"

/**
 * The Feedback button, in the corner of every page, and the panel it opens:
 * what it is (broken, an idea, something liked), what happened, and Send
 * (docs/feedback.md). It posts to /api/feedback, which makes it a response
 * to the "Site feedback" survey in PostHog, with the page, the look and the
 * window's size, and, for a reader who said yes in the cookie notice, the
 * visit it came from, so the agent that reads it can watch what they saw.
 *
 * Until PostHog is set up (`ready` false) it is an example, as the mailing
 * list and the contact form are until an email platform is: Send says what
 * it is and sends nothing. The `site-feedback` flag (lib/flags.ts) can take
 * the button away for readers who said yes; for everybody else it stays.
 * Publishing `feedback.button` blank removes it altogether (app/layout.tsx).
 *
 * A dialog (Radix): focus moves in and stays, Escape closes it, and focus
 * goes back to the button.
 */
export function Feedback({ content = {}, ready, icon }: { content?: SiteCopy; ready: boolean; icon?: React.ReactNode }) {
  const T = makeT(content)
  const on = useFlag("site-feedback")
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>("broken")
  const [words, setWords] = useState("")
  // bots fill every field they find, including this one nobody is shown
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)
  const [placeholder, setPlaceholder] = useState(false)
  const field = useId()
  const outcome = useRef<HTMLParagraphElement>(null)

  // every message the panel can give, read now: one gone blank would leave
  // the reader not knowing what happened
  const refusals: Record<string, string> = {
    empty: plainText(content, "feedback.empty", "Write a few words first."),
    busy: plainText(content, "feedback.busy", "That is a lot of feedback at once. Try again in a minute."),
    "not-set-up": plainText(content, "feedback.notsetup", "Feedback is not set up on this site yet."),
  }
  const failed = plainText(content, "feedback.failed", "That did not work. Try again in a moment.")
  const kinds: Record<FeedbackKind, string> = {
    broken: plainText(content, "feedback.kind.broken", "Something is broken"),
    idea: plainText(content, "feedback.kind.idea", "An idea"),
    liked: plainText(content, "feedback.kind.liked", "Something I liked"),
  }

  if (!on) return null

  const reset = () => {
    setState("idle")
    setError(null)
    setWords("")
    setKind("broken")
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) {
      // an example: the words go nowhere, not even to this site
      setPlaceholder(true)
      return
    }
    if (words.trim().length < 3) {
      setError(refusals.empty)
      return
    }
    setState("sending")
    setError(null)
    try {
      const look = THEMES.find((t) => t === document.documentElement.dataset.theme)
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          words,
          website,
          page: window.location.pathname,
          look,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          visit: await postHogVisit(),
        }),
      })
      const data = (await response.json().catch(() => ({}))) as { code?: string }
      if (!response.ok) {
        setError((data.code && refusals[data.code]) || failed)
        setState("idle")
        return
      }
      setState("sent")
      capturePostHogEvent("feedback_sent", { kind })
      requestAnimationFrame(() => outcome.current?.focus())
    } catch {
      setError(failed)
      setState("idle")
    }
  }

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next && state === "sent") reset()
        }}
      >
        <Dialog.Trigger
          className={buttonClass(
            "outline",
            "feedback-button fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-40 min-h-[44px] shadow-pop print:hidden",
          )}
        >
          {icon ? <span className="flex text-lead text-sub">{icon}</span> : null}
          {plainText(content, "feedback.button", "Feedback")}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Content
            aria-describedby={`${field}-lede`}
            className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] z-50 max-h-[calc(100dvh-32px)] w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-panel bg-card p-6 text-ink shadow-pop"
          >
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="title-slab text-head-m leading-tight">
                <T k="feedback.title">tell us what you think</T>
              </Dialog.Title>
              <Dialog.Close
                aria-label={plainText(content, "feedback.close", "Close")}
                className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sub tone hover:bg-wash hover:text-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
            <p id={`${field}-lede`} className="mt-2 text-ui leading-relaxed text-sub">
              <T k="feedback.lede">Something broken, an idea, or something you liked. It goes straight to the people who make the site.</T>
            </p>

            {state === "sent" ? (
              <div className="mt-6">
                <p ref={outcome} tabIndex={-1} role="status" className="rounded-block bg-wash px-4 py-5 text-body text-ink outline-none">
                  {plainText(content, "feedback.done", "Thank you. It is on its way to the people who make the site.")}
                </p>
                <div className="mt-5 flex justify-end">
                  <Dialog.Close className={buttonClass("primary")}>{plainText(content, "feedback.again", "Done")}</Dialog.Close>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
                <fieldset>
                  <legend className="mb-2 px-4 text-small font-medium text-ink">{plainText(content, "feedback.kind", "What is it?")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_KINDS.map((k) => (
                      <label key={k}>
                        <input type="radio" name={`${field}-kind`} value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
                        <span className="flex min-h-target cursor-pointer items-center rounded-full border border-line-strong px-4 text-small font-medium text-ink tone hover:bg-wash peer-checked:border-transparent peer-checked:bg-btn peer-checked:text-btn-ink peer-focus-visible:outline peer-focus-visible:outline-focus peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                          {kinds[k]}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="mb-1.5 block px-4 text-small font-medium text-ink">{plainText(content, "feedback.words", "What happened?")}</span>
                  <textarea
                    rows={5}
                    maxLength={WORDS_MAX}
                    value={words}
                    onChange={(e) => {
                      setWords(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder={plainText(content, "feedback.words.placeholder", "What you did, what you expected, what you saw.")}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${field}-error` : undefined}
                    className="field resize-y"
                  />
                </label>
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
                  <p id={`${field}-error`} role="alert" className="rounded-block n-bg-red px-3 py-2 text-small text-ink">
                    {error}
                  </p>
                ) : null}
                <p className="small-print">
                  {ready ? (
                    <T k="feedback.note">Sent with the page you are on, your browser, the look and the size of your window. If you said yes to cookies, also this visit, so we can see what you saw.</T>
                  ) : (
                    <T k="feedback.example">An example: this site is not collecting feedback yet, so nothing is sent.</T>
                  )}
                </p>
                <div className="flex justify-end">
                  <button type="submit" disabled={state === "sending"} className={buttonClass("primary", "min-h-[44px] disabled:opacity-60")}>
                    {state === "sending" ? plainText(content, "feedback.sending", "Sending") : plainText(content, "feedback.send", "Send")}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!ready ? (
        <ExampleNotice
          open={placeholder}
          onOpenChange={setPlaceholder}
          title={plainText(content, "feedback.placeholder.title", "Just a placeholder")}
          closeLabel={plainText(content, "feedback.placeholder.close", "Close")}
        >
          <T k="feedback.placeholder.body">This feedback form is an example: nothing was sent, and nothing was kept. To tell us something, write to</T>
        </ExampleNotice>
      ) : null}
    </>
  )
}
