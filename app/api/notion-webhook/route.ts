import { revalidatePath, revalidateTag } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { notionWebhookSecret } from "@/lib/config"
import { NOTION_TAG } from "@/lib/content/store"
import { rateLimit } from "@/lib/rate-limit"
import { notionSignature, secretMatches } from "@/lib/secret"

/**
 * Notion's integration webhooks: the site refreshes within seconds of a
 * page being changed in Notion.
 *
 * Setting it up (Notion → the integration → Webhooks): point a subscription
 * at https://<your site>/api/notion-webhook. Notion then POSTs a one-time
 * `verification_token` here, which is written to the server log; paste it
 * into Notion to verify the subscription, and set it as NOTION_WEBHOOK_SECRET.
 * From then on every event carries `X-Notion-Signature`, an HMAC of the raw
 * body keyed with that token, and an event without a matching one is
 * refused. Events carry IDs only, so any event about the database refreshes
 * the whole content cache, which costs one Notion query.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** What a verification token is made of: no spaces, no line breaks. */
const TOKEN_SHAPE = /^[\w.~+/=-]{8,512}$/

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { key: "notion-webhook", max: 120, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const raw = await request.text()
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: "Malformed request" }, { status: 400 })
  }

  // The one-time handshake when a subscription is made: it is unsigned, and
  // the token it carries is what signs everything after it.
  //
  // Anybody can post one, so it is printed only when it is shaped like a
  // token: a line break in it would let a stranger write lines of their own
  // into the server log, under this route's name.
  if (typeof body.verification_token === "string" && !request.headers.get("x-notion-signature")) {
    if (TOKEN_SHAPE.test(body.verification_token)) {
      console.log(`[notion-webhook] verification token (paste into Notion, set as NOTION_WEBHOOK_SECRET): ${body.verification_token}`)
    }
    return NextResponse.json({ received: true })
  }

  const secret = notionWebhookSecret()
  if (!secret) {
    console.error("[notion-webhook] NOTION_WEBHOOK_SECRET is not set; refusing events")
    return NextResponse.json({ message: "Webhooks are not configured" }, { status: 503 })
  }
  const given = request.headers.get("x-notion-signature") ?? ""
  if (!given || !secretMatches(given, notionSignature(raw, secret))) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 })
  }

  const type = typeof body.type === "string" ? body.type : ""
  if (/^(page|data_source|database|block|comment)\./.test(type) || !type) {
    revalidateTag(NOTION_TAG)
    revalidatePath("/", "layout")
  }
  return NextResponse.json({ received: true, type })
}
