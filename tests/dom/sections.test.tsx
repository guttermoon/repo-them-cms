// The marketing sections (components/sections/marketing), each rendered and
// held to its promises: real headings, native controls or the ARIA pattern
// they claim, keyboard behaviour, nothing moving on its own for long, and
// the site-wide rules in support/checks.ts.
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { Pipeline } from "@/components/illustrations/pipeline"
import { STILL_LIFE_WORDS, StillLife } from "@/components/illustrations/still-life"
import {
  Bento,
  ComparisonTable,
  Faq,
  FeatureColumns,
  FeatureTabs,
  FinalCta,
  HeroCentered,
  HeroSplit,
  LogoStrip,
  PricingPlans,
  Quote,
  ReviewCards,
  SplitFeature,
  StatCards,
  TrustFacts,
  type PlanView,
} from "@/components/sections/marketing"
import { ButtonLink } from "@/components/ui/button"
import { comparison, featureLines } from "@/lib/pricing"

import { motion } from "../support/setup-dom"
import { checkEverything } from "./support/checks"

afterEach(() => {
  vi.useRealTimers()
})

const LABELS = {
  billing: "Billing",
  monthly: "Pay monthly",
  yearly: "Pay yearly",
  saveBefore: "Save up to",
  saveAfter: "with yearly",
  recommended: "recommended",
  custom: "custom pricing",
  includes: "includes",
}

const plan = (over: Partial<PlanView>): PlanView => ({
  key: over.name ?? "plan",
  name: "Plan",
  currency: "GBP",
  features: [],
  recommended: false,
  ...over,
})

describe("the feature tabs", () => {
  const tabs = ["setup", "design", "moving in", "care"].map((name) => ({ key: name, title: name, text: `about ${name}`, panel: <p>{`panel for ${name}`}</p> }))

  test("are a labelled tablist; the first is chosen and only it is in the tab order", () => {
    render(<FeatureTabs label="What we do" tabs={tabs} />)
    const list = screen.getByRole("tablist", { name: "What we do" })
    const all = within(list).getAllByRole("tab")
    expect(all).toHaveLength(4)
    expect(all.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"])
    expect(all.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"])
    const panel = screen.getByRole("tabpanel")
    expect(panel.textContent).toBe("panel for setup")
    expect(panel.getAttribute("aria-labelledby")).toBe(all[0].id)
    expect(all[0].getAttribute("aria-controls")).toBe(panel.id)
  })

  test("the arrow keys move along and wrap, Home and End jump, and focus follows", () => {
    render(<FeatureTabs label="What we do" tabs={tabs} />)
    const all = screen.getAllByRole("tab")
    all[0].focus()
    fireEvent.keyDown(all[0], { key: "ArrowRight" })
    expect(document.activeElement).toBe(all[1])
    expect(all[1].getAttribute("aria-selected")).toBe("true")
    expect(screen.getByRole("tabpanel").textContent).toBe("panel for design")
    fireEvent.keyDown(all[1], { key: "End" })
    expect(document.activeElement).toBe(all[3])
    fireEvent.keyDown(all[3], { key: "ArrowRight" })
    expect(document.activeElement, "wraps to the first").toBe(all[0])
    fireEvent.keyDown(all[0], { key: "ArrowLeft" })
    expect(document.activeElement, "wraps to the last").toBe(all[3])
    fireEvent.keyDown(all[3], { key: "Home" })
    expect(document.activeElement).toBe(all[0])
    fireEvent.click(all[2])
    expect(screen.getByRole("tabpanel").textContent).toBe("panel for moving in")
  })
})

describe("the plans", () => {
  test("with no yearly prices there is no switch, and a plan without a price says the page's words for it", () => {
    render(
      <PricingPlans
        plans={[
          plan({ name: "Template", price: 0, cta: { href: "/pricing", label: "Get it" }, features: featureLines("MIT licence\nPages: Unlimited") }),
          plan({ name: "Done for you", recommended: true, cta: { href: "/contact?type=build", label: "Ask for a quote" } }),
        ]}
        labels={LABELS}
      />,
    )
    expect(screen.queryByRole("radio")).toBeNull()
    expect(screen.getByRole("heading", { level: 3, name: "Template" })).toBeTruthy()
    expect(screen.getByText("£0")).toBeTruthy()
    expect(screen.getByText("custom pricing")).toBeTruthy()
    expect(screen.getByText("recommended")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Ask for a quote" }).getAttribute("href")).toBe("/contact?type=build")
    expect(screen.getByText("MIT licence")).toBeTruthy()
    expect(screen.getByText(": Unlimited")).toBeTruthy()
  })

  test("with yearly prices, two radios switch the prices, and the saving is worked out", () => {
    render(<PricingPlans plans={[plan({ name: "Plus", price: 10, yearlyPrice: 8 }), plan({ name: "Pro", price: 20, yearlyPrice: 17 })]} labels={LABELS} />)
    const group = screen.getByRole("group", { name: "Billing" })
    const [monthly, yearly] = within(group).getAllByRole("radio") as HTMLInputElement[]
    expect(monthly.checked).toBe(true)
    expect(screen.getByText("£10")).toBeTruthy()
    expect(group.textContent).toContain("Save up to 20% with yearly")
    fireEvent.click(yearly)
    expect(yearly.checked).toBe(true)
    expect(screen.getByText("£8")).toBeTruthy()
    expect(screen.getByText("£17")).toBeTruthy()
    expect(screen.queryByText("£10")).toBeNull()
  })

  test("grouped plans sit under their group's heading, a level down", () => {
    render(<PricingPlans plans={[plan({ name: "Free", group: "Basics" }), plan({ name: "Team", group: "For business" })]} labels={LABELS} />)
    expect(screen.getByRole("heading", { level: 3, name: "Basics" })).toBeTruthy()
    expect(screen.getByRole("heading", { level: 4, name: "Free" })).toBeTruthy()
  })
})

describe("the comparison table", () => {
  test("is a real table: a caption, column and row headers, and words for the ticks", () => {
    const free = { features: featureLines("Content:\nPages: 10\nBlog") }
    const pro = { features: featureLines("Content:\nPages: Unlimited\nBlog\nCustom domain") }
    render(
      <div>
        <h2 id="compare">Plans and features</h2>
        <ComparisonTable
          label="Comparison table"
          caption="Plans compared, feature by feature"
          plans={[
            { key: "free", name: "Free", price: "£0" },
            { key: "pro", name: "Pro", price: "£8", cta: { href: "/contact", label: "Get Pro" } },
          ]}
          groups={comparison([free, pro])}
          labels={{ yes: "Included", no: "Not included", feature: "Feature" }}
        />
      </div>,
    )
    const region = screen.getByRole("region", { name: "Comparison table" })
    expect(region.getAttribute("tabindex"), "the keyboard can scroll it").toBe("0")
    const table = within(region).getByRole("table", { name: "Plans compared, feature by feature" })
    const head = table.querySelector("thead") as HTMLElement
    expect(within(head).getAllByRole("columnheader").map((th) => th.textContent?.replace(/Get Pro$/, ""))).toEqual(["Feature", "Free£0", "Pro£8"])
    const row = within(table).getByRole("row", { name: /Custom domain/ })
    expect(within(row).getByRole("rowheader").textContent).toBe("Custom domain")
    expect(row.textContent).toContain("Not included")
    expect(row.textContent).toContain("Included")
    expect(within(table).getByRole("columnheader", { name: "Content" }).getAttribute("scope")).toBe("colgroup")
  })

  test("with nothing to compare, nothing is drawn", () => {
    const { container } = render(<ComparisonTable label="x" caption="c" plans={[]} groups={[]} labels={{ yes: "y", no: "n", feature: "f" }} />)
    expect(container.innerHTML).toBe("")
  })
})

describe("the questions", () => {
  test("each is a native disclosure with the question as a heading", () => {
    render(<Faq items={[{ key: "a", question: "What does it cost?", answer: "Nothing." }]} />)
    const heading = screen.getByRole("heading", { level: 3, name: "What does it cost?" })
    const details = heading.closest("details") as HTMLDetailsElement
    expect(details).toBeTruthy()
    expect(heading.closest("summary")).toBeTruthy()
    expect(details.open).toBe(false)
    fireEvent.click(heading.closest("summary")!)
    expect(details.open).toBe(true)
  })
})

describe("the centred hero", () => {
  test("can open with the product's name and descriptor: the name in the slab face and larger, above the eyebrow and the one h1", () => {
    render(<HeroCentered name={{ name: "repo them", descriptor: "A Notion-powered CMS" }} eyebrow="generic, on purpose" title="everything you need" />)
    const line = document.querySelector("[data-name-line]") as HTMLElement
    const [name, rule, descriptor] = [...line.children] as HTMLElement[]
    expect(name.textContent).toBe("repo them")
    expect(name.classList.contains("title-slab")).toBe(true)
    expect(rule.getAttribute("aria-hidden")).toBe("true")
    expect(descriptor.textContent).toBe("A Notion-powered CMS")
    // its step on the type scale (tailwind.config.ts), smallest first
    const STEPS = ["micro", "fine", "small", "ui", "body", "lead", "head-s", "head-m", "head-l", "display"]
    const px = (el: HTMLElement) => STEPS.indexOf(el.className.match(/(?:^| )text-(micro|fine|small|ui|body|lead|head-[sml]|display)(?= |$)/)?.[1] ?? "")
    expect(px(name)).toBeGreaterThan(px(descriptor))
    // first in the hero, and a line of text, not a heading: the title stays the one h1
    const hero = line.closest("section") as HTMLElement
    expect(line.parentElement?.firstElementChild).toBe(line)
    expect(line.tagName).toBe("P")
    expect(hero.querySelectorAll("h1")).toHaveLength(1)
  })

  test("without a name, it starts at the eyebrow as before", () => {
    render(<HeroCentered eyebrow="generic, on purpose" title="everything you need" />)
    expect(document.querySelector("[data-name-line]")).toBeNull()
  })
})

describe("a section reads one way", () => {
  test("figures on a panel are a centred band with no box: a card the colour of its ground leaves only its padding", () => {
    const items = [{ key: "a", value: "1", label: "fixed quote" }]
    const { container, unmount } = render(<StatCards items={items} band />)
    const list = container.querySelector("ul") as HTMLElement
    expect(list.classList.contains("text-center")).toBe(true)
    const item = list.querySelector("li") as HTMLElement
    expect(item.className).not.toMatch(/\bbg-|\bp-\d/)
    unmount()
    // as cards, on a page ground, they keep their box
    const cards = render(<StatCards items={items} />).container.querySelector("li") as HTMLElement
    expect(cards.className).toMatch(/\bbg-panel\b/)
    expect(cards.className).toMatch(/\bp-6\b/)
  })

  test("short columns can sit centred, under a centred heading", () => {
    const { container } = render(<FeatureColumns align="center" items={[{ key: "a", title: "plain", text: "Words." }]} />)
    expect(container.querySelector("ul")?.classList.contains("text-center")).toBe(true)
    const left = render(<FeatureColumns items={[{ key: "a", title: "plain", text: "Words." }]} />).container.querySelectorAll("ul")[0]
    expect(left?.classList.contains("text-center")).toBe(false)
  })

  test("every centred heading over columns or figures has them centred too, and figures on a panel are a band", async () => {
    const { readFileSync } = await import("node:fs")
    const read = (f: string) => readFileSync(f, "utf8")
    for (const file of ["app/page.tsx", "app/about/page.tsx", "components/sections/template/services.tsx", "components/sections/template/how-it-works.tsx"]) {
      const source = read(file)
      for (const use of source.match(/<FeatureColumns[^>]*?(?=items=)/g) ?? []) expect(use, `${file}: FeatureColumns under a centred heading`).toContain('align="center"')
      for (const use of source.match(/<StatCards\s+(?:band\s+)?/g) ?? []) expect(use, `${file}: StatCards on a panel`).toContain("band")
    }
  })
})

describe("the rest", () => {
  test("a page made of every section keeps every rule", () => {
    const { container } = render(
      <main>
        <HeroCentered title="a website you write in notion" lede="One database." actions={<ButtonLink href="/pricing">get it</ButtonLink>} visual={<StillLife label="Generic packs on a shelf" words={STILL_LIFE_WORDS} brand="Repo Them" />} />
        <LogoStrip label="Works with" items={[{ key: "notion", name: "Notion" }, { key: "next", name: "Next.js" }]} />
        <StatCards items={[{ key: "a", value: "0", label: "third-party requests" }]} />
        <section aria-labelledby="f">
          <h2 id="f">features</h2>
          <FeatureColumns items={[{ key: "a", title: "words", text: "Every word a row." }]} />
          <Bento items={[{ key: "b", title: "blog", text: "Posts.", href: "/blog", more: "see the blog" }]} />
          <SplitFeature id="split" title="your blog" text="Written in Notion." more={{ href: "/blog", label: "learn more" }} media={<div />} />
          <TrustFacts items={[{ key: "t", title: "no trackers", text: "None." }]} />
        </section>
        <Quote quote="Have nothing in your houses that you do not know to be useful, or believe to be beautiful." name="William Morris" role="The Beauty of Life, 1880" />
        <Pipeline
          label="How the words travel"
          source={{ title: "notion", text: "the database" }}
          middle={{ title: "the cache", text: "once a minute" }}
          outputs={[{ key: "pages", label: "pages" }]}
        />
        <FinalCta title="get a website" actions={<ButtonLink href="/pricing">get it</ButtonLink>} />
      </main>,
    )
    checkEverything(container, "sections")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("a website you write in notion")
    expect(screen.getByRole("img", { name: "Generic packs on a shelf" })).toBeTruthy()
    expect(screen.getByRole("list", { name: "How the words travel" }).querySelectorAll(':scope > li:not([aria-hidden="true"])')).toHaveLength(3)
    expect(screen.getByText("Notion").className, "a name without a logo is set as a word").toContain("title-slab")
    expect(screen.getByRole("link", { name: /learn more/ }).getAttribute("href")).toBe("/blog")
  })

  test("the split hero has the page's one h1", () => {
    render(<HeroSplit title="websites, made" lede="By hand." art={<div />} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  test("a logo strip with nothing in it draws nothing", () => {
    const { container } = render(<LogoStrip label="Trusted by" items={[]} />)
    expect(container.innerHTML).toBe("")
  })
})

describe("reviews", () => {
  const reviews = [
    { key: "a", name: "Sam Plain", text: "They were corn flakes.", rating: 5, date: "2026-11-21", when: "21 November 2026" },
    { key: "b", name: "Alex Shelf", text: "The coffee is coffee.", rating: 4, date: "2026-11-12", when: "12 November 2026", href: "https://reviews.example/alex" },
  ]
  const words = { average: "average rating", count: "reviews", rated: (n: number) => `${n} out of 5 stars`, verdict: (n: number) => ["", "Bad", "Poor", "Average", "Great", "Excellent"][n], example: "example reviews", source: "Read where it was left" }

  test("the average and the count are worked out, each card's stars are named, and nothing is marked up for search", () => {
    const { container } = render(
      <section aria-labelledby="r">
        <ReviewCards titleId="r" title="what people say" reviews={reviews} words={words} />
      </section>,
    )
    checkEverything(container, "reviews")
    expect(screen.getByRole("heading", { level: 2, name: "what people say" })).toBeTruthy()
    expect(container.textContent).toContain("4.5 average rating")
    expect(container.textContent).toContain("2 reviews")
    // 4.5 rounds to five: the verdict in a word, and five tiles filled
    expect(screen.getByText("Excellent")).toBeTruthy()
    const [summary, first, second] = [...container.querySelectorAll("[data-star]")].reduce<string[][]>((rows, tile, i) => ((rows[Math.floor(i / 5)] ??= []).push(tile.getAttribute("data-star")!), rows), [])
    expect(summary).toEqual(["on", "on", "on", "on", "on"])
    expect(first).toEqual(["on", "on", "on", "on", "on"])
    expect(second).toEqual(["on", "on", "on", "on", "off"])
    expect(screen.getByRole("img", { name: "5 out of 5 stars" })).toBeTruthy()
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Read where it was left" }).getAttribute("href")).toBe("https://reviews.example/alex")
    expect(container.querySelector('script[type="application/ld+json"], [itemtype*="Review"]')).toBeNull()
    expect(screen.queryByText("example reviews")).toBeNull()
  })

  test("three or more pass by on a loop with a Pause box, and the second run is scenery; two stand still", () => {
    const three = [...reviews, { key: "c", name: "Jo Till", text: "Fine.", rating: 5 }]
    const { container, unmount } = render(<ReviewCards titleId="r3" title="what people say" reviews={three} words={{ ...words, pause: "Pause the reviews" }} />)
    expect(container.querySelector(".marquee")?.hasAttribute("data-loop")).toBe(true)
    expect(screen.getByRole("checkbox", { name: "Pause the reviews" })).toBeTruthy()
    const cards = [...container.querySelectorAll(".marquee-track > li")]
    // the three, and two more runs of them
    expect(cards).toHaveLength(9)
    const clones = cards.slice(3)
    for (const clone of clones) {
      expect(clone.getAttribute("aria-hidden")).toBe("true")
      expect(clone.hasAttribute("inert")).toBe(true)
      expect(clone.className).toContain("marquee-clone")
    }
    // a screen reader meets each review once
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    unmount()
    const two = render(<ReviewCards titleId="r2b" title="what people say" reviews={reviews} words={{ ...words, pause: "Pause the reviews" }} />)
    expect(two.container.querySelector(".marquee")?.hasAttribute("data-loop")).toBe(false)
    expect(two.container.querySelectorAll(".marquee-track > li")).toHaveLength(2)
    expect(screen.queryByRole("checkbox")).toBeNull()
  })

  test("invented reviews say they are examples; with none, there is no section", () => {
    render(<ReviewCards titleId="r" title="what people say" reviews={reviews} words={words} example />)
    expect(screen.getByText("example reviews")).toBeTruthy()
    const { container } = render(<ReviewCards titleId="r2" title="none" reviews={[]} words={words} />)
    expect(container.innerHTML).toBe("")
  })
})

describe("the logo strip", () => {
  test("a tool's mark is drawn in the colour of the words, beside its name, and a picture keeps its name as its alt", () => {
    render(<LogoStrip label="goes well with" items={[{ key: "v", name: "Vercel", mark: "M12 2 24 22H0z" }, { key: "x", name: "Example", src: "/demo/x.png" }]} />)
    const vercel = screen.getByText("Vercel")
    const svg = vercel.parentElement?.querySelector("svg")
    expect(svg?.getAttribute("fill")).toBe("currentColor")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(screen.getByRole("img", { name: "Example" })).toBeTruthy()
  })
})

