// PostHog: off without a key, opt-in when on, through this site's own
// server, with nothing that could name a reader leaving it (lib/analytics.ts,
// app/ingest, components/layout/posthog-analytics.tsx).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import {
  analyticsKey,
  cleanUrl,
  KEPT_PARAMS,
  POSTHOG_ASSETS,
  POSTHOG_INGEST,
  POSTHOG_UI,
  posthogChatStorageName,
  posthogRegion,
  PROXY_PATH,
  posthogOptions,
  scrubEvent,
  shortenIp,
  posthogUpstreamFor,
} from "../lib/analytics.ts"

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")

// ── the options ──

test("everything PostHog does is left on: nothing is pinned off in code", () => {
  const o = posthogOptions()
  for (const off of [
    "autocapture",
    "rageclick",
    "capture_dead_clicks",
    "capture_heatmaps",
    "enable_heatmaps",
    "capture_performance",
    "disable_session_recording",
    "disable_surveys",
    "disable_product_tours",
    "disable_web_experiments",
    "disable_external_dependency_loading",
    "advanced_disable_flags",
  ])
    assert.equal(o[off], undefined, `${off} is set in code; the PostHog project settings decide`)
  assert.equal(o.defaults, "2026-08-30", "PostHog's defaults of a fixed date, so an update cannot change them silently")
})

test("events go to this site's own server, and PostHog's region is chosen, EU unless US", () => {
  const o = posthogOptions()
  assert.equal(PROXY_PATH, "/ingest")
  assert.equal(o.api_host, "/ingest")
  assert.equal(o.ui_host, POSTHOG_UI)
  assert.equal(POSTHOG_INGEST, "https://eu.i.posthog.com")
  assert.equal(POSTHOG_ASSETS, "https://eu-assets.i.posthog.com")
  assert.equal(posthogRegion("us").ingest, "https://us.i.posthog.com")
  assert.equal(posthogRegion("US ").assets, "https://us-assets.i.posthog.com")
  assert.equal(posthogRegion("mars").ingest, "https://eu.i.posthog.com")
})

test("errors are reported after a yes: unhandled ones, never what a page wrote to the console", () => {
  // the one feature set in code, because a page's console can hold what a reader typed
  assert.deepEqual(posthogOptions().capture_exceptions, { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: false })
})

test("no profiles, a no deletes the identifier, and every event is scrubbed", () => {
  const o = posthogOptions()
  assert.equal(o.person_profiles, "identified_only")
  assert.equal(o.internal_or_test_user_hostname, null, "the localhost tag starts a profile")
  assert.equal(o.opt_out_persistence_by_default, true, "say no and the cookie goes")
  assert.equal(o.before_send, scrubEvent)
})

test("there is no key in the code: PostHog is on only with a project key from the environment", () => {
  assert.equal(analyticsKey(undefined), null)
  assert.equal(analyticsKey(""), null)
  assert.equal(analyticsKey(" off "), null)
  assert.equal(analyticsKey("not-a-key"), null)
  assert.equal(analyticsKey("phc_testprojectkey"), "phc_testprojectkey")
  assert.equal(analyticsKey(" phc_testprojectkey "), "phc_testprojectkey")
  assert.doesNotMatch(read("lib/analytics.ts"), /phc_[A-Za-z0-9]{20,}/, "a real-looking key is written into the code")
})

// ── names out of addresses ──

const HOST = "site.example"

test("a page address on this site keeps its path and the campaign tags, and nothing else", () => {
  assert.equal(cleanUrl("https://site.example/blog?find=Ada%20Lovelace", HOST), "https://site.example/blog")
  assert.equal(cleanUrl("https://site.example/subscribed?e=ada%40example.com&t=abc123", HOST), "https://site.example/subscribed")
  assert.equal(
    cleanUrl("https://site.example/features?utm_source=flyer&utm_campaign=launch&email=a@b.c#form", HOST),
    "https://site.example/features?utm_source=flyer&utm_campaign=launch",
  )
  assert.equal(cleanUrl("https://site.example/contact?type=setup", HOST), "https://site.example/contact?type=setup")
  assert.equal(cleanUrl("http://localhost:3000/blog?find=Ada", HOST), "http://localhost:3000/blog")
  assert.deepEqual(KEPT_PARAMS.sort(), ["type", "utm_campaign", "utm_content", "utm_medium", "utm_source", "utm_term"])
})

test("another site's address (a referrer) keeps only where it was, not what was in it", () => {
  assert.equal(cleanUrl("https://www.google.com/search?q=ada+lovelace", HOST), "https://www.google.com/search")
  assert.equal(cleanUrl("https://mail.example.com/inbox?utm_source=x#msg", HOST), "https://mail.example.com/inbox")
})

test("anything that is not an address is left alone", () => {
  for (const v of ["$direct", "/blog?find=Ada", "", "mailto:a@b.c", "not a url"]) assert.equal(cleanUrl(v, HOST), v)
})

test("every address in an event is cleaned: properties, $set and $set_once", () => {
  const event = scrubEvent({
    uuid: "1",
    event: "$pageview",
    properties: {
      $current_url: "https://site.example/blog?find=Ada",
      $referrer: "https://www.google.com/search?q=ada",
      $session_entry_url: "https://site.example/subscribed?e=a%40b.c&t=x",
      $pathname: "/blog",
      $browser: "Chrome",
      count: 3,
    },
    $set: { $current_url: "https://site.example/blog?find=Ada" },
    $set_once: { $initial_current_url: "https://site.example/subscribed?e=a%40b.c" },
  })
  assert.equal(event.properties.$current_url, "https://site.example/blog")
  assert.equal(event.properties.$referrer, "https://www.google.com/search")
  assert.equal(event.properties.$session_entry_url, "https://site.example/subscribed")
  assert.equal(event.properties.$pathname, "/blog")
  assert.equal(event.properties.count, 3)
  assert.equal(event.$set.$current_url, "https://site.example/blog")
  assert.equal(event.$set_once.$initial_current_url, "https://site.example/subscribed")
  assert.equal(scrubEvent(null), null)
})

test("a recording's page address is cleaned too", () => {
  const event = scrubEvent({
    uuid: "2",
    event: "$snapshot",
    properties: {
      $snapshot_data: [
        { type: 4, data: { href: "https://site.example/blog?find=Ada", width: 390, height: 844 } },
        { type: 2, data: { node: { id: 1 } } },
        { type: 3, data: { source: 2 } },
      ],
    },
  })
  assert.equal(event.properties.$snapshot_data[0].data.href, "https://site.example/blog")
  assert.deepEqual(event.properties.$snapshot_data[1], { type: 2, data: { node: { id: 1 } } })
})

test("a recording's custom events are cleaned at any depth (the $json_ld leak)", () => {
  // PostHog's $json_ld custom event carries the page's full address
  const event = scrubEvent({
    uuid: "3",
    event: "$snapshot",
    properties: {
      $snapshot_data: [
        {
          type: 5,
          data: {
            tag: "$json_ld",
            payload: { "@context": "https://schema.org", nested: [{ url: "https://site.example/subscribed?e=a%40b.c&t=x" }] },
            href: "https://site.example/subscribed?e=a%40b.c&t=x",
          },
        },
      ],
    },
  })
  const data = event.properties.$snapshot_data[0].data
  assert.equal(data.href, "https://site.example/subscribed")
  assert.equal(data.payload.nested[0].url, "https://site.example/subscribed")
  assert.equal(data.payload["@context"], "https://schema.org")
  assert.ok(!JSON.stringify(event).includes("a%40b.c"))
})

// ── the proxy ──

test("the IP address PostHog receives is shortened to a block, never a connection", () => {
  assert.equal(shortenIp("81.2.69.160"), "81.2.69.0")
  assert.equal(shortenIp("81.2.69.160, 10.0.0.1"), "81.2.69.0", "the first in a forwarded list is the reader's")
  assert.equal(shortenIp("::ffff:81.2.69.160"), "81.2.69.0")
  assert.equal(shortenIp("2a00:23c6:1234:5678:9abc:def0:1234:5678"), "2a00:23c6:1234::")
  assert.equal(shortenIp("2a00:23c6::1"), "2a00:23c6:0::")
  for (const bad of [null, undefined, "", "unknown", "999.1.1.1", "1.2.3", "not-an-ip"]) assert.equal(shortenIp(bad), null, String(bad))
})

test("only PostHog's own paths are forwarded, each to the right host", () => {
  assert.equal(posthogUpstreamFor("e/"), `${POSTHOG_INGEST}/e/`)
  assert.equal(posthogUpstreamFor("s/"), `${POSTHOG_INGEST}/s/`)
  assert.equal(posthogUpstreamFor("i/v0/e/"), `${POSTHOG_INGEST}/i/v0/e/`)
  assert.equal(posthogUpstreamFor("flags/"), `${POSTHOG_INGEST}/flags/`)
  assert.equal(posthogUpstreamFor("api/surveys/"), `${POSTHOG_INGEST}/api/surveys/`)
  assert.equal(posthogUpstreamFor("static/1.438.12/recorder.js"), `${POSTHOG_ASSETS}/static/1.438.12/recorder.js`)
  const KEY = "phc_ourprojectkey123"
  assert.equal(posthogUpstreamFor(`array/${KEY}/config`, undefined, KEY), `${POSTHOG_ASSETS}/array/${KEY}/config`)
  assert.equal(posthogUpstreamFor(`array/${KEY}/config.js`, undefined, KEY), `${POSTHOG_ASSETS}/array/${KEY}/config.js`)
  // another project's configuration carries its owner's scripts: never from this site
  assert.equal(posthogUpstreamFor("array/phc_somebodyelse99/config.js", undefined, KEY), null)
  assert.equal(posthogUpstreamFor(`array/${KEY}/config.js`, undefined, null), null, "no key, no project's configuration")
  for (const refused of ["", "admin/", "e/../../etc", "e/%2e%2e/", "https://evil.test/", "e/<x>"])
    assert.equal(posthogUpstreamFor(refused), null, refused)
  assert.equal(posthogUpstreamFor("e/", { ingest: "http://stand.in", assets: "http://stand.in" }), "http://stand.in/e/")
})

test("the proxy passes on no cookies, no referrer and no full address", () => {
  const src = read("app/ingest/[...path]/route.ts")
  const pass = src.match(/const PASS_REQUEST = \[([^\]]*)\]/)[1]
  for (const never of ["cookie", "referer", "origin", "x-forwarded-for", "x-real-ip", "forwarded", "authorization"])
    assert.ok(!pass.toLowerCase().includes(`"${never}"`), `${never} must not be passed on`)
  assert.match(src, /headers\.set\("x-forwarded-for", ip\)/)
  assert.match(src, /const ip = shortenIp\(/, "the only address passed on is the shortened one")
  // the stand-in upstream is read through lib/proxy.ts, which ignores it live (tests/proxy.test.mjs)
  assert.match(src, /standIn\(process\.env\.POSTHOG_PROXY_UPSTREAM\)/)
  assert.doesNotMatch(src.replace(/standIn\(process\.env\.POSTHOG_PROXY_UPSTREAM\)/, ""), /POSTHOG_PROXY_UPSTREAM\b(?!`)/, "and never read any other way")
})

test("PostHog's slashes reach the proxy, and every other page still loses its trailing slash", async () => {
  const { default: config } = await import("../next.config.mjs")
  assert.equal(config.skipTrailingSlashRedirect, true)
  const rules = await config.redirects()
  const rule = rules.find((r) => r.destination === "/:path")
  assert.ok(rule, "the trailing-slash redirect for everything but /ingest")
  assert.equal(rule.permanent, true)
  assert.match(rule.source, /\(\?!ingest/)
})

// ── the page ──

test("posthog-js arrives as a chunk of its own, not inside every page's scripts", () => {
  const STATIC_IMPORT = /^import\s+(?!type\b)(?:[^\n]*?\bfrom\s+)?["']posthog-js["']/m
  const src = read("components/layout/posthog-analytics.tsx")
  assert.doesNotMatch(src, STATIC_IMPORT)
  assert.match(src, /import\(\s*["']posthog-js["']\s*\)/)
  for (const f of ["app/layout.tsx", "lib/analytics.ts"]) assert.doesNotMatch(read(f), STATIC_IMPORT, f)
})

test("opt-in: nothing loads before a yes, and a later no opts out", () => {
  const src = read("components/layout/posthog-analytics.tsx")
  assert.match(src, /readConsent\(\) === "accepted"/, "it starts only on a stored yes")
  assert.doesNotMatch(src, /answer !== "rejected"/, "the old run-before-an-answer rule is back")
  assert.match(src, /value === "rejected" && loading\) void loading\.then\(stop\)/, "a no while PostHog runs stops it")
  const stop = /function stop\([^)]*\) \{([^}]*)\}/.exec(src)?.[1] ?? ""
  assert.match(stop, /opt_out_capturing\(\)/, "a no stops the sending")
  assert.match(stop, /conversations\?\.reset\(\)/, "a no takes the support chat off the page with what it kept")
  assert.match(src, /if \(value === "rejected"\) forget\(key\)/, "and what an earlier yes left is deleted, loaded or not")
})

test("a no deletes the support chat's item by the name posthog-js keeps it under", () => {
  const ROOT = new URL("..", import.meta.url).pathname
  const library = dirname(createRequire(join(ROOT, "package.json")).resolve("posthog-js/package.json"))
  const chat = readFileSync(join(library, "dist", "conversations.js"), "utf8")
  // posthog-js names it from the project's key; an update that renames it fails here
  const prefix = /return i\?"(ph_conv_)"\+i:null/.exec(chat)?.[1]
  assert.ok(prefix, "posthog-js no longer keeps the chat under ph_conv_<key>: forget() would leave it")
  assert.equal(posthogChatStorageName("phc_x"), `${prefix}phc_x`)
  assert.match(read("components/layout/posthog-analytics.tsx"), /\[name, posthogChatStorageName\(key\)\]/, "forget() deletes the chat's item")
})

test("the cookie notice asks first and says so", () => {
  const src = read("components/layout/cookie-notice.tsx")
  assert.match(src, /Nothing is counted until you say yes/)
  assert.match(src, /e\.key === "Escape"[\s\S]{0,500}answer\("rejected"\)/, "Escape answers no")
  // the two answers share one class: neither is the obvious one
  assert.equal((src.match(/className=\{BUTTON\}/g) ?? []).length, 2)
})

// ── product events and server logs ──

/** The only properties an event or a log line may carry: what happened,
 *  never who it happened to. */
const SAYS_WHAT = new Set(["product_slug", "variant_id", "quantity", "previous_quantity", "item_count", "subtotal", "currency", "status", "enquiry_type", "endpoint"])

/** The property names in every `<call>(…, { … })` of a source file. */
function propertyNames(source, call) {
  const names = []
  for (const match of source.matchAll(new RegExp(`${call}\\(\\s*"[a-z_]+",\\s*\\{([^}]*)\\}`, "g"))) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(":")[0].trim()
      if (name) names.push(name)
    }
  }
  return names
}

test("a product event carries what happened, never who: no address, name or message", () => {
  const files = ["components/commerce/add-to-cart.tsx", "components/commerce/cart-view.tsx", "components/layout/newsletter-form.tsx", "components/sections/contact-form.tsx"]
  const names = files.flatMap((file) => propertyNames(read(file), "capturePostHogEvent"))
  assert.ok(names.length >= 8, `only ${names.length} event properties found`)
  for (const name of names) assert.ok(SAYS_WHAT.has(name), `an event sends "${name}"`)
  // and each one waits for a yes
  const component = read("components/layout/posthog-analytics.tsx")
  for (const fn of ["capturePostHogEvent", "capturePostHogException"]) {
    const body = component.slice(component.indexOf(`export function ${fn}`), component.indexOf("\n}\n", component.indexOf(`export function ${fn}`)))
    assert.match(body, /readConsent\(\) !== "accepted"\) return/, `${fn} sends before a yes`)
  }
})

test("a server log line says what happened, never who", () => {
  const source = read("lib/posthog-logs.ts")
  const names = [...source.matchAll(/attributes: \{([^}]*)\}/g)].flatMap((m) => m[1].split(",").map((part) => part.trim().split(":")[0].trim()).filter(Boolean))
  assert.ok(names.length >= 3)
  for (const name of names) assert.ok(SAYS_WHAT.has(name), `a log line sends "${name}"`)
})

test("server logs go nowhere without both a real project key and PostHog's address", async () => {
  const load = async (key, endpoint, n) => {
    const before = [process.env.NEXT_PUBLIC_POSTHOG_KEY, process.env.POSTHOG_LOGS_ENDPOINT]
    if (key === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = key
    if (endpoint === undefined) delete process.env.POSTHOG_LOGS_ENDPOINT
    else process.env.POSTHOG_LOGS_ENDPOINT = endpoint
    try {
      return (await import(`../instrumentation.ts?case=${n}`)).logsOn
    } finally {
      for (const [name, value] of [["NEXT_PUBLIC_POSTHOG_KEY", before[0]], ["POSTHOG_LOGS_ENDPOINT", before[1]]]) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  }
  const ENDPOINT = "https://eu.i.posthog.com/i/v1/logs"
  assert.equal(await load(undefined, undefined, 1), false, "no settings: nothing sent")
  assert.equal(await load("phc_testprojectkey", undefined, 2), false, "a key alone sends no logs")
  assert.equal(await load(undefined, ENDPOINT, 3), false)
  assert.equal(await load("your_project_key", ENDPOINT, 4), false, "the .env.example placeholder is no key")
  assert.equal(await load("phc_testprojectkey", ENDPOINT, 5), true)
})

// ── the cookie question ──

test("the cookie question is asked when the site counts anything, and as an example when it doesn't, unless a copy leaves the example out", async () => {
  const { asksCookies } = await import("../lib/analytics-config.ts")
  assert.equal(asksCookies({}, true), true)
  assert.equal(asksCookies({ "cookies.example": "" }, true), true, "a blank example row never takes away the real question")
  assert.equal(asksCookies({}, false), true, "the example, before analytics is set up")
  assert.equal(asksCookies({ "cookies.example": "Just looking." }, false), true)
  assert.equal(asksCookies({ "cookies.example": " " }, false), false, "published blank: no example box")
})

test("the cookie question's shape is the cookies.shape row's word: bag, box or banner, and the bag otherwise", async () => {
  const { cookieShape, COOKIE_SHAPES } = await import("../lib/analytics-config.ts")
  assert.deepEqual([...COOKIE_SHAPES], ["bag", "box", "banner"])
  assert.equal(cookieShape({}), "bag", "no row: the bag")
  assert.equal(cookieShape({ "cookies.shape": "box" }), "box")
  assert.equal(cookieShape({ "cookies.shape": " Banner " }), "banner", "any case, any spacing")
  assert.equal(cookieShape({ "cookies.shape": "square" }), "bag", "a word the site doesn't know never takes the question away")
  assert.equal(cookieShape({ "cookies.shape": "" }), "bag", "unticked or blank: the bag")
  // the layout gives the notice the owner's choice
  assert.match(read("app/layout.tsx"), /<CookieNotice [^>]*shape=\{cookieShape\(content\)\}/)
})

test("an answer to the example is kept apart from the real one, which the loaders read", () => {
  const consent = read("lib/consent.ts")
  assert.match(consent, /export const EXAMPLE_CONSENT_KEY = "site-consent-example"/)
  const notice = read("components/layout/cookie-notice.tsx")
  assert.match(notice, /const key = example \? EXAMPLE_CONSENT_KEY : CONSENT_KEY/)
  // the loaders take the real key, never the example's
  for (const file of ["components/layout/posthog-analytics.tsx", "components/layout/google-analytics.tsx"]) {
    assert.doesNotMatch(read(file), /EXAMPLE_CONSENT_KEY/, file)
  }
})
