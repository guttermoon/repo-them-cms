// The route handlers in app/api, called as Next calls them: a Request in, a
// Response out, with the email platform faked at fetch and Next's cache
// recorded rather than run (tests/support/next-cache.mjs).
//
// These are the boundary: what each route answers to a malformed body, a
// filled honeypot, each refusal and a good request, what it logs (never what
// a reader typed), and what it clears from the cache afterwards.
import { after, beforeEach, test } from "node:test"
import assert from "node:assert/strict"

import { revalidated } from "./support/next-cache.mjs"

const BREVO_API = "https://brevo.test/v3"
const saved = { ...process.env }
const realFetch = globalThis.fetch

/** What the fake platform has been asked, and how it answers next. */
let sent = []
let refuse = null
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (!url.startsWith(BREVO_API)) throw new Error(`unexpected request to ${url}`)
  sent.push({ url, body: init.body ? JSON.parse(init.body) : undefined })
  if (refuse) return Response.json(refuse.body, { status: refuse.status })
  if (url.includes("/contacts/lists?")) return Response.json({ lists: [{ id: 4, name: "Test list" }] })
  return Response.json({ messageId: "<1@test>" }, { status: 201 })
}

const ENV = {
  BREVO_API_KEY: "test-key",
  BREVO_API_URL: BREVO_API,
  BREVO_LIST_NAME: "Test list",
  CONTACT_TO_EMAIL: "owner@example.net",
  EMAIL_FROM: "site@example.net",
  REVALIDATION_SECRET: "revalidate-me",
  NOTION_WEBHOOK_SECRET: "secret_webhook_token",
}
const UNSET = ["EMAIL_PROVIDER", "CONTACT_EMAIL_PROVIDER", "BREVO_LIST_ID", "BREVO_DOI_TEMPLATE_ID", "BREVO_DOI_REDIRECT_URL", "NOTION_TOKEN", "NOTION_DATABASE_ID"]
Object.assign(process.env, ENV)
for (const key of UNSET) delete process.env[key]

const { NextRequest } = await import("next/server")
const subscribe = await import("../app/api/subscribe/route.ts")
const contact = await import("../app/api/contact/route.ts")
const revalidate = await import("../app/api/revalidate/route.ts")
const webhook = await import("../app/api/notion-webhook/route.ts")
const { notionSignature } = await import("../lib/secret.ts")
const { SITE_NAME } = await import("../lib/site.ts")

/** Everything logged, so a test can check nothing a reader typed is in it. */
const logged = []
const quiet = ["log", "warn", "error", "info"].map((level) => [level, console[level]])
for (const [level] of quiet) console[level] = (...args) => logged.push(args.join(" "))
after(() => {
  globalThis.fetch = realFetch
  process.env = saved
  for (const [level, fn] of quiet) console[level] = fn
})

beforeEach(() => {
  sent = []
  refuse = null
  logged.length = 0
  revalidated.length = 0
  Object.assign(process.env, ENV)
  process.env.NODE_ENV = "test"
})

// Every request comes from its own address, so the rate limit only applies
// where a test means it to.
let ip = 0
const call = (handler, path, body, headers = {}, from = `10.1.${Math.floor(++ip / 250)}.${ip % 250}`) =>
  handler.POST(
    new NextRequest(`https://site.example${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": from, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )

// ------------------------------------------------------------ /api/subscribe

test("subscribe: anything but a JSON object is a 400", async () => {
  for (const body of ["not json", "null", "[1,2]", "42"]) {
    assert.equal((await call(subscribe, "/api/subscribe", body)).status, 400, body)
  }
  assert.equal(sent.length, 0)
})

test("subscribe: a filled honeypot looks like success and sends nothing", async () => {
  const res = await call(subscribe, "/api/subscribe", { email: "bot@example.com", website: "https://spam.example" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: "subscribed" })
  assert.equal(sent.length, 0)
})

test("subscribe: an address that is not one is refused with the form's own words", async () => {
  for (const email of ["", "nobody", "a@b", "two@@example.com", 42]) {
    const res = await call(subscribe, "/api/subscribe", { email })
    assert.equal(res.status, 400, String(email))
    assert.match((await res.json()).error, /email address/i)
  }
  assert.equal(sent.length, 0)
})

test("subscribe: a good address goes to the platform, with the first name, cleaned", async () => {
  const res = await call(subscribe, "/api/subscribe", { email: " reader@example.com ", name: "Ada\r\n<b>Lovelace</b>" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: "subscribed" })
  const add = sent.find((r) => r.url === `${BREVO_API}/contacts`)
  assert.deepEqual(add.body, { email: "reader@example.com", attributes: { FIRSTNAME: "Ada b Lovelace /b" }, listIds: [4], updateEnabled: true })
})

test("subscribe: double opt-in answers 'pending', so the form can say to check the inbox", async () => {
  Object.assign(process.env, { BREVO_DOI_TEMPLATE_ID: "3", BREVO_DOI_REDIRECT_URL: "https://site.example/subscribed" })
  const res = await call(subscribe, "/api/subscribe", { email: "reader@example.com" })
  assert.deepEqual(await res.json(), { status: "pending" })
  delete process.env.BREVO_DOI_TEMPLATE_ID
  delete process.env.BREVO_DOI_REDIRECT_URL
})

test("subscribe: no platform accepts in development, and is a 503 in production, never a false success", async () => {
  delete process.env.BREVO_API_KEY
  const dev = await call(subscribe, "/api/subscribe", { email: "reader@example.com" })
  assert.equal(dev.status, 200)
  process.env.NODE_ENV = "production"
  const live = await call(subscribe, "/api/subscribe", { email: "reader@example.com" })
  assert.equal(live.status, 503)
  assert.equal(sent.length, 0)
  assert.ok(!logged.join("\n").includes("reader@example.com"), "no address in the log")
})

test("subscribe: a platform's refusal is a 502, and the log keeps no address", async () => {
  refuse = { status: 400, body: { code: "invalid_parameter", message: "reader@example.com is invalid" } }
  const res = await call(subscribe, "/api/subscribe", { email: "reader@example.com" })
  assert.equal(res.status, 502)
  assert.ok(logged.some((line) => line.includes("Brevo responded 400")))
  assert.ok(!logged.join("\n").includes("reader@example.com"))
})

test("subscribe: five a minute from one address, then a 429", async () => {
  const from = "192.0.2.77"
  for (let i = 0; i < 5; i++) assert.equal((await call(subscribe, "/api/subscribe", { email: "a@example.com" }, {}, from)).status, 200)
  const res = await call(subscribe, "/api/subscribe", { email: "a@example.com" }, {}, from)
  assert.equal(res.status, 429)
  assert.ok(res.headers.get("retry-after"))
})

// ------------------------------------------------------------ /api/contact

const LETTER = { name: "Ada", email: "ada@example.com", type: "order", subject: "Help", message: "Hello. See https://example.org/page." }

test("contact: every field is checked on the route, whatever the form let through", async () => {
  const cases = [
    [{ ...LETTER, name: "" }, /name/i],
    [{ ...LETTER, email: "nope" }, /email address/i],
    [{ ...LETTER, message: "   " }, /empty/i],
    [{ ...LETTER, type: "" }, /what your message is about/i],
    [{ ...LETTER, type: "pledge" }, /what your message is about/i],
  ]
  for (const [body, error] of cases) {
    const res = await call(contact, "/api/contact", body)
    assert.equal(res.status, 400)
    assert.match((await res.json()).error, error)
  }
  assert.equal((await call(contact, "/api/contact", "[]")).status, 400)
  assert.equal(sent.length, 0)
})

test("contact: a honeypot is a quiet success", async () => {
  const res = await call(contact, "/api/contact", { ...LETTER, website: "x" })
  assert.deepEqual(await res.json(), { success: true })
  assert.equal(sent.length, 0)
})

test("contact: the letter goes to the owner, from the verified sender, replying to the writer", async () => {
  const res = await call(contact, "/api/contact", { ...LETTER, subject: "Help\r\nBcc: everyone@example.com", message: "<script>alert(1)</script> https://example.org/a." })
  assert.deepEqual(await res.json(), { success: true })
  const [mail] = sent
  assert.equal(mail.url, `${BREVO_API}/smtp/email`)
  assert.deepEqual(mail.body.sender, { email: "site@example.net", name: SITE_NAME })
  assert.deepEqual(mail.body.to, [{ email: "owner@example.net" }])
  assert.deepEqual(mail.body.replyTo, { email: "ada@example.com", name: "Ada" })
  assert.equal(mail.body.subject, `[${SITE_NAME}] Help Bcc: everyone@example.com`, "a subject is one line")
  assert.match(mail.body.textContent, /^From: Ada <ada@example\.com>\nType: order\n\n<script>/)
  assert.ok(!mail.body.htmlContent.includes("<script>"), "the HTML part is escaped before any tag is added")
  assert.match(mail.body.htmlContent, /<a href="https:\/\/example\.org\/a" rel="noopener noreferrer nofollow">https:\/\/example\.org\/a<\/a>\./)
  assert.ok(!logged.join("\n").includes("ada@example.com"))
})

test("contact: no subject gives one; no platform is a 503 in production", async () => {
  await call(contact, "/api/contact", { ...LETTER, subject: "" })
  assert.equal(sent[0].body.subject, `[${SITE_NAME}] Message from Ada`)
  delete process.env.CONTACT_TO_EMAIL
  process.env.NODE_ENV = "production"
  assert.equal((await call(contact, "/api/contact", LETTER)).status, 503)
  refuse = { status: 500, body: {} }
  process.env.CONTACT_TO_EMAIL = "owner@example.net"
  assert.equal((await call(contact, "/api/contact", LETTER)).status, 502)
})

// ------------------------------------------------------------ /api/revalidate

test("revalidate: fails closed with no secret set, and refuses a wrong or missing one", async () => {
  delete process.env.REVALIDATION_SECRET
  assert.equal((await call(revalidate, "/api/revalidate", { secret: "anything" })).status, 503)
  process.env.REVALIDATION_SECRET = "revalidate-me"
  assert.equal((await call(revalidate, "/api/revalidate", {})).status, 401, "a request that leaves the secret out")
  assert.equal((await call(revalidate, "/api/revalidate", { secret: "revalidate-mf" })).status, 401)
  assert.equal((await call(revalidate, "/api/revalidate", { secret: "revalidate-me-and-more" })).status, 401)
  assert.deepEqual(revalidated, [])
})

test("revalidate: the content's tag first, then the whole site or one page", async () => {
  const all = await call(revalidate, "/api/revalidate", { secret: "revalidate-me" })
  assert.equal(all.status, 200)
  assert.deepEqual(revalidated, ["tag:notion", "path:/:layout"])
  revalidated.length = 0
  const one = await call(revalidate, "/api/revalidate", { path: "/blog/hello" }, { "x-revalidation-secret": "revalidate-me" })
  assert.deepEqual(await one.json(), { revalidated: true, path: "/blog/hello" })
  assert.deepEqual(revalidated, ["tag:notion", "path:/blog/hello"])
})

test("revalidate: a Notion automation's own body (no path, the secret in a header) refreshes everything", async () => {
  const body = { source: { type: "automation" }, data: { object: "page", id: "x" } }
  const res = await call(revalidate, "/api/revalidate", body, { "x-revalidation-secret": "revalidate-me" })
  assert.equal(res.status, 200)
  assert.deepEqual(revalidated, ["tag:notion", "path:/:layout"])
})

test("revalidate: a path that is not this site's is refused", async () => {
  for (const path of ["blog", "//evil.example/x", "/../etc"]) {
    assert.equal((await call(revalidate, "/api/revalidate", { secret: "revalidate-me", path })).status, 400, path)
  }
})

// ------------------------------------------------------------ /api/notion-webhook

const event = (body, token = ENV.NOTION_WEBHOOK_SECRET) => {
  const raw = JSON.stringify(body)
  return call(webhook, "/api/notion-webhook", raw, token ? { "x-notion-signature": notionSignature(raw, token) } : {})
}

test("webhook: the one-time handshake is logged for pasting into Notion, and changes nothing", async () => {
  const res = await call(webhook, "/api/notion-webhook", { verification_token: "secret_handshake" })
  assert.equal(res.status, 200)
  assert.ok(logged.some((line) => line.includes("secret_handshake")))
  assert.deepEqual(revalidated, [])
})

test("webhook: a handshake that is not shaped like a token is answered and never printed", async () => {
  // anybody can post one: a line break in it would write a stranger's own lines into the log
  for (const forged of ["secret_x\n[revalidate] secret accepted", "has a space", "short", "x".repeat(600)]) {
    const res = await call(webhook, "/api/notion-webhook", { verification_token: forged })
    assert.equal(res.status, 200, "answered as any handshake is: a stranger learns nothing")
  }
  assert.deepEqual(logged, [])
})

test("webhook: a signed event refreshes the site; an unsigned or wrongly signed one is refused", async () => {
  const ok = await event({ type: "page.content_updated", entity: { id: "p", type: "page" } })
  assert.equal(ok.status, 200)
  assert.deepEqual(revalidated, ["tag:notion", "path:/:layout"])
  revalidated.length = 0
  assert.equal((await event({ type: "page.created" }, null)).status, 401)
  assert.equal((await event({ type: "page.created" }, "a-different-token")).status, 401)
  const raw = JSON.stringify({ type: "page.created" })
  const tampered = await call(webhook, "/api/notion-webhook", raw.replace("created", "deleted"), { "x-notion-signature": notionSignature(raw, ENV.NOTION_WEBHOOK_SECRET) })
  assert.equal(tampered.status, 401, "the signature covers the exact bytes")
  assert.deepEqual(revalidated, [])
  assert.equal((await call(webhook, "/api/notion-webhook", "{not json")).status, 400)
})

test("webhook: without its secret set, events are refused rather than trusted", async () => {
  delete process.env.NOTION_WEBHOOK_SECRET
  assert.equal((await event({ type: "page.created" })).status, 503)
  assert.deepEqual(revalidated, [])
})
