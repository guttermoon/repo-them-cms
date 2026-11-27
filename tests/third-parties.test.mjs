// No third party hears from a visitor before they ask for it
// (docs/privacy-and-security.md). Fonts are the easy one to break: a <link>
// or @import to Google Fonts sends every visitor's IP address to Google on
// the first paint, before the cookie question has been answered (the GDPR
// fault a Munich court awarded damages for in 2022, 3 O 17493/20). The site
// serves its faces from its own committed files; this file fails if anything
// reaches past them, at build time or in the browser.
//
// In a browser, `npm run privacy` checks every page against a running server.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ROOT, sources } from "./support/sources.mjs"

const SOURCE = ["app", "components", "lib"]
const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

/** Every page, component, stylesheet and script under `dirs`. */
const files = (dirs) => sources(dirs, /\.(tsx?|css|mjs|js)$/)

test("no page, component or stylesheet loads anything from Google's font servers", () => {
  const offenders = []
  for (const { path, text } of files(SOURCE)) if (GOOGLE_FONTS.test(text)) offenders.push(path)
  assert.deepEqual(offenders, [])
})

test("no stylesheet imports a remote file or declares a remote font", () => {
  for (const { path: file, text: css } of files("app")) {
    if (!file.endsWith(".css")) continue
    assert.doesNotMatch(css, /@import\s+(url\()?["']?https?:/i, file)
    assert.doesNotMatch(css, /@font-face[^}]*url\(["']?https?:/is, file)
  }
})

test("the faces are this site's own files: next/font/local, never next/font/google", () => {
  for (const { path, text } of files(SOURCE)) assert.doesNotMatch(text, /from ["']next\/font\/google["']/, `${path} would fetch fonts from Google at build time`)
  const fonts = readFileSync(join(ROOT, "app/fonts.ts"), "utf8")
  assert.match(fonts, /from "next\/font\/local"/)
  const paths = [...fonts.matchAll(/path: "\.\.\/(assets\/fonts\/[^"]+)"/g)].map((m) => m[1])
  assert.ok(paths.length >= 8, "every face, Latin and Latin Extended")
  for (const path of paths) assert.ok(statSync(join(ROOT, path)).size > 1000, `${path} is missing`)
  // every face's licence travels with it
  for (const licence of ["LICENSE-roboto-slab.txt", "OFL-inter.txt", "OFL-source-serif-4.txt", "OFL-ibm-plex-mono.txt"]) {
    assert.ok(statSync(join(ROOT, "assets/fonts", licence)).isFile(), licence)
  }
  const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8")
  assert.match(layout, /FONT_VARIABLES/)
  assert.doesNotMatch(layout, /<link[^>]+stylesheet/i)
})

test("the browser is told to refuse a font or a stylesheet from anywhere else", async () => {
  const { default: config } = await import("../next.config.mjs")
  const headers = (await config.headers()).flatMap((rule) => rule.headers)
  const csp = headers.find((header) => header.key === "Content-Security-Policy")
  assert.ok(csp, "no Content-Security-Policy header")
  assert.match(csp.value, /(^|;)\s*font-src 'self'\s*(;|$)/)
  // a stylesheet from Google Fonts is itself the request that leaks the address
  assert.match(csp.value, /(^|;)\s*style-src 'self'( 'unsafe-inline')?\s*(;|$)/)
})

test("every page has the site's policy; a file from /media/ has only its own, which runs nothing", async () => {
  const { default: config } = await import("../next.config.mjs")
  // matched as Next matches a rule's source (next/dist/shared/lib/router/utils/path-match)
  const { getPathMatch } = await import("next/dist/shared/lib/router/utils/path-match.js")
  const rules = await config.headers()
  const on = (path) => rules.filter((rule) => getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(path)).flatMap((rule) => rule.headers)
  const policyOn = (path) => on(path).filter((h) => h.key === "Content-Security-Policy")
  for (const path of ["/", "/blog", "/blog/hello", "/api/feedback", "/markdown/blog/hello", "/og/blog/hello", "/_next/static/chunk.js", "/mediakit"]) {
    assert.equal(policyOn(path).length, 1, path)
  }
  assert.deepEqual(policyOn("/media/abc.def/picture.svg"), [], "the media route's own policy is the only one")
  for (const path of ["/blog", "/media/abc.def/picture.svg"]) assert.ok(on(path).some((h) => h.key === "X-Content-Type-Options"), `${path}: the other headers still go`)
  const route = readFileSync(join(ROOT, "app/media/[...parts]/route.ts"), "utf8")
  assert.match(route, /"Content-Security-Policy": "default-src 'none';[^"]*sandbox"/)
  assert.doesNotMatch(/script-src[^;]*/.exec(route.match(/"Content-Security-Policy": "([^"]+)"/)[1])?.[0] ?? "", /unsafe/)
})

test("only next dev loosens the policy", () => {
  const source = readFileSync(join(ROOT, "next.config.mjs"), "utf8")
  assert.match(source, /const dev = process\.env\.NODE_ENV === "development"/)
})

test("Next's image optimiser is off, and lets no host through", async () => {
  const { default: config } = await import("../next.config.mjs")
  assert.deepEqual(config.images, { unoptimized: true }, "no loader, no remote patterns, no domains")
})
