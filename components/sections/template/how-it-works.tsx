import type React from "react"

import { Pipeline } from "@/components/illustrations/pipeline"
import { plainText, slotHidden, slotText, type SiteCopy, type T } from "@/components/system/notion-text"
import { KINDS, PROPS, type Kind } from "@/lib/notion/schema"

import { FeatureColumns, LogoStrip, MarketingSection, NutritionFacts, SectionHead } from "../marketing"

/**
 * How the template works, in four sections for /features, the one page that
 * describes the template itself (every other page is the generic site a
 * copy of the template starts as). Every word is a slot under `features.*`.
 */

type Props = { T: T; content: SiteCopy }

/** The figures on the side of the tin. Every one is true of the code as it ships. */
const FACTS: { key: string; name: string; value: string }[] = [
  { key: "requests", name: "Notion requests per page served", value: "0" },
  { key: "thirdparty", name: "Third-party requests from your browser", value: "0" },
  { key: "trackers", name: "Trackers before you say yes", value: "0" },
  { key: "google", name: "Fonts fetched from Google by readers", value: "0" },
  { key: "publish", name: "Time from Notion to the site", value: "~1 min" },
  { key: "cost", name: "Cost to run on free plans", value: "0" },
]

/** What each Kind makes, one row each: a Record, so a new Kind does not
 *  type-check until it has its line (`features.kinds.<key>` in Site Copy). */
const KIND_ROWS: Record<Kind, { key: string; text: string }> = {
  "Site Copy": { key: "copy", text: "One piece of the site’s wording, such as a heading or a button: Title says which (home.hero.title), Text is what it says. A few hold a picture in Image instead, the site’s own logo (site.logo) and icon (site.icon) among them." },
  Page: { key: "page", text: "A page at /its-slug, written in the row’s own page body. Layout Landing makes it a landing page of sections." },
  Post: { key: "post", text: "A blog post at /blog/its-slug, with its date, author, category and tags. Category Releases makes it a release: on /changelog instead of the blog." },
  Resource: { key: "resource", text: "A line on /resources: a title, a description and a link." },
  Redirect: { key: "redirect", text: "A short link: /go/its-title sends people to its Link." },
  Plan: { key: "plan", text: "A plan on /pricing: its price (empty is custom pricing), a yearly price, its features one a line, and its button." },
  Product: { key: "product", text: "A product at /shop/its-slug: price, pictures, a description, stock, and how it is bought." },
  Question: { key: "question", text: "A question on /questions, its answer in Text. Category Pricing puts it on /pricing too; Template, on this page." },
  Quote: { key: "quote", text: "A quotation: Text is what was said, Title is who said it. The homepage shows the first, /pricing the next." },
  "Proof Logos": { key: "logo", text: "A tool the site works with, in the “goes well with” strip, its mark in Image. The site’s own logo is not one: it is the site.logo row." },
  Person: { key: "person", text: "Somebody on /team, and the author of the posts that name them: Title is the name, Description the role, Text a line about them, Image the portrait. Team Page Off makes a guest: on their posts, off /team." },
  Review: { key: "review", text: "A review on the homepage: Title is the name, Text what they said, Rating the stars, Published Date when, Image their photo (none: their initials). Tag Example marks an invented one." },
  Section: { key: "section", text: "Where a section of a page goes: Title names it, Slug the page, Order its place. Unticked, it is off; two rows, it shows twice." },
  Menu: { key: "menu", text: "A link in the header or the footer: Title names the page, Slug the menu, Order its place. Unticked, it is off the menu." },
}

/** The Kind of the row the first step shows: Notion's own name for it, as
 *  the label below prints every Kind's. */
const COPY_KIND: Kind = "Site Copy"

/** One database: the three moves of writing, joined and each with a small
 *  working picture of itself, then what a row can be as the side of the
 *  pack: a label listing every Kind. */
export function TemplateRows({ T, content }: Props) {
  const steps: { key: string; title: React.ReactNode; text: React.ReactNode; demo: React.ReactNode }[] = [
    {
      key: "write",
      title: <T k="features.rows.1.title">write in notion</T>,
      text: <T k="features.rows.1.text">The editor you already use. Headings, toggles, tables, pictures: the blocks you write with come out as you wrote them.</T>,
      // a row as Notion shows it: its title, and its Kind
      demo: (
        <>
          <span className="truncate">{slotText(content, "features.rows.row.1", "hero.title")}</span>
          <span className="shrink-0 rounded-full bg-wash px-2 py-0.5 text-fine text-ink">{COPY_KIND}</span>
        </>
      ),
    },
    {
      key: "tick",
      title: <T k="features.rows.2.title">tick published</T>,
      text: <T k="features.rows.2.text">Nothing goes out until you say so. Date a post next week and it waits for the day.</T>,
      // the one box that puts a row on the site
      demo: (
        <>
          <span>{PROPS.published}</span>
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-text bg-btn">
            {/* a tick, drawn: two sides of a small box, turned */}
            <span className="h-[5px] w-[9px] -translate-y-px -rotate-45 border-b-2 border-l-2 border-btn-ink" />
          </span>
        </>
      ),
    },
    {
      key: "follows",
      title: <T k="features.rows.3.title">the site follows</T>,
      text: <T k="features.rows.3.text">Within a minute, or within seconds with a webhook. No build to run, no editor to log in to.</T>,
      // the homepage's own title, as the site shows it now
      demo: (
        <>
          <span className="truncate font-slab text-lead font-bold lowercase text-heading">{slotText(content, "home.hero.title", "everything you need, nothing you don't")}</span>
          <span className="small-print shrink-0">
            <T k="features.rows.live">Live</T>
          </span>
        </>
      ),
    },
  ]
  return (
    <MarketingSection labelledBy="rows-title">
      <SectionHead
        id="rows-title"
        align="center"
        eyebrow={<T k="features.rows.eyebrow">one database</T>}
        title={<T k="features.rows.title">every word is a row</T>}
        lede={<T k="features.rows.lede">The words on the pages, the pages themselves, the posts, the plans and the products. One Notion database, a Kind on each row.</T>}
      />
      {/* three steps in one strip, a dashed fold between them: stacked on a
          phone, side by side on a wide screen */}
      <ol className="arrive-each section-body grid overflow-hidden rounded-card md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-col gap-3.5 border-dashed border-line-strong bg-panel p-6 max-md:[&:not(:first-child)]:border-t-2 md:[&:not(:first-child)]:border-l-2">
            <p className="small-print">
              <T k="features.rows.step">Step</T> {i + 1}
            </p>
            <h3 className="title-slab text-head-s">{step.title}</h3>
            <div aria-hidden="true" className="flex min-h-[48px] items-center justify-between gap-3 rounded-block border border-line bg-card px-3.5 py-2.5 text-small text-ink">
              {step.demo}
            </div>
            <p className="text-ui leading-relaxed text-sub">{step.text}</p>
          </li>
        ))}
      </ol>
      {/* the side of the pack: every Kind a row can be, as its contents */}
      <aside aria-labelledby="kinds-title" className="mt-10 rounded-card border-[3px] border-ink p-5 sm:mt-14 sm:p-8">
        <h3 id="kinds-title" className="font-sans text-fluid-section font-black uppercase leading-[0.95] tracking-[-0.02em] text-ink">
          <T k="features.kinds.title">Contents</T>
        </h3>
        <p className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b-[10px] border-ink pb-2 pt-1.5 text-small text-ink">
          <span>
            <T k="features.kinds.serving">Serving size: 1 database</T>
          </span>
          <span>
            <T k="features.kinds.count">Kinds per database:</T> {KINDS.length}
          </span>
        </p>
        <dl className="grid gap-x-10 md:grid-cols-2">
          {KINDS.map((kind) => (
            <div key={kind} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-line-strong py-2.5 text-small leading-normal">
              <dt className="font-extrabold text-ink">{kind}</dt>
              <dd className="text-sub">
                <T k={`features.kinds.${KIND_ROWS[kind].key}`}>{KIND_ROWS[kind].text}</T>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-fine leading-relaxed text-sub">
          <T k="features.kinds.caption">The Kind of a row says what it makes. Nothing appears until Published is ticked and its Published Date, to the minute, has come; Status is for your team.</T>
        </p>
      </aside>
    </MarketingSection>
  )
}

/** How the words travel: Notion, the cache, everything the site makes. */
export function TemplateTravel({ T, content }: Props) {
  return (
    <MarketingSection id="travel" labelledBy="travel-title" tone="panel">
      <SectionHead
        id="travel-title"
        title={<T k="features.travel.title">all your content, in one place</T>}
        lede={<T k="features.travel.lede">The rows are read from Notion once a minute at most, whatever the traffic, and the body of a page again only after it is edited.</T>}
      />
      <div className="section-body">
        <Pipeline
          label={plainText(content, "features.travel.label", "How the words travel from Notion to the site")}
          source={{ title: <T k="features.travel.source.title">notion</T>, text: <T k="features.travel.source.text">one database, written by you</T> }}
          middle={{ title: <T k="features.travel.middle.title">the cache</T>, text: <T k="features.travel.middle.text">asked once a minute, kept if Notion is down</T> }}
          outputs={[
            { key: "pages", label: <T k="features.travel.out.pages">pages</T> },
            { key: "blog", label: <T k="features.travel.out.blog">blog</T> },
            { key: "shop", label: <T k="features.travel.out.shop">shop</T> },
            { key: "pricing", label: <T k="features.travel.out.pricing">pricing</T> },
            { key: "feed", label: <T k="features.travel.out.feed">RSS feed</T> },
            { key: "cards", label: <T k="features.travel.out.cards">share cards</T> },
            { key: "sitemap", label: <T k="features.travel.out.sitemap">sitemap</T> },
            { key: "llms", label: <T k="features.travel.out.llms">llms.txt</T> },
          ]}
        />
      </div>
    </MarketingSection>
  )
}

/** The nutrition facts of the template, and what it works with. */
export function TemplateFacts({ T, content, logos }: Props & { logos: React.ComponentProps<typeof LogoStrip>["items"] }) {
  return (
    <MarketingSection labelledBy="template-facts-heading" tone="panel">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <SectionHead
            id="template-facts-heading"
            size="section"
            eyebrow={<T k="features.facts.label">on the side of the tin</T>}
            title={<T k="features.facts.heading">nothing artificial</T>}
            lede={<T k="features.facts.lede">The numbers below are true of the code as it ships, not of a good day.</T>}
          />
          <div className="section-body">
            <LogoStrip align="left" label={<T k="features.logos.label">Works with</T>} items={logos} />
          </div>
        </div>
        <NutritionFacts
          id="template-facts-title"
          className="bg-page"
          title={<T k="features.facts.title">Nutrition facts</T>}
          serving={<T k="features.facts.serving">Serving size: 1 page view</T>}
          // a line whose name is unticked or blank goes, rule and all
          facts={FACTS.filter((fact) => !slotHidden(content, `features.facts.${fact.key}`)).map((fact) => ({
            key: fact.key,
            name: <T k={`features.facts.${fact.key}`}>{fact.name}</T>,
            value: <T k={`features.facts.${fact.key}.value`}>{fact.value}</T>,
          }))}
          note={
            <T k="features.facts.note">
              Pages are built ahead. Notion is asked for the words once a minute at most, whatever the traffic, and about a picture only when no cache holds it yet. Cost counted on the free plans of Notion, the email platforms and Vercel (whose free plan is for personal sites).
            </T>
          }
        />
      </div>
    </MarketingSection>
  )
}

/** One sentence in each of a slot's three states, live. `demo.default`
 *  never has a row (ROWLESS_SLOTS in lib/slots.ts), so on a connected site it
 *  shows nothing, and on the starter site the words in the code. */
export function TemplateStates({ T, content }: Props) {
  const hidden = slotHidden(content, "demo.hidden")
  const rowless = slotHidden(content, "demo.default")
  return (
    <MarketingSection id="serving" labelledBy="states-title">
      <SectionHead
        id="states-title"
        size="section"
        eyebrow={<T k="features.demo.label">serving suggestion</T>}
        title={<T k="features.demo.title">one sentence, three states</T>}
        lede={
          <T k="features.demo.lead">
            Every slot on the site reads a row in Notion. A ticked row: its words. An unticked row, a ticked one left empty, or no row at all: nothing, so no word reaches the site unseen. Only the starter site, before Notion is connected, shows the words written into the code.
          </T>
        }
      />
      <div className="section-body relative overflow-x-auto" role="region" aria-label={plainText(content, "features.demo.region", "The three states, side by side")} tabIndex={0}>
        <table className="n-table min-w-[620px]">
          <thead>
            <tr>
              <th scope="col">
                <T k="features.demo.col.row">In Notion</T>
              </th>
              <th scope="col">
                <T k="features.demo.col.rule">What the site does</T>
              </th>
              <th scope="col">
                <T k="features.demo.col.live">Live, right here</T>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="font-medium">
                <T k="features.demo.none.row">No row</T>
              </th>
              <td>
                <T k="features.demo.none.rule">Shows nothing: a word must be in Notion to show</T>
              </td>
              <td>
                <T k="demo.default">This sentence has no row: you see it only because Notion is not connected yet.</T>
                {rowless ? (
                  <span className="text-sub">
                    <T k="features.demo.blank.note">(nothing, on purpose)</T>
                  </span>
                ) : null}
              </td>
            </tr>
            <tr>
              <th scope="row" className="font-medium">
                <T k="features.demo.text.row">Ticked, with text</T>
              </th>
              <td>
                <T k="features.demo.text.rule">Shows the text from Notion</T>
              </td>
              <td>
                <T k="demo.published">This sentence is waiting for its Notion row to be published.</T>
              </td>
            </tr>
            <tr>
              <th scope="row" className="font-medium">
                <T k="features.demo.blank.row">Unticked, or left empty</T>
              </th>
              <td>
                <T k="features.demo.blank.rule">Shows nothing: the slot hides</T>
              </td>
              <td>
                <T k="demo.hidden">This sentence vanishes when its row is unticked, or ticked and left empty.</T>
                {hidden ? (
                  <span className="text-sub">
                    <T k="features.demo.blank.note">(nothing, on purpose)</T>
                  </span>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </MarketingSection>
  )
}
