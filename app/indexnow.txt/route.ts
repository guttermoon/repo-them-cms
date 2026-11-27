import { indexNowKey } from "@/lib/indexnow"

/** /indexnow.txt: the IndexNow key, for the engines to check a submission
 *  against (lib/indexnow.ts). Not found when no key is set. */
export const dynamic = "force-static"

export function GET() {
  const key = indexNowKey(process.env.INDEXNOW_KEY)
  if (!key) return new Response("Not found", { status: 404 })
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
