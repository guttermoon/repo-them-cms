import { revalidatePath, revalidateTag } from "next/cache"
import { type NextRequest, NextResponse } from "next/server"

import { revalidationSecret } from "@/lib/config"
import { NOTION_TAG } from "@/lib/content/store"
import { rateLimit } from "@/lib/rate-limit"
import { readJsonObject } from "@/lib/request-json"
import { secretMatches } from "@/lib/secret"

/**
 * Refresh the site now rather than within the minute. Called by hand, by a
 * Notion database automation ("Send webhook", with the secret as an
 * `x-revalidation-secret` header), or by anything else that knows the secret.
 *
 * The secret is required and the check fails closed: with REVALIDATION_SECRET
 * unset the route refuses everything, and a request without the secret is
 * refused. Never `if (secret && secret !== expected)`, which a request that
 * left the field out would walk straight past.
 *
 * The body may name one `path`; otherwise everything is refreshed. A Notion
 * automation's own body (it sends the page that changed) is accepted as
 * "everything", since the page's address is not in it.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { key: "revalidate", max: 20, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const expected = revalidationSecret()
  if (!expected) {
    console.error("[revalidate] REVALIDATION_SECRET is not set; refusing")
    return NextResponse.json({ message: "Revalidation is not configured" }, { status: 503 })
  }

  const body = (await readJsonObject(request)) ?? {}
  const given = request.headers.get("x-revalidation-secret") ?? (typeof body.secret === "string" ? body.secret : "")
  if (!given || !secretMatches(given, expected)) return NextResponse.json({ message: "Invalid secret" }, { status: 401 })

  // The content is cached under one tag whatever the page, so it goes first:
  // re-rendering a page alone would re-render it from minute-old content.
  revalidateTag(NOTION_TAG)

  const path = typeof body.path === "string" ? body.path : ""
  if (path) {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
      return NextResponse.json({ message: "Invalid path" }, { status: 400 })
    }
    revalidatePath(path)
    return NextResponse.json({ revalidated: true, path })
  }
  revalidatePath("/", "layout")
  return NextResponse.json({ revalidated: true, path: "/", scope: "layout" })
}

export async function GET() {
  return NextResponse.json({ message: "Revalidation endpoint. POST with the revalidation secret." })
}
