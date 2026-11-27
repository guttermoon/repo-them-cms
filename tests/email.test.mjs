// The one rule for "is this an email address", used by the contact and
// subscribe routes and both forms (lib/email/address.ts).
import { test } from "node:test"
import assert from "node:assert/strict"

import { looksLikeEmail, NOT_AN_EMAIL } from "../lib/email/address.ts"

test("ordinary addresses pass", () => {
  for (const address of [
    "hello@example.com",
    "reader+news@mail.example.org",
    "a@b.example",
    "  padded@example.com  ",
  ]) {
    assert.equal(looksLikeEmail(address), true, address)
  }
})

test("obvious slips are caught", () => {
  for (const address of [
    "",
    "   ",
    "hello",
    "hello@",
    "@example.com",
    "hello@example",
    "hello@example.c", // a one-letter ending is a typo, not a domain
    "hello @example.com",
    "hello@exa mple.com",
    "two@@example.com",
  ]) {
    assert.equal(looksLikeEmail(address), false, JSON.stringify(address))
  }
})

test("the footer and the routes agree on a.b.c addresses", () => {
  // One rule for the footer and the routes, so neither can let through what
  // the other refuses.
  assert.equal(looksLikeEmail("a@b.c"), false)
})

test("the refusal has no em dash in it", () => {
  assert.doesNotMatch(NOT_AN_EMAIL, /—/)
})
