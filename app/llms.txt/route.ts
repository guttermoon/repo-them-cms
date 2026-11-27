import { getSiteData } from "@/lib/content/store"
import { llmsTxt } from "@/lib/llms"

/** /llms.txt: the site described for a language model (lib/llms.ts). Built
 *  ahead and refreshed with the content, so it never calls Notion itself. */
export const revalidate = 60

export async function GET() {
  return new Response(llmsTxt(await getSiteData()), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
