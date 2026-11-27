// Fetching an address somebody else chose (lib/outbound.ts): https, a public
// host, and every redirect checked the same way.
import { afterEach, test } from "node:test"
import assert from "node:assert/strict"

import { createServer as createTcpServer } from "node:net"
import { createServer as createHttpServer, get as httpGet } from "node:http"
import { gzipSync } from "node:zlib"

const { checkedLookup, fetchable, fetchPublic, isPrivateAddress, NOT_PUBLIC, outbound, pinnedFetch, responseFrom } = await import("../lib/outbound.ts")

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/** A DNS that knows a few names. */
const dns = (table) => async (host) => {
  if (!(host in table)) throw Object.assign(new Error("not found"), { code: "ENOTFOUND" })
  return table[host]
}
const PUBLIC = "93.184.216.34"

test("an address inside a network is private, however it is written", () => {
  for (const ip of [
    "127.0.0.1", "10.0.0.8", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "[::1]", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::10.0.0.1",
    "64:ff9b::7f00:1", "::7f00:1", "::127.0.0.1", "2002:7f00:1::", "2002:a9fe:a9fe::1", "2002:0a00:0001::",
    "not-an-address", "",
  ]) assert.equal(isPrivateAddress(ip), true, ip)
  for (const ip of [PUBLIC, "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1"]) assert.equal(isPrivateAddress(ip), false, ip)
})

test("only https to a public host may be fetched", async () => {
  const resolve = dns({ "pics.example": [PUBLIC], "inside.example": ["10.0.0.5"], "both.example": [PUBLIC, "127.0.0.1"] })
  assert.equal(await fetchable("https://pics.example/a.png", undefined, resolve), true)
  for (const refused of [
    "http://pics.example/a.png",
    "ftp://pics.example/a.png",
    "file:///etc/passwd",
    "https://user:pass@pics.example/a.png",
    "https://localhost/a.png",
    "https://db.internal/a.png",
    "https://printer.local/a.png",
    "https://127.0.0.1/a.png",
    "https://[::1]/a.png",
    "https://169.254.169.254/latest/meta-data/",
    "https://inside.example/a.png",
    "https://both.example/a.png",
    "not an address",
  ]) assert.equal(await fetchable(refused, undefined, resolve), false, refused)
  assert.equal(await fetchable("https://nowhere.example/a.png", undefined, resolve), true, "a name that does not resolve has nothing to reach")
})

test("the stand-in Notion is the one plain-http, local origin let through", async () => {
  const standIn = "http://127.0.0.1:4010"
  assert.equal(await fetchable("http://127.0.0.1:4010/files/a.png", standIn), true)
  assert.equal(await fetchable("http://127.0.0.1:4011/files/a.png", standIn), false, "another port is another origin")
  assert.equal(await fetchable("http://127.0.0.1:4010/files/a.png", undefined), false)
  assert.equal(await fetchable("http://127.0.0.1:4010/files/a.png", "not an address"), false)
})

test("a redirect is followed only to where a first address could go", async () => {
  const resolve = dns({ "pics.example": [PUBLIC], "cdn.example": [PUBLIC], "inside.example": ["10.0.0.5"] })
  const routes = {
    "https://pics.example/moved": { status: 302, location: "https://cdn.example/a.png" },
    "https://pics.example/relative": { status: 301, location: "/a.png" },
    "https://pics.example/inside": { status: 302, location: "https://inside.example/secret" },
    "https://pics.example/metadata": { status: 307, location: "http://169.254.169.254/latest/meta-data/" },
    "https://pics.example/loop": { status: 302, location: "https://pics.example/loop" },
  }
  const seen = []
  const send = async (input, init) => {
    seen.push(String(input))
    assert.equal(init.redirect, "manual", "nothing is followed on its own")
    const route = routes[String(input)]
    return route ? new Response(null, { status: route.status, headers: { location: route.location } }) : new Response("picture")
  }
  const get = (url) => fetchPublic(url, {}, { resolve, send })

  assert.equal(await (await get("https://pics.example/moved")).text(), "picture")
  assert.equal(await (await get("https://pics.example/relative")).text(), "picture")
  assert.equal(seen.at(-1), "https://pics.example/a.png")

  seen.length = 0
  assert.equal(await get("https://pics.example/inside"), null)
  assert.equal(await get("https://pics.example/metadata"), null)
  assert.deepEqual(seen, ["https://pics.example/inside", "https://pics.example/metadata"], "the private address was never asked")

  seen.length = 0
  assert.equal(await get("https://pics.example/loop"), null)
  assert.equal(seen.length, 4, "the first request and three redirects, then no more")

  seen.length = 0
  assert.equal(await get("https://inside.example/a.png"), null)
  assert.deepEqual(seen, [])
})

// ------------------------------------------- the connection is the check

/** A TCP listener on this machine that counts who connects to it. */
async function listener() {
  let connections = 0
  const server = createTcpServer((socket) => {
    connections++
    socket.destroy()
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  return { port: server.address().port, connections: () => connections, close: () => new Promise((done) => server.close(done)) }
}

test("a socket is given only addresses that are all public", async () => {
  const lookup = checkedLookup(dns({ "pics.example": [PUBLIC, "2606:4700:4700::1111"], "both.example": [PUBLIC, "10.0.0.5"], "metadata.example": ["169.254.169.254"] }))
  const ask = (host, options) => new Promise((done) => lookup(host, options, (error, address, family) => done({ error, address, family })))
  assert.deepEqual(await ask("pics.example", {}), { error: null, address: PUBLIC, family: 4 })
  assert.deepEqual((await ask("pics.example", { all: true })).address, [{ address: PUBLIC, family: 4 }, { address: "2606:4700:4700::1111", family: 6 }])
  assert.deepEqual(await ask("pics.example", { family: 6 }), { error: null, address: "2606:4700:4700::1111", family: 6 })
  for (const host of ["both.example", "metadata.example"]) assert.equal((await ask(host, {})).error?.code, NOT_PUBLIC, host)
  assert.equal((await ask("nowhere.example", {})).error?.code, "ENOTFOUND")
})

test("a name that answers public for the check and private for the connection reaches nothing", async () => {
  const inside = await listener()
  try {
    // a hostile DNS server: the first answer passes, the next points inside
    let asked = 0
    const rebinding = async () => (asked++ === 0 ? [PUBLIC] : ["127.0.0.1"])
    assert.equal(await fetchPublic(`https://rebind.example:${inside.port}/secret`, {}, { resolve: rebinding }), null)
    assert.equal(asked, 2, "checked, then looked up again as the socket opened")
    assert.equal(inside.connections(), 0, "and the socket never opened")
    // and one that answers nothing to the check, then an address inside
    let tries = 0
    const late = async () => {
      if (tries++ === 0) throw Object.assign(new Error("not yet"), { code: "ENOTFOUND" })
      return ["127.0.0.1"]
    }
    assert.equal(await fetchPublic(`https://late.example:${inside.port}/secret`, {}, { resolve: late }), null)
    assert.equal(inside.connections(), 0)
    await assert.rejects(pinnedFetch(`https://inside.example:${inside.port}/`, {}, async () => ["127.0.0.1"]), (error) => error.code === NOT_PUBLIC)
    assert.equal(inside.connections(), 0)
  } finally {
    await inside.close()
  }
})

test("only https GETs are sent, and the stand-in Notion alone is fetched as it is", async () => {
  await assert.rejects(pinnedFetch("http://pics.example/a.png"), /http: is not fetched/)
  await assert.rejects(pinnedFetch("https://pics.example/a.png", { method: "POST" }), /POST is not sent/)
  const asked = []
  globalThis.fetch = async (input) => {
    asked.push(String(input))
    return new Response("from the stand-in")
  }
  outbound.send = async () => {
    throw new Error("the stand-in is not sent through the pinned sender")
  }
  try {
    const res = await fetchPublic("http://127.0.0.1:4010/files/a.png", {}, { standIn: "http://127.0.0.1:4010" })
    assert.equal(await res.text(), "from the stand-in")
    assert.deepEqual(asked, ["http://127.0.0.1:4010/files/a.png"])
  } finally {
    outbound.send = null
  }
})

test("an answer reads as fetch's would: status, headers, a body uncompressed, none where there is none", async () => {
  const server = createHttpServer((req, res) => {
    if (req.url === "/gzip") {
      res.writeHead(200, { "content-type": "image/png", "content-encoding": "gzip", etag: '"e1"' })
      res.end(gzipSync(Buffer.from("a picture")))
    } else if (req.url === "/none") {
      res.writeHead(304, { etag: '"e1"' })
      res.end()
    } else {
      res.writeHead(206, { "content-type": "video/mp4", "content-range": "bytes 0-3/10" })
      res.end("abcd")
    }
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  const answer = (path, method = "GET") =>
    new Promise((done, fail) => httpGet({ host: "127.0.0.1", port: server.address().port, path, method }, (res) => done(responseFrom(res, method))).on("error", fail))
  try {
    const gz = await answer("/gzip")
    assert.equal(gz.status, 200)
    assert.equal(await gz.text(), "a picture", "uncompressed, as fetch does")
    assert.equal(gz.headers.get("content-encoding"), "gzip", "and says it was, as fetch does")
    assert.equal(gz.headers.get("etag"), '"e1"')
    const none = await answer("/none")
    assert.equal(none.status, 304)
    assert.equal(none.body, null)
    const part = await answer("/part")
    assert.equal(part.status, 206)
    assert.equal(part.headers.get("content-range"), "bytes 0-3/10")
    assert.equal(await part.text(), "abcd")
  } finally {
    await new Promise((done) => server.close(done))
  }
})
