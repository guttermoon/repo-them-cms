import { getSiteData } from "@/lib/content/store"
import { llmsFullTxt } from "@/lib/llms"

/** /llms-full.txt: /llms.txt with the answers and every post's summary. */
export const revalidate = 60

export async function GET() {
  return new Response(llmsFullTxt(await getSiteData()), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
