// Every word a page prints comes from Notion: from a Site Copy slot, or from
// the content itself (CLAUDE.md, "Every word is a Notion slot"). And this is
// how `npm run copy` lists every slot there is (scripts/dump-copy.mjs).
//
// tests/every-word.test.mjs reads the code for words typed into the markup.
// This catches what reading cannot: a word kept in a table of data, or built
// by a helper. Every page, and the frame round them, is rendered from the
// starter content twice:
//
// - once to learn every slot it reads (lib/copy-dump.ts is the hook), with
//   the content and with none, and through each page's metadata, share card
//   and /llms.txt too;
// - once with every one of those slots published as a marker, "§", and every
//   word of the content (the rows' titles, names and text, the page bodies)
//   replaced by a marker of its own, "¤1", "¤2"…
//
// Whatever still has a letter in it was written in the code. Only the few
// words that must not be slots, listed below with the reason, may remain,
// along with what a row holds that is not words but is printed: an option's
// name (a resource's Action), a code block's language, an address's host. A
// date is a <time>, a code sample <pre> or <code>, and an equation KaTeX's:
// none are words.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { CookieNotice } from "@/components/layout/cookie-notice"
import { Feedback } from "@/components/layout/feedback"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ServiceCounter } from "@/components/sections/service-counter"
import { makeT, pickCopy, siteName } from "@/components/system/notion-text"
import { themeIcons } from "@/components/ui/theme-icons"
import { feedTitle } from "@/lib/feed"
import { llmsFullTxt, llmsTxt } from "@/lib/llms"
import { ogWords } from "@/lib/og-words"
import { metaSlots } from "@/lib/page-meta"
import { isRelease, menusFor } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { startFakeNotion } from "@/lib/demo/fake-notion"
import { STYLED } from "@/lib/inline-text"
import { siteLd } from "@/lib/structured-data"
import { siteIcon, siteLogo } from "@/lib/share"
import { EMPTY_SITE_DATA, type Entry, type SiteData } from "@/lib/notion/rows"
import { BUNDLED_LANGUAGES } from "@/lib/highlight"
import { KINDS, PROPS } from "@/lib/notion/schema"
import { MAKER, MAKER_HOST, SITE_LANGUAGE, TEMPLATE_NAME } from "@/lib/site"

import { HIDDEN_SLOTS, STARTER_ONLY_SLOTS } from "../support/hidden-slots"
import { sources } from "../support/sources.mjs"
import { accessibleName, dynamicPageRoutes, fillRoute, pageRoutes, ROOT } from "./support/checks"

const MARK = "§"
const CONTENT = "¤"

const seen = vi.hoisted(() => ({
  /** every slot a render read, with its built-in wording */
  keys: new Set<string>(),
  /** the slots read while the site had content, and while it had none */
  dataKeys: new Set<string>(),
  emptyKeys: new Set<string>(),
  defaults: new Map<string, string>(),
  /** render as a site with no content at all */
  empty: false,
  /** once set: render with these slots in place of the content's */
  copy: undefined as Record<string, string> | undefined,
  /** whether the content's own words are marked as well */
  marking: false,
  /** whether marked words come formatted, as Notion's runs (lib/inline-text.ts) */
  styling: false,
  /** what a row holds that a page prints but is not words: option names,
   *  code languages; and the addresses whose parts a page prints */
  options: new Set<string>(),
  addresses: new Set<string>(),
  /** one marker for each distinct word of the content, so two rows that
   *  shared a category still do */
  markers: new Map<string, string>(),
}))

const mark = (words: string) => {
  if (!seen.markers.has(words)) seen.markers.set(words, `¤${seen.markers.size}`)
  return seen.markers.get(words)!
}

/** Words as a formatted row keeps them: bold, then italic (lib/inline-text.ts). */
const styled = (words: string) => STYLED + JSON.stringify([{ t: words, b: 1 }, { t: " ", i: 1 }])

/** A row with its words marked: what it says, never what the code reads it
 *  by (its Kind, its slug, its Action, its link, its stock). The words a row
 *  keeps formatted (description, text, a bio) come formatted when asked. */
function markEntry(entry: Entry): Entry {
  const rich = (words: string) => (seen.styling ? styled(mark(words)) : mark(words))
  return {
    ...entry,
    title: mark(entry.title),
    description: entry.description && rich(entry.description),
    ...(entry.text ? { text: rich(entry.text) } : {}),
    ...(entry.priceNote ? { priceNote: mark(entry.priceNote) } : {}),
    ...(entry.button ? { button: mark(entry.button) } : {}),
    // a category's name is what it says, but for Releases, which the code
    // reads a release by (isRelease), as it reads a row by its Kind
    ...(entry.category && !isRelease(entry) ? { category: { ...entry.category, name: mark(entry.category.name) } } : {}),
    tags: entry.tags.map((t) => ({ ...t, name: mark(t.name) })),
    ...(entry.author
      ? { author: { ...entry.author, name: mark(entry.author.name), bio: entry.author.bio && rich(entry.author.bio), ...(entry.author.role ? { role: mark(entry.author.role) } : {}) } }
      : {}),
    ...(entry.variants ? { variants: entry.variants.map((v) => ({ ...v, label: mark(v.label) })) } : {}),
  }
}

/** A page body with its words marked: every run of rich text, every file's
 *  name, every child page's title. */
function markBlocks(value: unknown, field = ""): unknown {
  if (typeof value === "string") {
    if (["plain_text", "content", "name", "title"].includes(field)) return mark(value)
    if (field === "language") seen.options.add(value)
    if (field === "url") seen.addresses.add(value)
    return value
  }
  if (Array.isArray(value)) return value.map((v) => markBlocks(v, field))
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, markBlocks(v, k)]))
  return value
}

vi.mock("@/lib/copy-dump", async (original) => {
  const real = await original<typeof import("@/lib/copy-dump")>()
  return {
    ...real,
    recordCopyKey: (key: string, children: Parameters<typeof real.recordCopyKey>[1]) => {
      seen.keys.add(key)
      ;(seen.empty ? seen.emptyKeys : seen.dataKeys).add(key)
      // the first wording wins: a slot on two pages is one row
      if (!seen.defaults.has(key)) seen.defaults.set(key, real.toText(children))
    },
  }
})

vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return {
    ...real,
    getSiteData: async (): Promise<SiteData> => {
      if (seen.empty) return seen.copy ? { ...EMPTY_SITE_DATA, copy: seen.copy } : EMPTY_SITE_DATA
      const data = await real.getSiteData()
      for (const e of data.entries) {
        if (e.action) seen.options.add(e.action)
        if (e.stock) seen.options.add(e.stock.name)
        if (e.link) seen.addresses.add(e.link)
        // Releases is read by the code (isRelease) as an Action is: the
        // category's name is left as it is, and a page may print it
        if (isRelease(e)) seen.options.add(e.category!.name)
      }
      if (!seen.copy) return data
      return { copy: seen.copy, entries: seen.marking ? data.entries.map(markEntry) : data.entries }
    },
  }
})

vi.mock("@/lib/content/blocks", async (original) => {
  const real = await original<typeof import("@/lib/content/blocks")>()
  return {
    ...real,
    getBlocks: async (entry: Parameters<typeof real.getBlocks>[0]) => {
      const blocks = await real.getBlocks(entry)
      return (seen.marking ? markBlocks(blocks) : blocks) as typeof blocks
    },
  }
})

// the code block unhighlighted, and Notion's SDK talking to a stand-in from
// a "browser" (tests/dom/support/mocks.tsx)
vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))
vi.mock("@notionhq/client", async (original) => (await import("./support/mocks")).browserNotion(original))

const hasLetters = (s: string) => /\p{L}/u.test(s)

/** Words that are not slots, and why. */
const NOT_SLOTS: { words: string; why: string }[] = [
  { words: TEMPLATE_NAME, why: "the template's name, in its credit (lib/site.ts): the site's own is a slot, `site.name`" },
  { words: MAKER.name, why: "the maker's credit (lib/site.ts)" },
  { words: MAKER.email, why: "the maker's public address (lib/site.ts)" },
  { words: MAKER_HOST, why: "the maker's site (lib/site.ts)" },
  {
    words:
      "is an independent template, not made, endorsed or maintained by Notion Labs, Inc. Notion and the Notion logo are trademarks of Notion Labs, Inc., and are used here with permission.",
    why: "Notion's brand rules: printed outside any slot so it cannot be blanked (docs/brand.md)",
  },
  { words: MAKER.studio, why: "the maker's studio, in the template's credit (lib/site.ts)" },
  { words: "Made for Notion", why: "the badge's own words" },
  { words: "Aa", why: "a type specimen: letters shown as letters" },
  // the cookie question's tools: their own names, which must be the tools
  // actually loaded, so they are code (the strip's tools are slots, `logos.*`)
  ...["PostHog", "Google Analytics"].map((words) => ({ words, why: "a tool's own name" })),
  // /setup's table of what a row can be: the database's own names, which
  // have to match it exactly (lib/notion/schema.ts)
  ...[...KINDS, ...Object.values(PROPS)].map((words) => ({ words, why: "a name in the Notion database" })),
  // a code block's language, over the code
  ...BUNDLED_LANGUAGES.map((words) => ({ words, why: "a programming language's name" })),
  // "A, B and C": the joining words of the site's language, from Intl
  ...new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" })
    .formatToParts(["a", "b", "c"])
    .filter((part) => part.type === "literal" && hasLetters(part.value))
    .map((part) => ({ words: part.value.trim(), why: "a list's joining word, in the site's language (Intl)" })),
]
const ALLOWED = NOT_SLOTS.map((n) => n.words).sort((a, b) => b.length - a.length)

/** Not words: dates, code, equations. */
const NOT_WORDS = "time, pre, code, .katex, script, style"

/** The copyright and the template's credit ("© 2026 REPO THEM a GitHub
 *  template by Denot", or "… Acme. Built on REPO THEM a GitHub template by
 *  Denot" once renamed) are printed outside any slot so they can't be
 *  blanked; their own words are allowed there and nowhere else, so a bare
 *  "template by" elsewhere is still caught. */
const CREDIT = '[data-credit="template"]'
const CREDIT_WORDS = new Set(["Built on", "a", "GitHub", "template by"])
const creditWords = (node: Node) =>
  Boolean(node.parentElement?.closest(CREDIT)) && CREDIT_WORDS.has((node.textContent ?? "").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim())
const ATTRIBUTES = ["alt", "aria-label", "aria-description", "aria-roledescription", "aria-valuetext", "title", "placeholder"]

/** What is left of a string with the markers and the allowed words taken
 *  out: "" when nothing with a letter is. */
/** `words` wherever it stands as words of its own, not inside another word. */
const whole = (words: string) => new RegExp(`(?<![\\p{L}\\p{N}])${words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu")

function residue(text: string): string {
  let rest = text.split(MARK).join(" ").replace(/¤\d+/g, " ")
  for (const words of [...ALLOWED, ...seen.options]) rest = rest.replace(whole(words), " ")
  rest = rest.replace(/\s+/g, " ").trim()
  if (!hasLetters(rest)) return ""
  // a part of an address a row holds: its host, a file's name
  if (/[./]/.test(rest) && [...seen.addresses].some((a) => a.toLowerCase().includes(rest.toLowerCase()))) return ""
  return rest
}

function leftovers(root: Element, where: string): string[] {
  const out: string[] = []
  const check = (text: string, how: string) => {
    const rest = residue(text)
    if (rest) out.push(`${where} (${how}): "${rest.slice(0, 90)}"`)
  }
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(NOT_WORDS) || creditWords(node)) continue
    check(node.textContent ?? "", "text")
  }
  for (const el of root.querySelectorAll("*")) {
    for (const name of ATTRIBUTES) {
      const value = el.getAttribute(name)
      if (value) check(value, name)
    }
    if (el.matches('input[type="submit"], input[type="button"]')) check(el.getAttribute("value") ?? "", "value")
  }
  return out
}

type PageModule = {
  default: (props: Record<string, unknown>) => Promise<ReactElement> | ReactElement
  generateStaticParams?: () => Promise<Record<string, string | string[]>[]>
  generateMetadata?: (props: Record<string, unknown>) => Promise<unknown>
}
type Route = { route: string; file: string | null; params: Record<string, string | string[]> }

const fake = await startFakeNotion()
Object.assign(process.env, { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: fake.databaseId, NOTION_API_BASE_URL: fake.url })
afterAll(async () => {
  await fake.close()
  for (const key of ["NOTION_TOKEN", "NOTION_DATABASE_ID", "NOTION_API_BASE_URL"]) delete process.env[key]
})

/** Every page, those whose addresses come from rows as the data has them
 *  now, the 404, and the frame round every page. */
async function routes(): Promise<Route[]> {
  const out: Route[] = pageRoutes().map(({ route, file }) => ({ route, file, params: {} }))
  for (const { template, file } of dynamicPageRoutes()) {
    const mod = (await import(/* @vite-ignore */ file)) as PageModule
    for (const params of (await mod.generateStaticParams?.()) ?? []) out.push({ route: fillRoute(template, params), file, params })
  }
  return [...out, { route: "/404", file: join(ROOT, "app", "not-found.tsx"), params: {} }, { route: "the frame round every page", file: null, params: {} }]
}

/** Every slot a page reads beside its body: its metadata, its share card,
 *  and what /llms.txt and the feed say of it; and for the frame, the site's
 *  own structured data (the root layout's, with the logo's words) and its
 *  icon (the root layout's metadata). */
async function readAround({ route, file, params }: Route) {
  if (file) await ((await import(/* @vite-ignore */ file)) as PageModule).generateMetadata?.({ params, searchParams: {} })
  if (route.startsWith("/")) await ogWords(route)
  else {
    const data = await getSiteData()
    siteLd(data)
    siteIcon(data)
  }
}

/** One page, or the frame, as a detached copy. */
async function draw({ file, params }: Route): Promise<Element> {
  const data = await getSiteData()
  const element = file ? (
    await ((await import(/* @vite-ignore */ file)) as PageModule).default({ params, searchParams: {} })
  ) : (
    <>
      <SkipLink content={pickCopy(data.copy, "nav.")} />
      <SiteHeader content={pickCopy(data.copy, "nav.")} brand={siteName(data.copy)} getHref="https://github.com/example/template" shop themeIcons={themeIcons()} menus={menusFor(data)} logo={siteLogo(data)} />
      <ServiceCounter T={makeT(data.copy)} content={data.copy} />
      {/* the mailing list as a placeholder, as it is until an email platform is set */}
      <SiteFooter content={data.copy} columns={menusFor(data).footer} cookies emailReady={false} logo={siteLogo(data)} />
      <Feedback content={pickCopy(data.copy, "feedback.")} ready />
      <CookieNotice content={pickCopy(data.copy, "cookies.")} posthog google />
      {/* and as the example it is until analytics is set up */}
      <CookieNotice content={pickCopy(data.copy, "cookies.")} posthog={false} google={false} example />
    </>
  )
  const { container, unmount } = render(<CartProvider>{element}</CartProvider>)
  const copy = container.cloneNode(true) as Element
  unmount()
  return copy
}

describe("every word on every page is a slot or the content's own", () => {
  const found: string[] = []
  let first: Route[] = []
  let second: Route[] = []

  beforeAll(async () => {
    // first: which slots do the pages read, with the starter content, and
    // as a site with no content at all?
    first = await routes()
    for (const route of first) {
      await draw(route)
      await readAround(route)
    }
    const data = await getSiteData()
    llmsTxt(data)
    llmsFullTxt(data)
    feedTitle(data.copy, siteName(data.copy))
    seen.empty = true
    for (const route of await routes()) {
      await draw(route)
      await readAround(route)
    }
    seen.empty = false
    // then everything again, every slot and every word of the content a
    // marker; and again while that shows a slot not yet seen (an empty
    // state, the built-in rows that stand in for the content's)
    for (let size = 0; size !== seen.keys.size; ) {
      size = seen.keys.size
      seen.copy = Object.fromEntries([...seen.keys].map((key) => [key, MARK]))
      seen.marking = true
      second = await routes()
      found.length = 0
      for (const route of second) found.push(...leftovers(await draw(route), route.route))
    }
  }, 480_000)

  test("every page was drawn twice, from the starter content, with its slots read", () => {
    expect(first.length).toBeGreaterThan(30)
    expect(second.length, "the marked content makes the same pages").toBe(first.length)
    expect(seen.keys.size, "slots read").toBeGreaterThan(500)
    expect(seen.markers.size, "the content's own words").toBeGreaterThan(200)
  })

  test("nothing else is printed", () => {
    expect([...new Set(found)]).toEqual([])
  })

  test("every slot written out in the code was read, so `npm run copy` lists it", () => {
    const literal = new Set<string>()
    for (const { text } of sources(["app", "components", "lib"])) {
      for (const m of text.matchAll(/\bk="([a-z][\w.-]*)"|\b(?:plainText|slotText)\(\s*[\w.]+,\s*"([a-z][\w.-]*)"/g)) literal.add(m[1] ?? m[2])
    }
    expect(literal.size).toBeGreaterThan(300)
    const unread = [...literal].filter((key) => !seen.keys.has(key) && !(key in HIDDEN_SLOTS) && !(key in STARTER_ONLY_SLOTS)).sort()
    expect(unread, "never rendered: reach it in a render here, or list it in tests/support/hidden-slots.ts").toEqual([])
  })

  // A section that draws rows when there are any, and built-in examples
  // worded by slots when there are none, puts the same words in the database
  // twice: as rows, and as text rows only an empty database shows. An editor
  // edits the copy the site ignores (CLAUDE.md: content that is rows is never
  // also slots). So a slot only an empty site reads must say it is empty.
  test("a slot only an empty database reaches says that it is empty, and stands in for no rows", () => {
    const standIns = [...seen.emptyKeys].filter((key) => !seen.dataKeys.has(key) && !key.endsWith(".empty")).sort()
    expect(standIns, "draw the rows alone; a slot for an empty database is named <area>.empty").toEqual([])
    expect([...seen.emptyKeys].filter((key) => key.endsWith(".empty")).length, "the empty states were drawn").toBeGreaterThan(3)
  })

  // copy-keys.json is what `npm run notion:seed-copy` makes rows from and what
  // `npm run notion:check` holds the database to: a stale one seeds old words
  // and misses new slots
  test.skipIf(Boolean(process.env.COPY_OUT))("copy-keys.json is the list the pages read now (run `npm run copy` after changing a slot)", () => {
    const committed = JSON.parse(readFileSync(join(ROOT, "copy-keys.json"), "utf8")) as Record<string, string>
    expect(copyKeys()).toEqual(committed)
  })

  test("the check finds a word that is not a slot (checked against a sample)", () => {
    const div = document.createElement("div")
    div.innerHTML = `<p>${MARK} ¤3 <span>Typed in code</span> <time>2 November</time> <code>npm run dev</code> ${TEMPLATE_NAME}</p><img alt="A typed alt">`
    expect(leftovers(div, "sample")).toEqual(['sample (text): "Typed in code"', 'sample (alt): "A typed alt"'])
  })
})

// Words Notion formatted travel as its runs, after a mark (lib/inline-text.ts).
// Every page again, every slot and every row's words formatted: the mark and
// the runs must never reach a reader, in the page, its attributes, its
// structured data, its metadata, its share card or /llms.txt.
describe("Notion's formatting never leaks into a page", () => {
  const leaks: string[] = []
  beforeAll(async () => {
    seen.copy = Object.fromEntries([...seen.keys].map((key) => [key, styled(MARK)]))
    seen.marking = true
    seen.styling = true
    for (const route of await routes()) {
      const page = await draw(route)
      leaks.push(...leftovers(page, route.route))
      if (page.innerHTML.includes(STYLED)) leaks.push(`${route.route}: the mark in the markup`)
      for (const script of page.querySelectorAll("script")) if (/\{"t":/.test(script.innerHTML)) leaks.push(`${route.route}: runs in a script`)
      if (route.file) {
        const meta = await ((await import(/* @vite-ignore */ route.file)) as PageModule).generateMetadata?.({ params: route.params, searchParams: {} })
        if (JSON.stringify(meta ?? {}).includes(STYLED)) leaks.push(`${route.route}: the mark in the metadata`)
      }
      if (route.route.startsWith("/") && JSON.stringify(await ogWords(route.route)).includes(STYLED)) leaks.push(`${route.route}: the mark on the share card`)
    }
    const data = await getSiteData()
    for (const [name, text] of [["/llms.txt", llmsTxt(data)], ["/llms-full.txt", llmsFullTxt(data)], ["the feed's title", feedTitle(data.copy, siteName(data.copy))]]) {
      if (text.includes(STYLED) || /\{"t":/.test(text)) leaks.push(`${name}: the mark or the runs`)
    }
    seen.styling = false
  }, 240_000)

  test("no page prints the mark or the runs: formatting is drawn, or read as words", () => {
    expect(leaks).toEqual([])
  })
})

// A slot published blank hides its words (components/system/notion-text.tsx).
// Where they were all a link, a button or a heading held, the element is
// left empty, and app/globals.css hides an empty one: a blank row takes the
// control away rather than leaving one with no name. Every page again, every
// slot blank: whatever control is still shown must still have a name.
describe("a slot published blank never leaves a control without a name", () => {
  const faults: string[] = []
  const CONTROLS = "a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=region]"
  // what app/globals.css hides when it is empty
  const HIDDEN_WHEN_EMPTY = "a, button, h1, h2, h3, h4, h5, h6"
  const hidden = (el: Element) => Boolean(el.closest('[aria-hidden="true"], [hidden]')) || (el.matches(HIDDEN_WHEN_EMPTY) && el.matches(":empty"))

  beforeAll(async () => {
    seen.copy = Object.fromEntries([...seen.keys].map((key) => [key, ""]))
    seen.marking = false
    for (const route of await routes()) {
      const page = await draw(route)
      for (const el of page.querySelectorAll(CONTROLS)) {
        if (!hidden(el) && !accessibleName(el)) faults.push(`${route.route}: ${el.outerHTML.slice(0, 140)}`)
      }
      for (const el of page.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
        if (!hidden(el) && !(el.textContent ?? "").trim()) faults.push(`${route.route}: an empty heading: ${el.outerHTML.slice(0, 140)}`)
      }
    }
  }, 240_000)

  test("every control still shown is named, and no heading stands empty", () => {
    expect(faults).toEqual([])
  })

  test("the stylesheet hides an empty link, button and heading", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8")
    const rule = css.match(/([^{}]*):empty[^{]*\{[^}]*display:\s*none/)
    expect(rule, "no :empty rule in app/globals.css").not.toBeNull()
    for (const tag of HIDDEN_WHEN_EMPTY.split(", ")) expect(css).toMatch(new RegExp(`\\b${tag}:empty\\b`))
  })
})

/** Every slot a site with Notion connected reads, with the wording built
 *  into the code: what `npm run copy` writes. A slot drawn only while the
 *  starter content shows is left out, since no database could show it. */
function copyKeys(): Record<string, string> {
  const slots: Record<string, string> = { ...HIDDEN_SLOTS, ...metaSlots(), ...Object.fromEntries(seen.defaults) }
  for (const key of Object.keys(STARTER_ONLY_SLOTS)) delete slots[key]
  return Object.fromEntries(Object.keys(slots).sort().map((key) => [key, slots[key]]))
}

// `npm run copy`: every slot, with the wording built into the code, for
// `npm run notion:seed-copy` to make a Notion row of each
afterAll(() => {
  const out = process.env.COPY_OUT
  if (!out) return
  const sorted = copyKeys()
  writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`${Object.keys(sorted).length} slots → ${out}`)
})
