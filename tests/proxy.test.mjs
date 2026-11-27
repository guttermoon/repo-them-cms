// What the proxying routes share (lib/proxy.ts): which headers pass, where
// a stand-in upstream is allowed, and how an upstream's answer is handed
// back (`relay`).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const { pageLike, PASS_RESPONSE, pickHeaders, relay, standIn } = await import("../lib/proxy.ts")

test("pickHeaders passes the named headers that are set, and nothing else", () => {
  const from = new Headers({ "Content-Type": "text/plain", Cookie: "session=1", Referer: "https://site.example/a?email=x", ETag: '"1"' })
  const out = pickHeaders(from, ["content-type", "etag", "last-modified"])
  assert.deepEqual([...out.keys()].sort(), ["content-type", "etag"])
  assert.equal(out.get("cookie"), null)
  assert.equal(out.get("referer"), null)
})

test("pickHeaders adds to the headers it is given, over what was there", () => {
  const into = new Headers({ "content-type": "application/octet-stream", "x-content-type-options": "nosniff" })
  const out = pickHeaders(new Headers({ "content-type": "image/png", "content-length": "12" }), ["content-length"], into)
  assert.equal(out, into)
  assert.equal(out.get("content-length"), "12")
  assert.equal(out.get("content-type"), "application/octet-stream", "a header not named is not copied")
  assert.equal(out.get("x-content-type-options"), "nosniff")
})

test("an upstream's cookies and its encoding are never handed back", () => {
  for (const never of ["set-cookie", "content-encoding", "content-length", "location"]) assert.ok(!PASS_RESPONSE.includes(never), never)
})

test("a stand-in upstream is used in development and under test, never live", () => {
  assert.equal(standIn(" http://127.0.0.1:9000 ", "development"), "http://127.0.0.1:9000")
  assert.equal(standIn("http://127.0.0.1:9000", "test"), "http://127.0.0.1:9000")
  assert.equal(standIn("http://127.0.0.1:9000", "production"), undefined)
  assert.equal(standIn("  ", "development"), undefined)
  assert.equal(standIn(undefined, "development"), undefined)
})

test("both analytics routes read their stand-in through it", () => {
  for (const [route, name] of [
    ["app/ingest/[...path]/route.ts", "POSTHOG_PROXY_UPSTREAM"],
    ["app/ga/[...path]/route.ts", "GA_PROXY_UPSTREAM"],
  ]) {
    const src = readFileSync(new URL(`../${route}`, import.meta.url), "utf8")
    assert.ok(src.includes(`standIn(process.env.${name})`), route)
    assert.equal(src.split(`process.env.${name}`).length, 2, `${route} reads ${name} once, through standIn`)
  }
})

test("a page, a drawing or an XML document from another host is never handed on; scripts, JSON and pictures are", () => {
  for (const type of ["text/html", "TEXT/HTML; charset=utf-8", "application/xhtml+xml", "application/xml", "text/xml", "image/svg+xml", "multipart/x-mixed-replace; boundary=x"]) assert.ok(pageLike(type), type)
  for (const type of ["application/javascript", "text/javascript; charset=utf-8", "application/json", "image/gif", "text/plain", null]) assert.ok(!pageLike(type), String(type))
  // both analytics routes hand their upstream's answer back through relay, which refuses one
  for (const route of ["app/ingest/[...path]/route.ts", "app/ga/[...path]/route.ts"]) assert.match(readFileSync(new URL(`../${route}`, import.meta.url), "utf8"), /return relay\(async \(\) =>/, route)
})

test("relay hands back the upstream's status, body and named headers, and none of its cookies", async () => {
  const out = await relay(async () => new Response('{"ok":1}', { status: 200, headers: { "content-type": "application/json", "set-cookie": "a=1", etag: '"2"', "x-other": "y" } }))
  assert.equal(out.status, 200)
  assert.equal(await out.text(), '{"ok":1}')
  assert.deepEqual([...out.headers.keys()].sort(), ["content-type", "etag"])
})

test("relay: a page from the upstream is a 502, its body let go", async () => {
  let cancelled = false
  const body = new ReadableStream({ cancel: () => void (cancelled = true) })
  const out = await relay(async () => new Response(body, { headers: { "content-type": "text/html" } }))
  assert.equal(out.status, 502)
  assert.deepEqual(await out.json(), { error: "Upstream unavailable" })
  assert.ok(cancelled, "the page's body was not read on")
})

test("relay: an upstream that cannot be reached is a 502, and a 204 or 304 has no body", async () => {
  const failed = await relay(async () => {
    throw new TypeError("fetch failed")
  })
  assert.equal(failed.status, 502)
  for (const status of [204, 304]) {
    const out = await relay(async () => new Response(null, { status }))
    assert.equal(out.status, status)
    assert.equal(out.body, null)
  }
})
