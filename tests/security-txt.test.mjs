// /.well-known/security.txt (lib/security-txt.ts, RFC 9116): the site's own
// contact for a security problem, never the template's maker's; a policy,
// a language and its own address; an expiry less than a year ahead that is
// never in the past; and nothing a setting could add lines to.
import { test } from "node:test"
import assert from "node:assert/strict"

const { contactUri, EXPIRES_DAYS, securityTxt } = await import("../lib/security-txt.ts")
const { MAKER } = await import("../lib/site.ts")

const NOW = new Date("2026-11-26T17:30:00Z")
const fields = (text) => text.trim().split("\n").map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 2)])
const draw = (over = {}) => securityTxt({ siteUrl: "https://site.example", language: "en-GB", now: NOW, ...over })

test("every field RFC 9116 asks for, one a line, and the contact form always among the contacts", () => {
  const text = draw()
  assert.match(text, /\n$/, "ends with a line break")
  const got = fields(text)
  for (const [name, value] of got) {
    assert.match(name, /^(Contact|Expires|Policy|Preferred-Languages|Canonical)$/, name)
    assert.ok(value.length > 0, name)
  }
  assert.deepEqual(got.filter(([n]) => n === "Contact").map(([, v]) => v), ["https://site.example/contact?type=problem"])
  assert.equal(Object.fromEntries(got).Policy, "https://site.example/security")
  assert.equal(Object.fromEntries(got).Canonical, "https://site.example/.well-known/security.txt")
  assert.equal(Object.fromEntries(got)["Preferred-Languages"], "en")
  assert.equal(got.filter(([n]) => n === "Expires").length, 1, "one Expires")
})

test("it expires half a year after it is drawn: less than the RFC's year, and never already past", () => {
  const expires = new Date(Object.fromEntries(fields(draw())).Expires)
  assert.match(Object.fromEntries(fields(draw())).Expires, /^\d{4}-\d{2}-\d{2}T00:00:00Z$/, "an RFC 3339 time, as the RFC asks")
  const days = (expires - NOW) / 86_400_000
  assert.ok(days > EXPIRES_DAYS - 1 && days <= EXPIRES_DAYS, `${days} days`)
  assert.ok(days < 365)
})

test("the site's own contacts come first, in order, and the maker's address only if the site sets it", () => {
  const text = draw({ securityContact: "security@site.example", publicEmail: "hello@site.example" })
  assert.deepEqual(
    fields(text).filter(([n]) => n === "Contact").map(([, v]) => v),
    ["mailto:security@site.example", "mailto:hello@site.example", "https://site.example/contact?type=problem"],
  )
  assert.ok(!draw().includes(MAKER.email), "a copy's reports never go to the template's maker")
  assert.equal(fields(draw({ securityContact: "hello@site.example", publicEmail: "hello@site.example" })).filter(([n]) => n === "Contact").length, 2, "no contact twice")
  assert.deepEqual(fields(draw({ securityContact: "https://site.example/report" })).filter(([n]) => n === "Contact")[0], ["Contact", "https://site.example/report"])
})

test("a contact that is not one, or would add lines of its own, is left out", () => {
  assert.equal(contactUri("mailto:sec@site.example"), "mailto:sec@site.example")
  assert.equal(contactUri("  sec@site.example "), "mailto:sec@site.example")
  assert.equal(contactUri("https://site.example/security"), "https://site.example/security")
  for (const bad of ["", "   ", "not an address", "http://site.example/report", "javascript:alert(1)", "mailto:nobody", "sec@site.example\nContact: mailto:evil@attacker.example", "sec@site.example\r\nExpires: 2099-01-01T00:00:00Z", undefined]) {
    assert.equal(contactUri(bad), undefined, JSON.stringify(bad))
  }
  const text = draw({ securityContact: "a@site.example\nContact: mailto:evil@attacker.example" })
  assert.ok(!text.includes("attacker"), "no line of a setting's own")
})

test("the route answers plain text, and /security.txt at the root goes there", async () => {
  const route = await import("../app/.well-known/security.txt/route.ts")
  const res = route.GET()
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8")
  assert.match(await res.text(), /^Contact: .+\/contact\?type=problem$/m)
  assert.equal(route.dynamic, "force-static")
  assert.equal(route.revalidate, 86400, "drawn again each day, so Expires is never stale")
  const { default: config } = await import("../next.config.mjs")
  const redirect = (await config.redirects()).find((r) => r.source === "/security.txt")
  assert.deepEqual(redirect && { to: redirect.destination, permanent: redirect.permanent }, { to: "/.well-known/security.txt", permanent: true })
})
