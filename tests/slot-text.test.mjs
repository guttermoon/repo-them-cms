// A slot read as a plain string (lib/slots.ts `slotText`), for /llms.txt and
// structured data: they say what the page says, and a row hides a slot for
// them as it does on the page. And the starter questions' answers written as
// a Question row's text (lib/demo/questions.ts `answerText`).
import { test } from "node:test"
import assert from "node:assert/strict"

import { answerText } from "../lib/demo/questions.ts"
import { styledText } from "../lib/inline-text.ts"
import { slotText } from "../lib/slots.ts"

test("a slot with no row reads as its default", () => {
  assert.equal(slotText({}, "llms.fact.what", "What it is."), "What it is.")
})

test("a row wins, its links read as their words and its line breaks as spaces", () => {
  const content = { k: "Read the [Privacy notice](https://example.test/privacy)\nfor the detail." }
  assert.equal(slotText(content, "k", "default"), "Read the Privacy notice for the detail.")
})

test("a formatted row reads as its words, the formatting gone", () => {
  const content = { k: styledText([{ plain_text: "Bold", annotations: { bold: true } }, { plain_text: " and plain." }]) }
  assert.equal(slotText(content, "k", "default"), "Bold and plain.")
})

test("a row left blank hides the slot: nothing, not the default", () => {
  assert.equal(slotText({ k: "  " }, "k", "default"), "")
  assert.equal(slotText({ k: "" }, "k", "default"), "")
})

test("an answer's paragraphs are a blank line apart, a link in its parts written as the site reads one", () => {
  const text = answerText([
    "Yes.",
    { parts: ["Write to", { link: "hello@example.com", href: "mailto:hello@example.com" }, "or visit", { link: "example.com", href: "https://example.com" }, "."] },
  ])
  assert.equal(text, "Yes.\n\nWrite to [hello@example.com](mailto:hello@example.com) or visit [example.com](https://example.com).")
})

test("a button goes where a link in its row points, else where the code says", async () => {
  const { slotHref } = await import("../lib/slots.ts")
  assert.equal(slotHref({}, "home.cta.shop", "/shop"), "/shop", "no row: the code's address")
  assert.equal(slotHref({ "home.cta.shop": "Shop the shelf" }, "home.cta.shop", "/shop"), "/shop", "a row with no link: the code's address")
  assert.equal(slotHref({ "home.cta.shop": "[Get the template](https://github.com/example/template)" }, "home.cta.shop", "/shop"), "https://github.com/example/template")
  const styled = styledText([{ plain_text: "Get it", annotations: { bold: true }, href: "https://github.com/example/template" }])
  assert.equal(slotHref({ k: styled }, "k", "/shop"), "https://github.com/example/template", "a formatted link too")
  assert.equal(slotHref({ k: "[Plans](https://app.notion.com/pricing)" }, "k", "/shop"), "/pricing", "a path Notion kept on its app is the path")
  assert.equal(slotHref({ k: "[x](javascript:alert(1))" }, "k", "/shop"), "/shop", "an unsafe link is ignored")
})

test("the site's name, descriptor and noun are slots, and a blank row falls back, as a name must", async () => {
  const { siteDescriptor, siteName, siteNoun } = await import("../lib/slots.ts")
  const { SITE_DESCRIPTOR, SITE_NAME, SITE_NOUN } = await import("../lib/site.ts")
  assert.equal(siteName({}), SITE_NAME)
  assert.equal(siteName({ "site.name": "Acme" }), "Acme")
  assert.equal(siteName({ "site.name": " " }), SITE_NAME)
  assert.equal(siteDescriptor({ "site.descriptor": "Plain goods" }), "Plain goods")
  assert.equal(siteDescriptor({}), SITE_DESCRIPTOR)
  assert.equal(siteNoun({}), SITE_NOUN)
})
