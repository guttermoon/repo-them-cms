// The shop's shelves and the homepage a copy of the template starts as:
// product cards as storefronts have them (picture, name, a short
// description, the price), and the homepage's shelf, plans and newest posts
// from the starter content, with no Notion connected.
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { gridLabels } from "@/components/commerce/labels"
import type { ProductView } from "@/components/commerce/product"
import { ProductGallery } from "@/components/commerce/product-gallery"
import { ProductGrid } from "@/components/commerce/product-grid"
import { blogPosts, liveProducts } from "@/lib/content/select"
import { DEMO_ROWS } from "@/lib/demo/content"
import { startFakeNotion } from "@/lib/demo/fake-notion"
import { STARTER_DATA } from "@/lib/demo/starter"
import { checkEverything } from "./support/checks"

// the code block unhighlighted, and Notion's SDK talking to a stand-in from
// a "browser" (tests/dom/support/mocks.tsx)
vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))
vi.mock("@notionhq/client", async (original) => (await import("./support/mocks")).browserNotion(original))

const product = (over: Partial<ProductView>): ProductView => ({
  id: over.slug ?? "x",
  slug: "drink",
  title: "Drink",
  description: "A can of drink. Cold, wet and generic.",
  price: 1,
  currency: "GBP",
  images: ["/demo/product-drink.webp"],
  alts: [""],
  variants: [],
  featured: false,
  created: "2026-11-01T00:00:00.000Z",
  ...over,
})

const SHELF = [
  product({ slug: "drink", title: "Drink", price: 1 }),
  product({ slug: "corn-flakes", title: "Corn flakes", description: "Toasted flakes of corn.", price: 2.5, compareAt: 3 }),
  product({ slug: "coffee", title: "Coffee", description: "Ground, medium roast.", price: 4, stock: "Sold out" }),
]

describe("a product card", () => {
  test("has the picture, the name as its one link, a short description and the price, old price struck through", () => {
    const { container } = render(<ProductGrid products={SHELF} labels={gridLabels({})} />)
    checkEverything(container, "product grid", ["/shop/drink", "/shop/corn-flakes", "/shop/coffee"])
    const card = screen.getByRole("link", { name: "Corn flakes" }).closest("li")!
    expect(within(card).getAllByRole("link")).toHaveLength(1)
    expect(within(card).getByRole("link").getAttribute("href")).toBe("/shop/corn-flakes")
    expect(card.querySelector("img")?.getAttribute("src")).toBe("/demo/product-drink.webp")
    expect(within(card).getByText("Toasted flakes of corn.").className).toMatch(/line-clamp-2/)
    expect(card.textContent).toContain("£2.50")
    expect(card.textContent).toContain("Was £3")
    expect(within(screen.getByRole("link", { name: "Coffee" }).closest("li")!).getByText("Sold out")).toBeTruthy()
  })

  test("the goods are shown as uploaded: every picture on the shelf and in a gallery is marked as goods, which the dark look leaves untinted", () => {
    const shelf = render(<ProductGrid products={SHELF} labels={gridLabels({})} />)
    const onShelf = [...shelf.container.querySelectorAll("img")]
    expect(onShelf.length).toBe(SHELF.length)
    for (const img of onShelf) expect(img.closest("[data-goods]"), img.getAttribute("src") ?? "").not.toBeNull()
    shelf.unmount()
    const gallery = render(<ProductGallery images={["/demo/product-coffee.webp", "/demo/product-drink.webp"]} title="Coffee" labels={{ picture: "Picture", of: "of" }} />)
    const inGallery = [...gallery.container.querySelectorAll("img")]
    expect(inGallery.length).toBe(3)
    for (const img of inGallery) expect(img.closest("[data-goods]")).not.toBeNull()
  })

  test("a gallery describes each picture by its own description (the shop's alt text), or the product's name", async () => {
    render(
      <ProductGallery
        images={["/demo/product-coffee.webp", "/demo/product-drink.webp", "/demo/product-food.webp"]}
        alts={["", "The back of the bag", ""]}
        title="Coffee"
        labels={{ picture: "Picture", of: "of" }}
      />,
    )
    // the large one: no description of its own, so the product's name
    expect(screen.getByRole("img", { name: "Coffee" })).toBeTruthy()
    // each button says which picture it is, and what it shows when it is described
    expect(screen.getByRole("button", { name: "Picture 2 of 3: The back of the bag" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Picture 3 of 3" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Picture 2 of 3: The back of the bag" }))
    expect(screen.getByRole("img", { name: "The back of the bag" })).toBeTruthy()
  })

  test("a card with no description leaves no empty line", () => {
    render(<ProductGrid products={[product({ description: "" })]} labels={gridLabels({})} />)
    const card = screen.getByRole("link", { name: "Drink" }).closest("li")!
    expect(card.querySelectorAll("p.line-clamp-2")).toHaveLength(0)
  })

  test("the shop sorts by price; a short shelf leaves the control out", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ProductGrid products={SHELF} labels={gridLabels({})} />)
    await user.click(screen.getByRole("button", { name: "Sort by Featured" }))
    // the sort sits at the end of its row, so its menu lines up with that end
    expect(screen.getByRole("listbox", { name: "Sort by" }).className).toContain("right-0")
    await user.click(screen.getByRole("option", { name: "Price, high to low" }))
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Coffee", "Corn flakes", "Drink"])
    unmount()
    render(<ProductGrid products={SHELF} labels={gridLabels({})} sortable={false} />)
    expect(screen.queryByRole("button", { name: /^Sort by/ })).toBeNull()
  })
})

describe("the homepage a copy starts as (no Notion connected)", () => {
  test("a shelf of product cards, the plans, and the three newest blog posts, newest first", async () => {
    const { default: HomePage } = await import("@/app/page")
    const { container } = render(<CartProvider>{await HomePage()}</CartProvider>)
    const shelf = screen.getByRole("region", { name: "plain goods, fairly priced" })
    const cards = within(shelf).getAllByRole("listitem")
    expect(cards.length).toBe(Math.min(4, liveProducts(STARTER_DATA).length))
    for (const card of cards) {
      expect(card.querySelector("img"), "a picture").not.toBeNull()
      expect(card.querySelector("p.line-clamp-2")?.textContent, "a description").toBeTruthy()
      expect(card.textContent, "a price").toMatch(/£\d/)
    }
    const newest = blogPosts(STARTER_DATA)
      .slice(0, 3)
      .map((p) => p.slug)
    const posts = screen.getByRole("region", { name: "from the blog" })
    expect([...posts.querySelectorAll('a[href^="/blog/"]')].map((a) => a.getAttribute("href")).filter((h) => h !== "/blog")).toEqual(newest.map((s) => `/blog/${s}`))
    expect(within(screen.getByRole("region", { name: "pick a plan, change it any time" })).getAllByRole("heading", { level: 3 }).length).toBeGreaterThanOrEqual(2)
    // the one band about the template, a live demo of it, points at /features, where the rest is
    expect(within(screen.getByRole("region", { name: "this is a live demo" })).getByRole("link", { name: "Deploy in five steps" }).getAttribute("href")).toBe("/features#deploy")
    expect(container.textContent).not.toMatch(/notion:setup|NOTION_TOKEN/)
  })
})

describe("the homepage's order and its two set pieces", () => {
  test("the hero opens with the site's name alone, centred: no descriptor and no rule beside it", async () => {
    const { default: HomePage } = await import("@/app/page")
    const { container } = render(<CartProvider>{await HomePage()}</CartProvider>)
    const line = container.querySelector("section[aria-labelledby='hero-title'] [data-name-line]") as HTMLElement
    expect(line.children).toHaveLength(1)
    expect(line.textContent?.toLowerCase()).toBe("repo them")
    expect(line.classList.contains("justify-center")).toBe(true)
  })

  test("the statement follows the hero, and the shelf stands straight before what people say about it, then the blog", async () => {
    const { default: HomePage } = await import("@/app/page")
    const { container } = render(<CartProvider>{await HomePage()}</CartProvider>)
    const order = [...container.querySelectorAll(":scope > section")].map((s) => s.getAttribute("aria-labelledby")).filter(Boolean)
    expect(order.slice(0, 2)).toEqual(["hero-title", "statement-title"])
    expect(order.indexOf("reviews-title") - order.indexOf("shelf-title"), `the shelf is not straight before the reviews: ${order.join(", ")}`).toBe(1)
    expect(order.indexOf("posts-title") - order.indexOf("reviews-title"), `the reviews are not straight before the blog: ${order.join(", ")}`).toBe(1)
    expect(order.indexOf("plans-title")).toBeLessThan(order.indexOf("shelf-title"))
  })

  test("the quotation stands straight under the tools the site goes well with, before the small print and the plans", async () => {
    const { default: HomePage } = await import("@/app/page")
    const { container } = render(<CartProvider>{await HomePage()}</CartProvider>)
    const blocks = [...container.children]
    const logos = blocks.findIndex((el) => /goes well with/i.test(el.textContent ?? "") && !el.querySelector("blockquote"))
    const quote = blocks.findIndex((el) => el.querySelector("figure blockquote"))
    expect(logos, "the logo strip is drawn").toBeGreaterThan(-1)
    expect(quote - logos, "the quotation is not straight under the logos").toBe(1)
    expect(quote).toBeLessThan(blocks.findIndex((el) => el.getAttribute("aria-labelledby") === "facts-title"))
    expect(quote).toBeLessThan(blocks.findIndex((el) => el.getAttribute("aria-labelledby") === "plans-title"))
  })

  test("the statement is one giant word and three promises on a belt, in the order they come down it: type alone, no picture and no goods", async () => {
    const { default: HomePage } = await import("@/app/page")
    render(<CartProvider>{await HomePage()}</CartProvider>)
    const statement = screen.getByRole("region", { name: "generic" })
    expect(within(statement).getByRole("heading", { level: 2 }).className).toContain("statement-word")
    const cards = within(statement).getAllByRole("listitem")
    expect(cards.map((card) => card.textContent)).toEqual(["On the frontthe priceOne price, VAT in it", "Repliesa personIn sentences", "Always openthe exitNo contract to read"])
    // a card's place in the queue is what its ride and its scan are worked out from
    expect(cards.map((card) => card.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"])
    // the scanner and the belt are scenery
    for (const scenery of statement.querySelectorAll(".belt-scanner, .belt-surface, .belt-barcode")) expect(scenery.getAttribute("aria-hidden")).toBe("true")
    expect(statement.textContent).toContain("We sell ordinary things at the price on the label, answer every message ourselves, and let you leave whenever you like.")
    expect(within(statement).getByRole("link", { name: /Read more/ }).getAttribute("href")).toBe("/about")
    expect(statement.querySelectorAll("img, svg")).toHaveLength(0)
  })

  test("the title's words land one by one and still read as the sentence they are", async () => {
    const { default: HomePage } = await import("@/app/page")
    render(<CartProvider>{await HomePage()}</CartProvider>)
    const title = screen.getByRole("heading", { level: 1 })
    expect(title.textContent).toBe("everything you need, nothing you don't")
    const words = [...title.querySelectorAll(".kinetic-word")]
    expect(words.map((w) => w.textContent)).toEqual(["everything", "you", "need,", "nothing", "you", "don't"])
    expect(words.map((w) => (w as HTMLElement).style.getPropertyValue("--word"))).toEqual(["0", "1", "2", "3", "4", "5"])
  })
})

test("/features: the care split's link is how it works, the way the words travel from Notion further down", async () => {
  const { default: FeaturesPage } = await import("@/app/features/page")
  const { container } = render(<CartProvider>{await FeaturesPage()}</CartProvider>)
  const care = container.querySelector('section[aria-labelledby="services-split-2"]') as HTMLElement
  const link = within(care).getByRole("link", { name: /see how it works/i })
  expect(link.getAttribute("href")).toBe("#travel")
  const target = container.querySelector('[id="travel"]') as HTMLElement
  expect(target, "the anchor is on the page").not.toBeNull()
  expect(target.getAttribute("aria-labelledby")).toBe("travel-title")
  expect(within(target).getByRole("heading", { level: 2 }).textContent).toBe("all your content, in one place")
})

test("/features: under the shelf's four packs, a column for each in the shelf's order, with the way to it", async () => {
  const { default: FeaturesPage } = await import("@/app/features/page")
  const { container } = render(<CartProvider>{await FeaturesPage()}</CartProvider>)
  const hero = container.querySelector('section[aria-labelledby="hero-title"]') as HTMLElement
  expect(within(hero).getByRole("img").getAttribute("aria-label")).toMatch(/website.*blog.*pages.*copy/)
  const columns = [...hero.querySelectorAll("ul > li")]
  expect(columns.map((li) => [li.querySelector("h2")?.textContent, li.querySelector("a")?.getAttribute("href")])).toEqual([
    ["website", "#deploy"],
    ["blog", "/blog"],
    ["pages", "#rows"],
    ["copy", "/resources/ingredients"],
  ])
  // pressing a pack jumps to its column: a link for the pointer alone, out of a screen reader's way
  const packs = [...hero.querySelectorAll(".shelf-picture > a.pack-hit")]
  expect(packs.map((a) => [a.getAttribute("data-for"), a.getAttribute("href"), a.getAttribute("aria-hidden"), a.getAttribute("tabindex")])).toEqual([
    ["box", "#shelf-website", "true", "-1"],
    ["can", "#shelf-blog", "true", "-1"],
    ["carton", "#shelf-pages", "true", "-1"],
    ["bag", "#shelf-copy", "true", "-1"],
  ])
  // each lies over its own pack, and the picture itself holds no link
  for (const a of packs) expect(hero.querySelector(`svg [data-pack="${a.getAttribute("data-for")}"]`), a.getAttribute("data-for") ?? "").not.toBeNull()
  expect(hero.querySelectorAll("svg a")).toHaveLength(0)
  expect(columns.map((li) => li.id)).toEqual(["shelf-website", "shelf-blog", "shelf-pages", "shelf-copy"])
  for (const href of ["#deploy", "#rows"]) expect(container.querySelector(`[id="${href.slice(1)}"]`), href).not.toBeNull()
  // the full list is a page of its own now: here, its groups as chips that go to each, and the way in
  const list = container.querySelector('[id="ingredients"]')?.parentElement as HTMLElement
  const chips = [...list.querySelectorAll('nav a')].map((a) => a.getAttribute("href"))
  expect(chips.length).toBeGreaterThanOrEqual(8)
  for (const href of chips) expect(href).toMatch(/^\/resources\/ingredients#[\w-]+$/)
  expect(within(list).getByRole("link", { name: "Read the full list" }).getAttribute("href")).toBe("/resources/ingredients")
  expect(list.querySelectorAll("details")).toHaveLength(0)
})

test("/resources/ingredients holds the full list, its chips go to its own groups, and the resources list it", async () => {
  const { default: IngredientsPage } = await import("@/app/resources/ingredients/page")
  const { container, unmount } = render(<CartProvider>{await IngredientsPage()}</CartProvider>)
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("the full list of ingredients")
  const chips = [...container.querySelectorAll("nav a")].map((a) => a.getAttribute("href") ?? "")
  expect(chips.length).toBeGreaterThanOrEqual(8)
  for (const href of chips) {
    expect(href).toMatch(/^#[\w-]+$/)
    expect(container.querySelector(`h2[id="${href.slice(1)}"]`), href).not.toBeNull()
  }
  expect(container.querySelectorAll("details").length).toBeGreaterThan(20)
  expect(screen.getByRole("heading", { level: 2, name: "Not included" })).toBeTruthy()
  unmount()
  const { default: ResourcesPage } = await import("@/app/resources/page")
  render(<CartProvider>{await ResourcesPage()}</CartProvider>)
  expect(document.querySelector('a[href="/resources/ingredients"]'), "the starter's resources list it").not.toBeNull()
})

test("the homepage shows the blog's three newest posts: not every post, and never a release", async () => {
  // two posts older than the starter's two, and its release (version-1),
  // which is the changelog's, newer than both
  const older = { kind: "Post" as const, title: "An older post", slug: "older", published: true, date: "2026-01-02", category: "News", description: "From the archive." }
  const oldest = { ...older, title: "The oldest post", slug: "oldest", date: "2026-01-01" }
  expect(DEMO_ROWS.some((row) => row.slug === "version-1" && row.category === "Releases"), "the starter has a release").toBe(true)
  const fake = await startFakeNotion({ rows: [...DEMO_ROWS, older, oldest] })
  const saved = { ...process.env }
  Object.assign(process.env, { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: fake.databaseId, NOTION_API_BASE_URL: fake.url })
  try {
    vi.resetModules()
    const { default: HomePage } = await import("@/app/page")
    render(<CartProvider>{await HomePage()}</CartProvider>)
    const posts = screen.getByRole("region", { name: "from the blog" })
    const links = [...posts.querySelectorAll('a[href^="/blog/"]')].map((a) => a.getAttribute("href")).filter((h) => h !== "/blog")
    expect(links).toEqual(["/blog/introducing-generic", "/blog/five-questions", "/blog/older"])
  } finally {
    process.env = saved
    await fake.close()
  }
})
