// The share card for an address that is no page (lib/og-once.ts): every such
// address shares one drawing, so made-up addresses never cost a drawing each.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const { drawnOnce, MISSING_CACHE } = await import("../lib/og-once.ts")

const WORDS = { title: "Website", label: "Not found", name: "Acme", descriptor: "a site", missing: true }

/** A stand-in for the card: counts its drawings, answers a PNG's bytes. */
function counting({ fail = 0 } = {}) {
  const drawn = []
  const draw = async (words) => {
    drawn.push(words)
    if (drawn.length <= fail) throw new Error("the fonts could not be read")
    return new Response(new Uint8Array([137, 80, 78, 71, drawn.length]), { headers: { "content-type": "image/png", "cache-control": "public, s-maxage=86400" } })
  }
  return { drawn, draw }
}

test("a thousand made-up addresses are one drawing", async () => {
  const { drawn, draw } = counting()
  const card = drawnOnce(draw)
  const answers = await Promise.all(Array.from({ length: 1000 }, () => card(WORDS)))
  assert.equal(drawn.length, 1)
  for (const answer of answers) {
    assert.equal(answer.status, 200)
    assert.equal(answer.headers.get("content-type"), "image/png")
    assert.equal(answer.headers.get("cache-control"), MISSING_CACHE, "kept briefly: a page published there later shows its own")
  }
  // each answer has a body of its own, whole
  assert.deepEqual([...new Uint8Array(await answers[0].arrayBuffer())], [137, 80, 78, 71, 1])
  assert.deepEqual([...new Uint8Array(await answers[999].arrayBuffer())], [137, 80, 78, 71, 1])
})

test("new words in Notion are drawn again, once", async () => {
  const { drawn, draw } = counting()
  const card = drawnOnce(draw)
  await card(WORDS)
  await card({ ...WORDS, name: "Acme Ltd" })
  await card({ ...WORDS, name: "Acme Ltd" })
  assert.deepEqual(drawn.map((w) => w.name), ["Acme", "Acme Ltd"])
})

test("a drawing that failed is drawn again on the next request, not kept", async () => {
  const { drawn, draw } = counting({ fail: 1 })
  const card = drawnOnce(draw)
  await assert.rejects(card(WORDS))
  assert.equal((await card(WORDS)).status, 200)
  assert.equal((await card(WORDS)).status, 200)
  assert.equal(drawn.length, 2)
})

test("a card that came back refused is not kept either", async () => {
  let calls = 0
  const card = drawnOnce(async () => (++calls === 1 ? new Response("no", { status: 500 }) : new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } })))
  await assert.rejects(card(WORDS))
  assert.equal((await card(WORDS)).status, 200)
  assert.equal(calls, 2)
})

test("the route limits its callers and draws a missing address's card through it", () => {
  const route = readFileSync(new URL("../app/og/[[...path]]/route.tsx", import.meta.url), "utf8")
  assert.match(route, /const missingCard = drawnOnce\(ogCard\)/)
  assert.match(route, /return words\.missing \? missingCard\(words\) : ogCard\(words\)/)
  // no per-address server cache: the CDN keeps a page's card by its Cache-Control
  assert.doesNotMatch(route, /export const revalidate/)
  assert.match(readFileSync(new URL("../lib/og-words.ts", import.meta.url), "utf8"), /label: labels\.missing, missing: true \}/, "only the fall-through is a missing address")
})
