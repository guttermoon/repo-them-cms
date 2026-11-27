// lib/next-signal.ts: Next's control-flow signals pass through a catch;
// everything else is the catch's to handle.
import { test } from "node:test"
import assert from "node:assert/strict"

import { rethrowNextSignal } from "../lib/next-signal.ts"

const signal = (digest) => Object.assign(new Error("signal"), { digest })

test("a page bailing out of static rendering reaches Next", () => {
  const bailout = signal("DYNAMIC_SERVER_USAGE")
  assert.throws(() => rethrowNextSignal(bailout), (e) => e === bailout)
})

test("redirects and not-found reach Next too", () => {
  for (const digest of ["NEXT_REDIRECT;replace;/x;307;", "NEXT_NOT_FOUND"]) {
    assert.throws(() => rethrowNextSignal(signal(digest)), undefined, digest)
  }
})

test("an ordinary failure is left to the catch", () => {
  for (const error of [new Error("Brevo 500"), signal("12345"), null, undefined, "text", { digest: 7 }]) {
    assert.doesNotThrow(() => rethrowNextSignal(error))
  }
})
