// Google Analytics 4 through our own server (lib/google-analytics.ts,
// app/ga/[...path]/route.ts): only our tag's script is fetched, hits reach
// Google with the IP address shortened and page addresses cleaned, and none
// of the reader's cookies go with them.
import { after, test } from "node:test"
import assert from "node:assert/strict"

const ID = "G-TEST1234"
const STAND_IN = "http://google.stand.in"
const saved = { ...process.env }
Object.assign(process.env, { NEXT_PUBLIC_GA_MEASUREMENT_ID: ID, GA_PROXY_UPSTREAM: STAND_IN })

/** What the stand-in Google was asked, swapped per test. */
let calls = []
let reply = () => new Response(null, { status: 204 })
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  calls.push({ url: String(input), method: init.method, headers: new Headers(init.headers), body: init.body })
  return reply(String(input))
}
after(() => {
  globalThis.fetch = realFetch
  process.env = saved
})

const {
  GA_COOKIE_SECONDS,
  GA_CONSENT,
  GA_HOSTS,
  GA_MEASUREMENT_ID,
  gaBody,
  gaCookieNames,
  gaMeasurementId,
  gaQuery,
  gaSettings,
  gaUpstreamFor,
} = await import("../lib/google-analytics.ts")
const { NextRequest } = await import("next/server")
const route = await import("../app/ga/[...path]/route.ts")

let ip = 0
const request = (path, init = {}) =>
  new NextRequest(`https://site.example${path}`, {
    ...init,
    headers: { "x-forwarded-for": `81.2.69.${++ip}, 10.0.0.1`, cookie: "secret=1; _ga=GA1.1.1", ...init.headers },
  })

test("only a GA4 measurement ID turns it on", () => {
  assert.equal(gaMeasurementId(undefined), null)
  assert.equal(gaMeasurementId(""), null)
  assert.equal(gaMeasurementId(" g-test1234 "), "G-TEST1234")
  assert.equal(gaMeasurementId("UA-00000-1"), null)
  assert.equal(gaMeasurementId('G-ABC"><script>'), null)
  assert.equal(GA_MEASUREMENT_ID, ID)
})

test("the tag is set up for our own address and nothing for advertising", () => {
  const config = gaSettings("https://site.example")
  assert.equal(config.transport_url, "https://site.example/ga")
  // a server container it is not: told it is, Google's script treats /ga as one
  assert.ok(!("server_container_url" in config))
  assert.equal(config.allow_google_signals, false)
  assert.equal(config.allow_ad_personalization_signals, false)
  // set in the config, page_location would be reused for every later page view
  assert.ok(!("page_location" in config))
  assert.equal(config.cookie_expires, GA_COOKIE_SECONDS)
  assert.equal(GA_COOKIE_SECONDS, 13 * 30 * 24 * 60 * 60, "13 months, as the privacy notice says")
  assert.deepEqual(GA_CONSENT, {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  assert.deepEqual(gaCookieNames(ID), ["_ga", "_ga_TEST1234"])
})

test("only our tag's script and GA4's hits are forwarded, so /ga is not an open proxy", () => {
  const params = (q) => new URLSearchParams(q)
  assert.equal(gaUpstreamFor("gtag/js", params(`id=${ID}`), ID), `${GA_HOSTS.script}/gtag/js`)
  assert.equal(gaUpstreamFor("gtag/js", params("id=g-test1234&l=dataLayer"), ID), `${GA_HOSTS.script}/gtag/js`)
  assert.equal(gaUpstreamFor("gtag/destination", params(`id=${ID}`), ID), `${GA_HOSTS.script}/gtag/destination`)
  assert.equal(gaUpstreamFor("gtag/js", params("id=G-EXAMPLEOTHER"), ID), null)
  assert.equal(gaUpstreamFor("gtag/js", params(`id=${ID}&id=GTM-EXAMPLE1`), ID), null, "a second id would bring somebody else's tag")
  assert.equal(gaUpstreamFor("gtag/destination", params(`id=GTM-EXAMPLE1&id=${ID}`), ID), null)
  assert.equal(gaUpstreamFor("gtag/js", params(""), ID), null)
  assert.equal(gaUpstreamFor("g/collect", params("v=2"), ID), `${GA_HOSTS.collect}/g/collect`)
  for (const path of ["", "gtm.js", "g/collect/../../x", "mp/collect", "j/collect"]) {
    assert.equal(gaUpstreamFor(path, params(`id=${ID}`), ID), null, path)
  }
  // no measurement ID, nothing at all
  assert.equal(gaUpstreamFor("g/collect", params("v=2"), null), null)
})

test("a hit's page addresses are cleaned and its IP shortened; everything else goes on as written", () => {
  const dl = encodeURIComponent("https://site.example/blog?find=Jo%20Bloggs&utm_source=poster")
  const dr = encodeURIComponent("https://elsewhere.example/search?q=my+name")
  const out = gaQuery(`?v=2&tid=${ID}&dt=Signed%20by&dl=${dl}&dr=${dr}&_uip=9.9.9.9&en=page_view`, "81.2.69.160, 10.0.0.1", "site.example")
  const params = new URLSearchParams(out)
  assert.equal(params.get("dl"), "https://site.example/blog?utm_source=poster")
  assert.equal(params.get("dr"), "https://elsewhere.example/search")
  assert.equal(params.get("_uip"), "81.2.69.0")
  assert.equal(params.getAll("_uip").length, 1, "the browser's own _uip is replaced, not kept")
  // untouched pairs keep their own encoding, byte for byte
  assert.match(out, /&dt=Signed%20by&/)
  assert.match(out, /^\?v=2&tid=G-TEST1234&/)
  // no address that could be shortened, no _uip
  assert.equal(new URLSearchParams(gaQuery("?v=2&_uip=1.2.3.4", "not-an-ip")).get("_uip"), null)
  // a link with an email address in it
  const kept = encodeURIComponent("https://site.example/subscribed?e=someone%40example.com&t=abc")
  assert.equal(new URLSearchParams(gaQuery(`?dl=${kept}`, null)).get("dl"), "https://site.example/subscribed")
})

test("user-provided data never goes on, in the query or a batched body", () => {
  // what GA4's user-provided data collection adds: hashed contact details and
  // how they were found
  const hit = "v=2&tid=G-TEST1234&em=tv.1~em.c2VjcmV0~pn.MDc3MDA&emd=x&ec_mode=a&ec_m=1&ec_sel=input&en=form_submit&ep.form_id=newsletter"
  const out = new URLSearchParams(gaQuery(`?${hit}`, null))
  for (const key of ["em", "emd", "ec_mode", "ec_m", "ec_sel"]) assert.equal(out.get(key), null, key)
  assert.equal(out.get("en"), "form_submit")
  assert.equal(out.get("ep.form_id"), "newsletter")
  // a parameter that only starts with the same letters is not user data
  assert.equal(new URLSearchParams(gaQuery("?ep.email_tick=1", null)).get("ep.email_tick"), "1")
  const body = gaBody(`en=form_submit&em=tv.1~em.c2VjcmV0&ep.form_id=newsletter\nen=scroll&ec_mode=c`)
  assert.ok(!/(^|&|\n)(em|ec_mode)=/.test(body), body)
  assert.match(body, /ep\.form_id=newsletter/)
})

test("each event in a batched hit is cleaned the same way", () => {
  const dl = encodeURIComponent("https://site.example/blog?find=Jo")
  const body = gaBody(`en=page_view&_et=12\nen=scroll&ep.page_location=${dl}&epn.percent_scrolled=90\n`, "site.example")
  const [first, second, last] = body.split("\n")
  assert.equal(first, "en=page_view&_et=12")
  assert.equal(new URLSearchParams(second).get("ep.page_location"), "https://site.example/blog")
  assert.match(second, /epn\.percent_scrolled=90$/)
  assert.equal(last, "")
})

test("route: the script is fetched for our ID only, and handed back", async () => {
  calls = []
  reply = () => new Response("/* gtag */", { status: 200, headers: { "content-type": "application/javascript", "cache-control": "private, max-age=900", "set-cookie": "x=1" } })
  const ok = await route.GET(request(`/ga/gtag/js?id=${ID}`))
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), "/* gtag */")
  assert.equal(ok.headers.get("content-type"), "application/javascript")
  assert.equal(ok.headers.get("set-cookie"), null, "nothing of Google's sets a cookie through us")
  assert.equal(calls[0].url, `${STAND_IN}/gtag/js?id=${ID}`)
  assert.equal(calls[0].headers.get("cookie"), null)

  calls = []
  const other = await route.GET(request("/ga/gtag/js?id=G-EXAMPLEOTHER"))
  assert.equal(other.status, 404)
  const unknown = await route.GET(request("/ga/anything"))
  assert.equal(unknown.status, 404)
  assert.equal(calls.length, 0, "nothing refused reaches Google")
})

test("route: a page from Google is never served under this site's name", async () => {
  for (const type of ["text/html; charset=utf-8", "image/svg+xml", "application/xhtml+xml", "text/xml"]) {
    reply = () => new Response("<script>alert(1)</script>", { status: 200, headers: { "content-type": type } })
    const res = await route.GET(request(`/ga/gtag/js?id=${ID}`))
    assert.equal(res.status, 502, type)
    assert.doesNotMatch(await res.text(), /<script>/, type)
  }
})

test("route: a hit goes on with the IP shortened, the addresses cleaned, and none of the reader's cookies", async () => {
  calls = []
  reply = () => new Response(null, { status: 204 })
  const dl = encodeURIComponent("https://site.example/blog?find=Jo")
  const res = await route.POST(
    request(`/ga/g/collect?v=2&tid=${ID}&dl=${dl}`, {
      method: "POST",
      body: `en=page_view\nen=click&ep.page_location=${dl}`,
      headers: { "content-type": "text/plain;charset=UTF-8", "user-agent": "Test Browser", referer: "https://site.example/blog?find=Jo" },
    }),
  )
  assert.equal(res.status, 204)
  const [call] = calls
  const sent = new URL(call.url)
  assert.equal(`${sent.origin}${sent.pathname}`, `${STAND_IN}/g/collect`)
  assert.equal(sent.searchParams.get("dl"), "https://site.example/blog")
  assert.match(sent.searchParams.get("_uip"), /^81\.2\.69\.0$/)
  assert.equal(call.method, "POST")
  assert.equal(call.headers.get("cookie"), null)
  assert.equal(call.headers.get("referer"), null)
  assert.equal(call.headers.get("user-agent"), "Test Browser")
  assert.ok(!call.body.includes("find="), "the batched events are cleaned too")
})

test("route: Google unreachable is a 502, and the page never waits on it", async () => {
  reply = () => {
    throw new Error("down")
  }
  const res = await route.POST(request(`/ga/g/collect?v=2&tid=${ID}`, { method: "POST", body: "" }))
  assert.equal(res.status, 502)
})

test("route: the stand-in is never used in production", async () => {
  calls = []
  reply = () => new Response(null, { status: 204 })
  process.env.NODE_ENV = "production"
  try {
    await route.POST(request(`/ga/g/collect?v=2&tid=${ID}`, { method: "POST", body: "" }))
  } finally {
    process.env.NODE_ENV = saved.NODE_ENV
  }
  assert.ok(calls[0].url.startsWith(`${GA_HOSTS.collect}/g/collect`), calls[0].url)
})
