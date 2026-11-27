"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"

import { useRevealOutcome } from "@/components/hooks/use-reveal"
import { capturePostHogEvent } from "@/components/layout/posthog-analytics"
import { ExampleNotice } from "@/components/system/notice"
import { makeT, plainText, type SiteCopy } from "@/components/system/notion-text"
import { SelectLine } from "@/components/system/select-line"
import { buttonClass } from "@/components/ui/button"
import { looksLikeEmail, NOT_AN_EMAIL } from "@/lib/email/address"
import { ENQUIRY_TYPES, isEnquiryType, NO_ENQUIRY_TYPE } from "@/lib/enquiry-types"

/**
 * The contact form. Posts to /api/contact and says the message was sent only
 * when the route says so. Every label is a Notion slot (`contact.form.*`).
 *
 * Until the site can send email (`ready` false), it is a placeholder and says
 * so: nothing is sent anywhere, and pressing Send opens a dialog that says
 * so and where to write instead.
 */
export function ContactForm({ content = {}, ready = true }: { content?: SiteCopy; ready?: boolean }) {
  const T = makeT(content)
  const [placeholder, setPlaceholder] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", company: "", subject: "", message: "", type: "" })
  const [website, setWebsite] = useState("")
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const outcome = useRef<HTMLParagraphElement>(null)
  useRevealOutcome(outcome, done, error)

  // every message the form can give, read now: a status or an error that went
  // blank would leave the reader not knowing what happened
  const failed = plainText(content, "contact.form.failed", "The message could not be sent. Please try again.")
  const aboutPrefix = plainText(content, "contact.form.about", "About")
  const sentWords = plainText(content, "contact.form.sent", "Sent. A person will read it.")
  const sendingWords = plainText(content, "contact.form.sending", "Sending")
  /** what the route's refusal codes mean, in the page's words */
  const refusals: Record<string, string> = {
    "bad-email": plainText(content, "contact.form.bademail", NOT_AN_EMAIL),
    "no-type": plainText(content, "contact.form.notype", NO_ENQUIRY_TYPE),
    "no-name": plainText(content, "contact.form.noname", "A name is required."),
    empty: plainText(content, "contact.form.empty", "The message is empty."),
    busy: plainText(content, "contact.form.busy", "Too many messages from here at once. Try again in a minute."),
    "not-set-up": plainText(content, "contact.form.notsetup", "Messages cannot be sent from this site yet. Please try again later."),
  }

  // `/contact?type=plan` chooses what it is about for the reader, and a
  // product's "Ask about it" adds `&about=<its slug>`, which fills in the
  // subject; read once, after hydration, and ignored unless well formed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get("type")
    if (wanted && isEnquiryType(wanted)) setForm((f) => (f.type ? f : { ...f, type: wanted }))
    const about = params.get("about")
    if (about && about.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(about)) {
      setForm((f) => (f.subject ? f : { ...f, subject: `${aboutPrefix} /shop/${about}` }))
    }
  }, [aboutPrefix])

  const set = (field: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    if (error) setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) {
      // a placeholder: the message goes nowhere, not even to this site
      setPlaceholder(true)
      return
    }
    if (!looksLikeEmail(form.email)) return setError(refusals["bad-email"])
    if (!isEnquiryType(form.type)) return setError(refusals["no-type"])
    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website }),
      })
      const data = (await response.json().catch(() => ({}))) as { code?: string }
      if (!response.ok) return setError((data.code && refusals[data.code]) || failed)
      setDone(true)
      capturePostHogEvent("contact_message_sent", { enquiry_type: form.type })
    } catch {
      setError(failed)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <p ref={outcome} tabIndex={-1} role="status" className="rounded-card border border-line bg-wash px-4 py-6 text-center text-body text-ink outline-none">
        {sentWords}
      </p>
    )
  }

  // a field's name sits over it, in line with the words inside; inside, an
  // example of what goes there, as the mailing list's fields show one
  const label = "mb-1.5 block px-4 text-small font-medium text-ink"
  const input = "field"

  return (
    <form onSubmit={submit} noValidate className="relative grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>
            {plainText(content, "contact.form.name", "Your name")}
          </span>
          <input type="text" required autoComplete="name" maxLength={200} value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder={plainText(content, "contact.form.name.hint", "Pat Generic")} className={input} />
        </label>
        <label className="block">
          <span className={label}>
            {plainText(content, "contact.form.email", "Email address")}
          </span>
          <input type="email" required autoComplete="email" maxLength={320} value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder={plainText(content, "contact.form.email.hint", "you@example.com")} className={input} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>
            {plainText(content, "contact.form.company", "Company (optional)")}
          </span>
          <input type="text" autoComplete="organization" maxLength={200} value={form.company} onChange={(e) => set("company")(e.target.value)} placeholder={plainText(content, "contact.form.company.hint", "Generic Ltd")} className={input} />
        </label>
        <div>
          <span className={label} aria-hidden="true">
            <T k="contact.form.type">What is it about?</T>
          </span>
          <SelectLine
            value={form.type}
            onChange={set("type")}
            options={ENQUIRY_TYPES.map((t) => ({ value: t.value, label: plainText(content, `contact.form.type.${t.value}`, t.label) }))}
            placeholder={plainText(content, "contact.form.type.placeholder", "Choose one")}
            label={plainText(content, "contact.form.type.label", "What is it about? (required)")}
          />
        </div>
      </div>
      <label className="block">
        <span className={label}>
          {plainText(content, "contact.form.subject", "Subject (optional)")}
        </span>
        <input type="text" maxLength={200} value={form.subject} onChange={(e) => set("subject")(e.target.value)} placeholder={plainText(content, "contact.form.subject.hint", "A question about delivery")} className={input} />
      </label>
      <label className="block">
        <span className={label}>
          {plainText(content, "contact.form.message", "Message")}
        </span>
        <textarea required rows={7} maxLength={10_000} value={form.message} onChange={(e) => set("message")(e.target.value)} placeholder={plainText(content, "contact.form.message.hint", "What you need, in sentences. A person reads every one.")} className={`${input} resize-y`} />
      </label>

      {/* A field no person sees or fills: bots fill every field they find. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {plainText(content, "contact.form.honeypot", "Leave this empty")}
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {error ? (
        <p ref={outcome} tabIndex={-1} role="alert" className="rounded-block n-bg-red px-3 py-2 text-small text-ink outline-none">
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={sending} className={buttonClass("primary", "disabled:opacity-60")}>
          {sending ? sendingWords : plainText(content, "contact.form.send", "Send it")}
        </button>
      </div>

      {!ready ? (
        <>
          <p className="text-small text-sub">
            <T k="contact.form.placeholder.note">An example form: it sends nothing until the site is connected to an email platform.</T>
          </p>
          <ExampleNotice
            open={placeholder}
            onOpenChange={setPlaceholder}
            title={plainText(content, "contact.form.placeholder.title", "Just a placeholder")}
            closeLabel={plainText(content, "contact.form.placeholder.close", "Close")}
          >
            <T k="contact.form.placeholder.body">This form is an example: nothing was sent, and nothing was kept. To get in touch, write to</T>
          </ExampleNotice>
        </>
      ) : null}
    </form>
  )
}
