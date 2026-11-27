import { type NextRequest, NextResponse } from "next/server"

import { sendMessage } from "@/lib/email"
import { looksLikeEmail, NOT_AN_EMAIL } from "@/lib/email/address"
import { isEnquiryType, NO_ENQUIRY_TYPE } from "@/lib/enquiry-types"
import { letterHtml, letterText } from "@/lib/letter-body"
import { flushPostHogLogs, logContactMessageDelivered } from "@/lib/posthog-logs"
import { rateLimit } from "@/lib/rate-limit"
import { readJsonObject, textField as text } from "@/lib/request-json"
import { SITE_NAME } from "@/lib/site"

/**
 * The contact form (components/sections/contact-form.tsx) posts here, and
 * the message goes to CONTACT_TO_EMAIL through the configured email platform
 * (lib/email), with the writer's address as Reply-To so pressing reply
 * answers them. Their address is never the sender: platforms refuse
 * unverified senders, and forging a From line is what gets a domain's mail
 * marked as spam.
 *
 * Links in a message are escaped in full before any tag is added, and a
 * link's visible text is always its own destination (lib/letter-body.ts).
 * No attachments: nothing on this site accepts a file from a reader.
 *
 * A refusal says why twice: `code`, which the form turns into its own words
 * from Site Copy (`contact.form.<code>`), and `error`, in English, for
 * anybody calling this directly.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LIMITS = { name: 200, email: 320, company: 200, subject: 200, message: 10_000, type: 100 } as const

/** A field that ends up in a header (the subject, the Reply-To name): one line. */
const line = (value: unknown, max: number) => text(typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ") : value, max)

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { key: "contact", max: 5, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const fields = await readJsonObject(request)
  if (!fields) return NextResponse.json({ error: "Malformed request", code: "malformed" }, { status: 400 })

  const name = line(fields.name, LIMITS.name)
  const email = text(fields.email, LIMITS.email)
  const company = line(fields.company, LIMITS.company)
  const subject = line(fields.subject, LIMITS.subject)
  const message = text(fields.message, LIMITS.message)
  const type = text(fields.type, LIMITS.type)

  // A field no person sees; a 200 that sends nothing teaches a bot nothing.
  if (text(fields.website, 200) !== "") return NextResponse.json({ success: true })

  if (!name) return NextResponse.json({ error: "A name is required.", code: "no-name" }, { status: 400 })
  if (!looksLikeEmail(email)) return NextResponse.json({ error: NOT_AN_EMAIL, code: "bad-email" }, { status: 400 })
  if (!message) return NextResponse.json({ error: "The message is empty.", code: "empty" }, { status: 400 })
  if (!isEnquiryType(type)) return NextResponse.json({ error: NO_ENQUIRY_TYPE, code: "no-type" }, { status: 400 })

  const letter = { name, email, company, type, message }
  const result = await sendMessage({
    subject: `[${SITE_NAME}] ${subject || `Message from ${name}`}`,
    text: letterText(letter),
    html: letterHtml(letter),
    replyTo: { email, name },
  })

  if (result.status === "sent") {
    logContactMessageDelivered(type)
    await flushPostHogLogs()
    return NextResponse.json({ success: true })
  }

  if (result.status === "unconfigured") {
    if (process.env.NODE_ENV !== "production") {
      // nothing the writer typed reaches the log
      console.warn(`[contact] ${result.reason}; accepting in development without sending it`)
      return NextResponse.json({ success: true })
    }
    console.error(`[contact] cannot deliver: ${result.reason}`)
    return NextResponse.json({ error: "Messages cannot be sent from this site yet. Please try again later.", code: "not-set-up" }, { status: 503 })
  }

  console.error(`[contact] ${result.message}`)
  return NextResponse.json({ error: "The message could not be sent. Please try again.", code: "failed" }, { status: 502 })
}
