import { type NextRequest, NextResponse } from "next/server"

import { looksLikeEmail, NOT_AN_EMAIL } from "@/lib/email/address"
import { subscribe } from "@/lib/email"
import { flushPostHogLogs, logNewsletterSubscriptionAccepted } from "@/lib/posthog-logs"
import { rateLimit } from "@/lib/rate-limit"
import { readJsonObject, textField as text } from "@/lib/request-json"

/**
 * The mailing list: the footer's form posts an address and an optional
 * first name here, and it goes to whichever email platform is configured
 * (lib/email). The answer says whether the platform sent a confirmation
 * first, so the form can say "check your inbox".
 *
 * A refusal says why twice: `code`, which the form turns into its own words
 * from Site Copy (`newsletter.<code>`), and `error`, in English, for anybody
 * calling this directly.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { key: "subscribe", max: 5, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const fields = await readJsonObject(request)
  if (!fields) return NextResponse.json({ error: "Malformed request", code: "malformed" }, { status: 400 })

  // A field no person sees. Answering 200 without doing anything is
  // deliberate: telling a bot it was caught teaches it to skip the field.
  if (text(fields.website, 200) !== "") return NextResponse.json({ status: "subscribed" })

  const email = text(fields.email, 254)
  const firstName = text(fields.name, 80).replace(/[<>\r\n\t]+/g, " ").trim() || undefined
  if (!looksLikeEmail(email)) return NextResponse.json({ error: NOT_AN_EMAIL, code: "bad-email" }, { status: 400 })

  const result = await subscribe({ email, firstName })
  if (result.status === "subscribed" || result.status === "pending") {
    logNewsletterSubscriptionAccepted(result.status)
    await flushPostHogLogs()
    return NextResponse.json({ status: result.status })
  }

  if (result.status === "unconfigured") {
    if (process.env.NODE_ENV !== "production") {
      // no address in the log
      console.warn(`[subscribe] ${result.reason}; accepting in development without sending anything`)
      return NextResponse.json({ status: "subscribed" })
    }
    console.error(`[subscribe] cannot subscribe: ${result.reason}`)
    return NextResponse.json({ error: "The mailing list is not set up yet. Please try again later.", code: "not-set-up" }, { status: 503 })
  }

  console.error(`[subscribe] ${result.message}`)
  return NextResponse.json({ error: "That did not work. Please try again in a moment.", code: "failed" }, { status: 502 })
}
