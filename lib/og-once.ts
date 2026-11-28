/**
 * The share card for an address that is no page (app/og/[[...path]]/route.tsx):
 * one card for every such address, drawn once and handed out again.
 *
 * Anybody can ask for `/og/<anything>`, and drawing a card is a second or so
 * of a server's time. Drawn afresh for each made-up address, a stranger
 * asking for a million of them would be a million drawings on the site's
 * bill. They all show the same words (the site's noun, "Not found"), so they
 * share one drawing: it is drawn again only when those words change in
 * Notion, and a drawing that failed is tried again on the next request.
 */

/** How long a browser or a CDN keeps the card for an address that is no
 *  page: short, since a page published there later should show its own. */
export const MISSING_CACHE = "public, max-age=300, s-maxage=300"

export function drawnOnce<W>(draw: (words: W) => Promise<Response>): (words: W) => Promise<Response> {
  let kept: { key: string; drawing: Promise<{ body: ArrayBuffer; type: string }> } | null = null
  return async (words) => {
    const key = JSON.stringify(words)
    if (kept?.key !== key) {
      const drawing = draw(words).then(async (response) => {
        if (!response.ok) throw new Error(`the card was not drawn (${response.status})`)
        return { body: await response.arrayBuffer(), type: response.headers.get("content-type") ?? "image/png" }
      })
      const mine = { key, drawing }
      kept = mine
      // a failed drawing is not kept, so the next request draws again
      drawing.catch(() => {
        if (kept === mine) kept = null
      })
    }
    const { body, type } = await kept.drawing
    return new Response(body.slice(0), { headers: { "Content-Type": type, "Cache-Control": MISSING_CACHE } })
  }
}
