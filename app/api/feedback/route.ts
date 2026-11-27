import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"

import { analyticsKey, POSTHOG_INGEST } from "@/lib/analytics"
import { feedbackSurvey, readFeedback, sendFeedback, surveyEvent } from "@/lib/feedback"
import { standIn } from "@/lib/proxy"
import { rateLimit } from "@/lib/rate-limit"
import { readJsonObject, textField } from "@/lib/request-json"
import { SITE_URL } from "@/lib/site"

/**
 * Feedback from the button in the corner (lib/feedback.ts says how it
 * reaches PostHog, and why through here). The answer is `{ status: "sent" }`,
 * or a `code` the form turns into its own words (`feedback.<code>`) with an
 * `error` in English for anybody calling it directly.
 *
 * Nothing a reader wrote is logged: a failure logs PostHog's status alone.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { key: "feedback", max: 5, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const fields = await readJsonObject(request)
  if (!fields) return NextResponse.json({ error: "Malformed request", code: "malformed" }, { status: 400 })

  // a field no person sees: a quiet success teaches a bot nothing
  if (textField(fields.website, 200) !== "") return NextResponse.json({ status: "sent" })

  const feedback = readFeedback(fields)
  if ("refused" in feedback) {
    const error = feedback.refused === "empty" ? "Write a few words first." : "Malformed request"
    return NextResponse.json({ error, code: feedback.refused }, { status: 400 })
  }

  const key = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY)
  const host = standIn(process.env.POSTHOG_PROXY_UPSTREAM) ?? POSTHOG_INGEST
  if (!key) return NextResponse.json({ error: "Feedback is not set up on this site.", code: "not-set-up" }, { status: 503 })

  try {
    const survey = await feedbackSurvey(key, host)
    if (!survey) {
      console.error("[feedback] the project has no running 'Site feedback' survey; run npm run posthog:setup")
      return NextResponse.json({ error: "Feedback is not set up on this site.", code: "not-set-up" }, { status: 503 })
    }
    await sendFeedback(key, host, surveyEvent(survey, feedback, { submissionId: randomUUID(), siteUrl: SITE_URL, userAgent: request.headers.get("user-agent") ?? undefined }))
  } catch (error) {
    // PostHog's status, never the words
    console.error(`[feedback] ${error instanceof Error ? error.message : "PostHog could not be reached"}`)
    return NextResponse.json({ error: "That did not work. Please try again in a moment.", code: "failed" }, { status: 502 })
  }
  return NextResponse.json({ status: "sent" })
}
