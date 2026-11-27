// Every page on the site, rendered in jsdom as a reader gets it, three times:
//
// - with no Notion at all: the starter content from the site's own files
//   (lib/demo/starter.ts), the site a fresh fork deploys before it is
//   connected, every slot in its built-in wording;
// - with the starter content (lib/demo/content.ts), read through the real
//   store and the real Notion client from a stand-in Notion over HTTP
//   (lib/demo/fake-notion.ts), which adds every page whose address comes
//   from a row: Notion pages, posts, categories, tags, products, collections;
// - with a connected database that holds its wording and no rows of content
//   yet: every empty state (a database with no wording either is below).
//
// Each is held to the rules in tests/dom/support/checks.ts: one <h1>, unique
// ids, headings in order, a description on every picture, no placeholder
// text, every internal link going somewhere that exists, new tabs opened
// safely, every control named; and every indexed page describes itself in
// structured data under its own address.
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"

import { join } from "node:path"

import { CartProvider } from "@/components/commerce/cart-context"
import { urlFor } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { startFakeNotion } from "@/lib/demo/fake-notion"
import { INDEXED_PAGES, MAIN_NAV } from "@/lib/nav"
import type { IndexedPath } from "@/lib/page-meta"
import { pageUrl } from "@/lib/structured-data"

import { checkEverything, checkPageShape, dynamicPageRoutes, fillRoute, FULL_STOP, pageRoutes, ROOT } from "./support/checks"

// the code block unhighlighted, and Notion's SDK talking to a stand-in from
// a "browser" (tests/dom/support/mocks.tsx)
vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))
vi.mock("@notionhq/client", async (original) => (await import("./support/mocks")).browserNotion(original))

// every read of Notion must succeed: a failure falls back to an empty
// answer, which would pass every check while testing nothing
const notionErrors: string[] = []
const consoleError = console.error
console.error = (...args: unknown[]) => {
  if (String(args[0]).startsWith("[notion]")) notionErrors.push(args.map(String).join(" ").slice(0, 300))
  consoleError(...args)
}

type PageModule = {
  default: (props: Record<string, unknown>) => Promise<ReactElement> | ReactElement
  metadata?: { title?: unknown; alternates?: { canonical?: string }; robots?: { index?: boolean } }
  generateMetadata?: (props: Record<string, unknown>) => Promise<PageModule["metadata"]>
  generateStaticParams?: () => Promise<Record<string, string | string[]>[]>
}

const INDEXED = new Set<string>(INDEXED_PAGES.map((page) => page.href))
/** schema.org's kinds of WebPage that pages here use */
const WEB_PAGES = ["WebPage", "CollectionPage", "ContactPage", "AboutPage", "FAQPage", "ItemPage", "CheckoutPage"]

const fake = await startFakeNotion()
const NOTION_ENV = { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: fake.databaseId, NOTION_API_BASE_URL: fake.url }
const emptyNotion = await startFakeNotion({ rows: [] })
const EMPTY_ENV = { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: emptyNotion.databaseId, NOTION_API_BASE_URL: emptyNotion.url }
const NO_NOTION = { NOTION_TOKEN: "", NOTION_DATABASE_ID: "", NOTION_API_BASE_URL: "" }

/** Runs with the environment set as given, then puts it back. */
async function withEnv<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
  Object.assign(process.env, env)
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

const STATIC = pageRoutes().map(({ route, file }) => ({ route, file, params: {} as Record<string, string | string[]> }))

// the addresses Next would build from the starter content
const { DYNAMIC, NOTION_PATHS } = await withEnv(NOTION_ENV, async () => {
  const routes: typeof STATIC = []
  for (const { template, file } of dynamicPageRoutes()) {
    const mod = (await import(/* @vite-ignore */ file)) as PageModule
    for (const params of (await mod.generateStaticParams?.()) ?? []) routes.push({ route: fillRoute(template, params), file, params })
  }
  const data = await getSiteData()
  return { DYNAMIC: routes, NOTION_PATHS: data.entries.flatMap((e) => urlFor(e) ?? []) }
})

afterAll(async () => {
  await fake.close()
  await emptyNotion.close()
})

async function renderPage(file: string, params: Record<string, unknown>): Promise<{ page: Element; mod: PageModule }> {
  const mod = (await import(/* @vite-ignore */ file)) as PageModule
  const element = await mod.default({ params, searchParams: {} })
  const { container } = render(<CartProvider>{element}</CartProvider>)
  // a copy: Testing Library empties the live container after each test, and
  // the checks read markup and attributes, which a copy keeps
  return { page: container.cloneNode(true) as Element, mod }
}

/** Every node of every JSON-LD block on the page, graphs flattened. */
function structuredData(page: Element): Record<string, unknown>[] {
  return [...page.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    const data = JSON.parse(script.textContent ?? "")
    return data["@graph"] ?? [data]
  })
}

function suite(label: string, env: Record<string, string>, routes: typeof STATIC, extraPaths: string[]) {
  describe(label, () => {
    const rendered = new Map<string, Element>()

    describe.each(routes)("$route", ({ route, file, params }) => {
      let page: Element
      let mod: PageModule
      beforeAll(async () => {
        ;({ page, mod } = await withEnv(env, () => renderPage(file, params)))
        rendered.set(route, page)
      })

      test("renders, with one <h1> and unique ids", () => {
        checkPageShape(page)
        // a cart or a thank-you page is short by nature; a page meant to be found is not
        if (INDEXED.has(route)) expect((page.textContent ?? "").length, "the page rendered next to nothing").toBeGreaterThan(150)
      })

      test("holds to the site-wide rules", () => checkEverything(page, route, extraPaths))

      test("has a title, and its canonical address is its own unless it is kept out of search", async () => {
        const meta = mod.metadata ?? (await withEnv(env, async () => (await mod.generateMetadata?.({ params, searchParams: {} })) ?? undefined))
        expect(meta?.title, "no title").toBeTruthy()
        expect(String(meta?.title), "a page's title takes no full stop").not.toMatch(FULL_STOP)
        if (meta?.robots?.index !== false) expect(meta?.alternates?.canonical).toBe(route)
      })

      test.runIf(INDEXED.has(route))("describes itself in structured data, under its own address", () => {
        const pages = structuredData(page).filter((node) => [node["@type"]].flat().some((type) => WEB_PAGES.includes(type as string)))
        expect(pages, "no WebPage node, or more than one").toHaveLength(1)
        expect(pages[0].url).toBe(pageUrl(route as IndexedPath))
      })
    })

    test("every link to an anchor lands on an element with that id", () => {
      const misses: string[] = []
      for (const [route, page] of rendered) {
        for (const a of page.querySelectorAll('a[href*="#"]')) {
          const href = a.getAttribute("href")!
          if (!href.startsWith("/") && !href.startsWith("#")) continue
          const [path, id] = href.split("#")
          const target = path ? rendered.get(path.split("?")[0]) : page
          if (!id || !target) continue
          if (![...target.querySelectorAll("[id]")].some((el) => el.id === decodeURIComponent(id))) misses.push(`${route}: ${href}`)
        }
      }
      expect(misses).toEqual([])
    })
  })
}

test("there are pages to check, and the starter content adds pages of every kind", () => {
  expect(notionErrors, "Notion could not be read").toEqual([])
  expect(NOTION_PATHS.length, "the starter content did not load").toBeGreaterThan(10)
  expect(STATIC.length).toBeGreaterThanOrEqual(15)
  for (const prefix of ["/blog/", "/blog/category/", "/blog/tag/", "/shop/", "/shop/collection/"]) {
    expect(DYNAMIC.some((r) => r.route.startsWith(prefix)), prefix).toBe(true)
  }
  expect(DYNAMIC.some((r) => !/^\/(blog|shop)\//.test(r.route)), "a page written in Notion").toBe(true)
})

// the starter content without Notion is the same rows, so the same pages exist
suite("with no Notion: the starter content, from the site's own files", NO_NOTION, STATIC, NOTION_PATHS)
suite("with the starter content from Notion", NOTION_ENV, [...STATIC, ...DYNAMIC], NOTION_PATHS)
suite("with a database that holds nothing yet: every empty state", EMPTY_ENV, STATIC, [])

test("Notion answered every read the pages made", () => {
  expect(notionErrors).toEqual([])
})

// The 404 (app/not-found.tsx) is not a page.tsx, so the routes above do not
// find it; it is held to the same rules, kept out of every index, and has to
// offer a way on to the homepage and every page in the header.
describe("the 404", () => {
  let page: Element
  beforeAll(async () => {
    ;({ page } = await withEnv(NO_NOTION, () => renderPage(join(ROOT, "app", "not-found.tsx"), {})))
  })

  test("the site-wide rules hold", () => {
    checkPageShape(page)
    checkEverything(page, "/404")
  })

  test("leads back to the homepage and to every page in the header", () => {
    const hrefs = [...page.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    for (const href of ["/", ...MAIN_NAV.map((item) => item.href)]) expect(hrefs).toContain(href)
  })

  test("is never indexed, and has a title of its own", async () => {
    const { generateMetadata } = await import("@/app/not-found")
    const metadata = await withEnv(NO_NOTION, () => generateMetadata())
    expect(metadata.robots).toMatchObject({ index: false })
    expect(metadata.title).toMatch(/^Nothing \| /)
  })
})

// A connected database that holds no wording at all: the site shows only
// words that are in Notion (FROM_NOTION in lib/slots.ts), never the ones
// written into the code, yet every control keeps the name that says what it
// does (plainText).
describe("with a connected database that holds no wording", () => {
  // the code's words a page would show, the words in its pictures and its
  // figures among them (slotText), and none of which may reach the page
  const CODE_WORDS: [string, string[]][] = [
    ["page.tsx", ["the small print, in large print", "standard offer available", "get the generic, call it whatever you like", "Nutrition facts", "everything you need, nothing you"]],
    ["features/page.tsx", ["Plan row, Price", "comparison table", "third-party requests from a reader", "new post", "reader@example.com", "Brevo · Resend", "corn flakes", "your-site.example", "old-site.example", "Your lettering", "fixed quote, in writing"]],
    ["about/page.tsx", ["KEEP IN A COOL DRY OFFICE", "NET WT 1 COMPANY"]],
  ]
  test.each(CODE_WORDS)("%s shows none of the code's words, and every control keeps its name", async (file, words) => {
    const bare = await startFakeNotion({ rows: [], words: false })
    try {
      const env = { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: bare.databaseId, NOTION_API_BASE_URL: bare.url }
      const { page } = await withEnv(env, () => renderPage(join(ROOT, "app", file), {}))
      const text = page.textContent ?? ""
      for (const word of words) expect(text, word).not.toContain(word)
      for (const control of page.querySelectorAll("nav[aria-label], [role=region][aria-label]")) {
        expect(control.getAttribute("aria-label")?.trim(), control.outerHTML.slice(0, 120)).not.toBe("")
      }
    } finally {
      await bare.close()
    }
  })
})

// an address a category or a tag no live post is filed under is the 404,
// for the page and its metadata alike, and a tag's address is not a category's
describe.each([
  ["blog/category/[category]", "category", "guides", "tutorial"],
  ["blog/tag/[tag]", "tag", "news", "guides"],
])("/%s", (route, param, real, other) => {
  test("is the 404 where nothing is filed, and a page where something is", async () => {
    const mod = (await import(/* @vite-ignore */ join(ROOT, "app", route, "page.tsx"))) as PageModule
    for (const slug of ["nothing-filed-here", other]) {
      const props = { params: Promise.resolve({ [param]: slug }), searchParams: {} }
      await expect(withEnv(NOTION_ENV, async () => mod.default(props))).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
      await expect(withEnv(NOTION_ENV, async () => mod.generateMetadata!(props))).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
    }
    const props = { params: Promise.resolve({ [param]: real }), searchParams: {} }
    expect(await withEnv(NOTION_ENV, async () => mod.default(props))).toBeTruthy()
  })
})
