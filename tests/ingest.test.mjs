// /ingest end to end (app/ingest/[...path]/route.ts): a request from
// posthog-js goes through the route to a stand-in PostHog, which sees only
// the headers the route names. The support chat's messages are the case in
// point: they sign in with the project's public token in a header, and a
// relay that drops it makes every message fail ("Failed to send message").
import { after, beforeEach, test } from "node:test"
import assert from "node:assert/strict"

const POSTHOG = "https://posthog.test"
const saved = { ...process.env }
const realFetch = globalThis.fetch

/** What the stand-in PostHog was asked. */
let asked = []
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (!url.startsWith(POSTHOG)) throw new Error(`unexpected request to ${url}`)
  asked.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers) })
  return Response.json({ ticket_id: "t-1", message_id: "m-1" }, { headers: { "set-cookie": "posthog=1" } })
}

process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test12345678"
process.env.POSTHOG_PROXY_UPSTREAM = POSTHOG
process.env.NODE_ENV = "test"

const { NextRequest } = await import("next/server")
const route = await import("../app/ingest/[...path]/route.ts")

after(() => {
  globalThis.fetch = realFetch
  process.env = saved
})
beforeEach(() => {
  asked = []
})

/** A request as posthog-js sends it from a reader's browser. */
const fromBrowser = (path, init = {}) =>
  new NextRequest(`https://site.example/ingest/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: "cart=[]; theme=dark",
      referer: "https://site.example/pricing?email=reader@example.com",
      "x-forwarded-for": "203.0.113.77",
      ...init.headers,
    },
  })

test("a chat message reaches PostHog with the chat's token, and nothing of the reader's", async () => {
  const response = await route.POST(
    fromBrowser("api/conversations/v1/widget/message", {
      method: "POST",
      body: JSON.stringify({ message: "Hello", traits: { email: "reader@example.com" } }),
      headers: { "x-conversations-token": "public-chat-token" },
    }),
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ticket_id: "t-1", message_id: "m-1" })
  assert.equal(response.headers.get("set-cookie"), null, "PostHog's cookie is not handed back under this site's name")

  assert.equal(asked.length, 1)
  const [sent] = asked
  assert.equal(sent.url, `${POSTHOG}/api/conversations/v1/widget/message`)
  assert.equal(sent.method, "POST")
  assert.equal(sent.headers.get("x-conversations-token"), "public-chat-token", "without it PostHog refuses the message")
  assert.equal(sent.headers.get("cookie"), null)
  assert.equal(sent.headers.get("referer"), null)
  assert.equal(sent.headers.get("x-forwarded-for"), "203.0.113.0", "only the shortened address")
})

test("the chat's tickets and messages are read through it the same way", async () => {
  for (const path of ["api/conversations/v1/widget/tickets?widget_session_id=w-1", "api/conversations/v1/widget/messages/t-1?after=0"]) {
    const response = await route.GET(fromBrowser(path, { headers: { "x-conversations-token": "public-chat-token" } }))
    assert.equal(response.status, 200, path)
  }
  assert.deepEqual(
    asked.map((a) => [new URL(a.url).pathname + new URL(a.url).search, a.headers.get("x-conversations-token")]),
    [
      ["/api/conversations/v1/widget/tickets?widget_session_id=w-1", "public-chat-token"],
      ["/api/conversations/v1/widget/messages/t-1?after=0", "public-chat-token"],
    ],
  )
})

test("a header the route does not name stays here", async () => {
  await route.POST(fromBrowser("e/", { method: "POST", body: "{}", headers: { authorization: "Bearer reader-secret", "x-anything": "1" } }))
  const [sent] = asked
  assert.equal(sent.headers.get("authorization"), null)
  assert.equal(sent.headers.get("x-anything"), null)
  assert.equal(sent.headers.get("content-type"), "application/json")
})
