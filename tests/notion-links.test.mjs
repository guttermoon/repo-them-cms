// Links from Notion's text to this site's own pages (lib/notion/links.ts):
// Notion's API takes only full addresses, and keeps a path written as a link
// on its own app, so the site reads a link to its own address, or a path kept
// on Notion's app, back as the path; and the setup sends a path as Notion
// would keep it.
import { test } from "node:test"
import assert from "node:assert/strict"

import { NOTION_APP, sendableHref, sitePathFromHref } from "../lib/notion/links.ts"

const SITE = "https://www.shop.example"

test("a path Notion kept on its app comes back as the path, with its query and anchor", () => {
  assert.equal(sitePathFromHref(`${NOTION_APP}/pricing`, SITE), "/pricing")
  assert.equal(sitePathFromHref(`${NOTION_APP}/contact?type=plan#form`, SITE), "/contact?type=plan#form")
  assert.equal(sitePathFromHref(`${NOTION_APP}/`, SITE), "/")
})

test("the site's own full address comes back as the path, with or without www, over http or https", () => {
  assert.equal(sitePathFromHref("https://shop.example/about", SITE), "/about")
  assert.equal(sitePathFromHref("http://www.shop.example/blog/post?x=1", SITE), "/blog/post?x=1")
  assert.equal(sitePathFromHref("https://WWW.SHOP.EXAMPLE/team", SITE), "/team")
})

test("anything else is not a link to this site", () => {
  for (const href of [
    "https://developers.notion.com/reference",
    "https://www.notion.so/pricing",
    "https://www.notion.com/help",
    "https://shop.example.org/about",
    "https://evil.example/?u=https://shop.example/",
    "mailto:hello@shop.example",
    "/pricing",
    "not a url",
    "",
  ]) {
    assert.equal(sitePathFromHref(href, SITE), undefined, href)
  }
  assert.equal(sitePathFromHref("https://shop.example/about", "not a url"), undefined)
})

test("the setup sends a path as Notion keeps one, and a full address as written", () => {
  assert.equal(sendableHref("/pricing"), `${NOTION_APP}/pricing`)
  assert.equal(sendableHref("/contact?type=plan"), `${NOTION_APP}/contact?type=plan`)
  assert.equal(sendableHref("https://developers.notion.com/"), "https://developers.notion.com/")
  assert.equal(sendableHref("//cdn.example/x"), "//cdn.example/x")
  assert.equal(sitePathFromHref(sendableHref("/pricing"), SITE), "/pricing")
})
