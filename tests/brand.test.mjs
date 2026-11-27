// Notion's brand and trademark guidelines, held as tests (docs/brand.md has
// the rules and where they come from): Notion's name is never the product's,
// the official "Made for Notion" badge is used unaltered, once, in a
// secondary place, at least 48px tall and never animated, the attribution
// and the independence statement are printed and cannot be blanked from
// Notion, and nothing claims a standing with Notion the template does not
// have.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { SITE_DESCRIPTOR, SITE_NAME } from "../lib/site.ts"
import { ROOT, sourceFiles } from "./support/sources.mjs"

const read = (path) => readFileSync(join(ROOT, path), "utf8")

/** Every source file a reader's page is built from. */
const SOURCES = sourceFiles(["app", "components", "lib"], /\.(tsx?|mjs|css|md)$/)

/** The files Notion supplies, byte for byte as downloaded. */
const BADGE = {
  "made-for-notion-black.png": "781935d64bc2323cac70f5465dd8874a8e1919a2de3a73af96efd2a5589070e8",
  "made-for-notion-black.svg": "5a02ad13f522a698a1e96af32ade6e06423edd3cf50dbf483406362e97a2bbac",
  "made-for-notion-white.png": "19bf7069b4d2edf908bc7c274205fefd437230c18ce91a1b0cadee3fe47a0ffd",
  "made-for-notion-white.svg": "fa279ddcc2aab7889bb3def46deb1c47c4e7ced5bbfdd471b6295a4b759e8630",
}

test("Notion's name is not the product's: not in the name, the package or the repository's", () => {
  const pkg = JSON.parse(read("package.json"))
  for (const name of [SITE_NAME, pkg.name]) assert.doesNotMatch(name, /notion/i, name)
  // a smaller descriptor saying what it is for is allowed
  assert.match(SITE_DESCRIPTOR, /Notion/)
})

test("the badge files are Notion's own, unaltered, and the only Notion artwork in the repository", () => {
  const dir = join(ROOT, "public", "brand")
  assert.deepEqual(readdirSync(dir).sort(), Object.keys(BADGE).sort())
  for (const [file, hash] of Object.entries(BADGE)) {
    assert.equal(createHash("sha256").update(readFileSync(join(dir, file))).digest("hex"), hash, `${file} has been changed`)
  }
  const stray = []
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/notion/i.test(entry) && !full.startsWith(dir)) stray.push(relative(ROOT, full))
    }
  }
  walk(join(ROOT, "public"))
  walk(join(ROOT, "assets"))
  assert.deepEqual(stray, [], "a Notion logo or picture outside the badge")
})

test("the badge appears in one place, the footer, at 48px tall, and nothing moves it", () => {
  const using = SOURCES.filter((path) => read(path).includes("/brand/made-for-notion"))
  assert.deepEqual(using, ["components/layout/site-footer.tsx"])
  const footer = read("components/layout/site-footer.tsx")
  const anchor = footer.slice(footer.indexOf('data-badge="made-for-notion"') - 200, footer.indexOf("</a>", footer.indexOf('data-badge="made-for-notion"')))
  const images = anchor.match(/<img [^>]+>/g)
  assert.equal(images.length, 2, "black for light, white for dark; one shows at a time")
  for (const img of images) {
    assert.match(img, /height=\{48\}/)
    assert.match(img, /\bh-12\b/, "48px tall, the minimum")
    assert.match(img, /\bw-auto\b/, "never squashed")
    assert.match(img, /alt="Made for Notion"/)
    assert.doesNotMatch(img, /rotate|skew|animate|transition|opacity|filter|invert|grayscale|scale-/)
  }
  assert.doesNotMatch(anchor, /animate|transition|rotate|skew|scale-/)
  assert.match(images[0], /dark:hidden/)
  assert.match(images[1], /\bhidden\b.*dark:block/)
})

// The template's credit: the code is MIT, so a copy can take it out, but a
// copy's owner can't blank it from Notion, and README asks them to keep it.
test("the template's credit is printed beside the copyright, outside any Notion slot, and in every page's head", () => {
  const footer = read("components/layout/site-footer.tsx").replace(/\s+/g, " ")
  const at = footer.indexOf('data-credit="template"')
  assert.ok(at > 0, "the credit is in the footer")
  const paragraph = footer.slice(at, footer.indexOf("</p>", at))
  assert.match(paragraph, /© \{year\} \{name\}/)
  assert.match(paragraph, /\{renamed \? <>\. Built on \{TEMPLATE_NAME\}<\/> : null\} a\{" "\}/)
  // each link to another site opens in a new tab (lib/outside.ts)
  assert.match(paragraph, /<a href=\{REPO_URL\} className="n-link" \{\.\.\.outsideLink\(REPO_URL\)\}> GitHub <\/a>/)
  assert.match(paragraph, /template by\{" "\} <a href=\{MAKER\.url\} className="n-link" title=\{MAKER\.name\} \{\.\.\.outsideLink\(MAKER\.url\)\}> \{MAKER\.studio\} <\/a> \. <T k="footer\.license">/)
  // the credit itself sits before the one slot in the line, outside it
  assert.ok(paragraph.indexOf("template by") < paragraph.indexOf("<T "), "the credit is not inside a slot")
  assert.doesNotMatch(paragraph.slice(0, paragraph.indexOf("<T ")), /<T\b/)
  assert.doesNotMatch(paragraph, /nofollow/, "the credit's link counts as one")
  const layout = read("app/layout.tsx")
  assert.match(layout, /generator: `\$\{TEMPLATE_NAME\} a GitHub template by \$\{MAKER\.studio\}`/)
  assert.match(read("README.md"), /please\s+keep\s+the\s+credit/i, "README asks a copy to keep it")
})

test("the attribution and the independence statement are printed in the footer, outside any Notion slot", () => {
  const footer = read("components/layout/site-footer.tsx").replace(/\s+/g, " ")
  assert.ok(footer.includes("Notion and the Notion logo are trademarks of Notion Labs, Inc., and are used here with permission."))
  assert.ok(footer.includes("is an independent template, not made, endorsed or maintained by Notion Labs, Inc."))
  // the paragraph that holds them is plain text: a blank Notion row cannot hide it
  const at = footer.indexOf("is an independent template")
  const paragraph = footer.slice(footer.lastIndexOf("<p", at), footer.indexOf("</p>", at))
  assert.doesNotMatch(paragraph, /<T\b/)
})

// A claim of a standing with Notion. Saying the opposite ("not endorsed by
// Notion") is the independence statement, not a claim, and neither is the
// FAQ's question "Is it made by Notion?", which it answers "No".
const NEGATED = String.raw`(?<!\b(?:not|nor|never|neither|isn['’]t)\s+(?:\w+\s+){0,2})`
const CLAIMS = new RegExp(
  `${NEGATED}(?:notion[- ](?:certified|partner|ambassador|approved|verified|consultant)|official notion|notion'?s official|endorsed by notion|in partnership with notion|built by notion|made by notion(?!\\?))`,
  "i",
)

test("the claim check catches a claim and lets the independence statement through", () => {
  for (const claim of ["Endorsed by Notion", "a Notion-certified consultant", "the official Notion template", "Made by Notion.", "built by Notion"]) {
    assert.match(claim, CLAIMS, claim)
  }
  for (const fine of ["not endorsed by Notion", "Not Notion's and not endorsed by Notion.", "Is it made by Notion?", "never built by Notion", "not made, endorsed or maintained by Notion Labs"]) {
    assert.doesNotMatch(fine, CLAIMS, fine)
  }
})

test("no claim of a standing with Notion: not certified, not a partner, not official, not endorsed", () => {
  for (const path of SOURCES) {
    const text = read(path)
    const found = text.match(CLAIMS)
    assert.equal(found, null, `${path}: "${found?.[0]}"`)
  }
})

test("no picture from notion.com's own site, gallery or illustrations is used", () => {
  for (const path of SOURCES) {
    assert.doesNotMatch(read(path), /notion\.so\/images|notion\.com\/(front-static|images)|www\.notion\.so\/image|images\.ctfassets\.net/, path)
  }
})
