import type React from "react"
import Link from "next/link"

import { gridLabels } from "@/components/commerce/labels"
import { productView } from "@/components/commerce/product"
import { ProductGrid } from "@/components/commerce/product-grid"
import { cardLabel, PostGallery } from "@/components/notion/post-card"
import { Container, FeatureColumns, FinalCta, logoItems, LogoStrip, MarketingSection, MoreLink, NutritionFacts, Quote, ReviewCards, SectionHead } from "@/components/sections/marketing"
import { sitePlans } from "@/components/sections/plans"
import { ServiceFacts } from "@/components/sections/template/services"
import { LinkedText } from "@/components/system/linked-text"
import { fillIn, plainText, slotHidden, slotHref, slotText } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { mediaUrl } from "@/lib/content/media"
import { blogPosts, featuredFirst, formatDate, isExample, liveLogos, liveProducts, liveReviews, quoteFor } from "@/lib/content/select"
import { safeHref } from "@/lib/inline-links"
import { NOT_FOUND_LINKS } from "@/lib/nav"
import { formatPrice, priceFor } from "@/lib/pricing"
import type { SectionKey } from "@/lib/sections"
import { SITE_LANGUAGE } from "@/lib/site"
import type { SectionContext, SectionDraw } from "./context"
import { quoteView } from "./quote"

/** The figures on the side of the pack, for the generic company the
 *  starter content describes. Each is a slot, value included. */
const FACTS: { key: string; name: string; value: string }[] = [
  { key: "fees", name: "Hidden fees", value: "0" },
  { key: "print", name: "Small print", value: "0" },
  { key: "contracts", name: "Contracts you cannot leave", value: "0" },
  { key: "cancel", name: "Time it takes to cancel", value: "~1 min" },
  { key: "people", name: "Emails answered by a person", value: "100%" },
  { key: "additives", name: "Words you need a dictionary for", value: "0" },
]

/** The three promises on the belt, in the order they come down it, each in
 *  its own colours. Every word is a slot. */
const PROMISES: { key: string; label: string; words: string; note: string; dress: string }[] = [
  { key: "price", label: "On the front", words: "the price", note: "One price, VAT in it", dress: "bg-ink text-page" },
  { key: "person", label: "Replies", words: "a person", note: "In sentences", dress: "bg-panel text-ink" },
  { key: "exit", label: "Always open", words: "the exit", note: "No contract to read", dress: "bg-btn text-btn-ink" },
]

/** The average in a word, by its nearest whole star, as a review site says it. */
const VERDICTS = (T: SectionContext["T"]): Record<number, React.ReactNode> => ({
  5: <T k="home.reviews.verdict.5">Excellent</T>,
  4: <T k="home.reviews.verdict.4">Great</T>,
  3: <T k="home.reviews.verdict.3">Average</T>,
  2: <T k="home.reviews.verdict.2">Poor</T>,
  1: <T k="home.reviews.verdict.1">Bad</T>,
})

/**
 * The homepage's sections, in the order a stranger asks (lib/sections.ts):
 * what is the deal (the statement: one word the width of the window, and
 * three promises riding a checkout belt under it), why is it like this (why
 * generic, the tools it goes with), who says so (a quotation), is there a
 * catch (the small print in large print), what does it cost (the plans),
 * what can I get today (the shelf, what people say about it, then the three
 * newest posts), one band about the template itself (described in full on
 * /features), the maker's plain facts, and the way in.
 */
export const HOME_SECTIONS = {
  // the checkout, without the till: one word the width of the window, and
  // under it the three promises as cards on a belt. As the reader scrolls
  // they come in from the right, are lit as the scanner's line crosses
  // them, and ride on off the left of the window (app/globals.css). With no
  // motion they stand in a row. Type and colour only: no picture, no goods.
  "home.statement": ({ T, content, id }) => {
    if (slotHidden(content, "home.statement.word")) return null
    const title = id("statement-title")
    return (
      <section aria-labelledby={title} className="statement relative overflow-x-clip pb-16 pt-16 sm:pb-24">
        <h2 id={title} className="statement-word title-slab">
          <T k="home.statement.word">generic</T>
        </h2>
        <div className="belt">
          <div aria-hidden="true" className="belt-scanner" />
          <div aria-hidden="true" className="belt-surface" />
          <ul className="belt-items">
            {PROMISES.map((promise, i) => (
              <li key={promise.key} className={`belt-item ${promise.dress}`} style={{ "--i": i } as React.CSSProperties}>
                <p className="font-mono text-micro uppercase tracking-[0.12em] sm:text-fine">
                  <T k={`home.statement.${promise.key}.label`}>{promise.label}</T>
                </p>
                <div>
                  <p className="belt-words font-slab font-bold lowercase leading-[0.9] tracking-[-0.02em]">
                    <T k={`home.statement.${promise.key}`}>{promise.words}</T>
                  </p>
                  <p className="mt-2 font-mono text-micro uppercase tracking-[0.12em] sm:text-fine">
                    <T k={`home.statement.${promise.key}.note`}>{promise.note}</T>
                  </p>
                  <span aria-hidden="true" className="belt-barcode" />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Container className="mt-10 sm:mt-14">
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            <div className="max-w-[420px]">
              <p className="text-lead leading-relaxed text-ink">
                <T k="home.statement.text">We sell ordinary things at the price on the label, answer every message ourselves, and let you leave whenever you like.</T>
              </p>
              <MoreLink href={slotHref(content, "home.statement.more", "/about")} className="mt-3 min-h-[44px] text-ui">
                <T k="home.statement.more" words>
                  Read more
                </T>
              </MoreLink>
            </div>
            <p className="max-w-[300px] text-ui leading-relaxed text-sub md:ml-auto md:text-right">
              <T k="home.statement.note">Three promises, kept where you can see them. The rest of this page is the detail.</T>
            </p>
          </div>
        </Container>
      </section>
    )
  },

  "home.why": ({ T, id, tone }) => {
    const title = id("why-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <SectionHead id={title} align="center" eyebrow={<T k="home.why.label">why generic</T>} title={<T k="home.why.title">the label says what is inside</T>} />
        <div className="section-body">
          <FeatureColumns
            align="center"
            items={[
              {
                key: "packaging",
                title: <T k="home.why.packaging.title">plain packaging</T>,
                text: <T k="home.why.packaging.text">No logo shouting from across the aisle. The front says what it is; the side says what is in it.</T>,
              },
              {
                key: "prices",
                title: <T k="home.why.prices.title">honest prices</T>,
                text: <T k="home.why.prices.text">One price, shown before you buy, with VAT in it. No offers that end at midnight.</T>,
              },
              {
                key: "people",
                title: <T k="home.why.people.title">a person replies</T>,
                text: <T k="home.why.people.text">Every message is read by somebody who works here, and answered in sentences.</T>,
              },
            ]}
          />
        </div>
      </MarketingSection>
    )
  },

  // the tools the site goes with; a blank or unticked label takes the strip away
  "home.logos": ({ T, content, data }) => {
    if (slotHidden(content, "home.logos.label")) return null
    const logos = logoItems(liveLogos(data).map((logo) => ({ id: logo.id, title: logo.title, cover: logo.cover ? mediaUrl(logo.cover, "logo") : undefined, link: logo.link })), content)
    return (
      <div className="mx-auto w-full max-w-site px-5 py-12 sm:px-8 sm:py-16">
        <LogoStrip label={<T k="home.logos.label">goes well with</T>} items={logos} />
      </div>
    )
  },

  "home.facts": ({ T, content, id, tone }) => {
    const title = id("facts-title")
    const label = id("nutrition-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <SectionHead
              id={title}
              size="section"
              eyebrow={<T k="home.facts.label">the small print</T>}
              title={<T k="home.facts.heading">the small print, in large print</T>}
              lede={<T k="home.facts.lede">Everything we would rather you knew before you buy, on the side of the pack where it belongs.</T>}
            />
            {/* there is no small print, and the link proves it (lib/nav.ts) */}
            <ButtonRow className="mt-6">
              <ButtonLink href={NOT_FOUND_LINKS.smallPrint} tone="outline" rel="nofollow">
                <T k="home.facts.more">Read the small print</T>
              </ButtonLink>
            </ButtonRow>
          </div>
          <NutritionFacts
            id={label}
            title={<T k="home.facts.title">Nutrition facts</T>}
            serving={<T k="home.facts.serving">Serving size: 1 customer</T>}
            // a line whose name is unticked or blank goes, rule and all
            facts={FACTS.filter((fact) => !slotHidden(content, `home.facts.${fact.key}`)).map((fact) => ({
              key: fact.key,
              name: <T k={`home.facts.${fact.key}`}>{fact.name}</T>,
              value: <T k={`home.facts.${fact.key}.value`}>{fact.value}</T>,
            }))}
            note={<T k="home.facts.note">Values per customer. Checked by a person, not a marketing department.</T>}
          />
        </div>
      </MarketingSection>
    )
  },

  "home.plans": ({ T, content, data, id, tone }) => {
    const plans = sitePlans(data)
    if (!plans.length) return null
    const custom = slotText(content, "pricing.custom", "custom pricing")
    const title = id("plans-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead id={title} size="section" eyebrow={<T k="home.plans.label">plans</T>} title={<T k="home.plans.title">pick a plan, change it any time</T>} />
          <Link href="/pricing" className="n-link inline-flex min-h-[44px] items-center text-body">
            <T k="home.plans.all">Compare the plans</T>
          </Link>
        </div>
        <ul className="arrive-each section-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const amount = priceFor(plan, "monthly")
            return (
              <li key={plan.key} className={`lit rounded-card bg-card p-6 ${plan.recommended ? "ring-2 ring-accent" : "border border-line"}`}>
                <h3 className="title-slab text-head-s">{plan.name}</h3>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="title-slab text-head-m">{amount === undefined ? custom : formatPrice(amount, plan.currency)}</span>
                  {amount !== undefined && plan.priceNote ? <span className="text-small text-sub">{plan.priceNote}</span> : null}
                </p>
                {plan.description ? (
                  <p className="mt-2 text-ui leading-relaxed text-sub">
                    <LinkedText text={plan.description} />
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </MarketingSection>
    )
  },

  // the first quotation (featured first); /pricing's plans show the next
  "home.quote": ({ data, tone }) => {
    const quote = quoteFor(data, "home")
    if (!quote) return null
    return (
      <MarketingSection tone={tone} className="pb-0 sm:pb-0">
        <Quote {...quoteView(quote)} />
      </MarketingSection>
    )
  },

  // the goods, then what people say about them
  "home.shelf": ({ T, content, data, id, tone }) => {
    const products = featuredFirst(liveProducts(data)).slice(0, 4).map(productView)
    if (!products.length) return null
    const title = id("shelf-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead id={title} size="section" eyebrow={<T k="home.shelf.label">on the shelf</T>} title={<T k="home.shelf.title">plain goods, fairly priced</T>} />
          <Link href="/shop" className="n-link inline-flex min-h-[44px] items-center text-body">
            <T k="home.shelf.all">Shop everything</T>
          </Link>
        </div>
        <div className="section-body">
          <ProductGrid products={products} labels={gridLabels(content)} sortable={false} />
        </div>
      </MarketingSection>
    )
  },

  "home.reviews": ({ T, content, data, id, tone }) => {
    const reviews = liveReviews(data).slice(0, 4)
    if (!reviews.length) return null
    const title = id("reviews-title")
    return (
      <MarketingSection labelledBy={title} tone={tone} className="overflow-x-clip">
        <ReviewCards
          titleId={title}
          title={<T k="home.reviews.title">what people say</T>}
          example={reviews.some(isExample)}
          reviews={reviews.map((review) => ({
            key: review.id,
            name: review.title,
            text: <LinkedText text={review.text ?? ""} />,
            rating: review.rating ?? 0,
            date: review.date,
            when: review.date ? formatDate(review.date, SITE_LANGUAGE) : undefined,
            photo: review.cover ? mediaUrl(review.cover, "portrait") : undefined,
            href: review.link ? safeHref(review.link) : undefined,
          }))}
          words={{
            average: <T k="home.reviews.average">average rating</T>,
            count: <T k="home.reviews.count">reviews</T>,
            verdict: (stars) => VERDICTS(T)[stars],
            rated: (stars) => fillIn(plainText(content, "home.reviews.rated", "{stars} out of 5 stars"), { stars }),
            example: <T k="home.reviews.example">example reviews</T>,
            source: <T k="home.reviews.source">Read where it was left</T>,
            pause: plainText(content, "home.reviews.pause", "Pause the reviews"),
          }}
        />
      </MarketingSection>
    )
  },

  // the three newest: the blog's fresh end, featured or not
  "home.posts": ({ T, content, data, id, tone }) => {
    const posts = blogPosts(data).slice(0, 3)
    const title = id("posts-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead id={title} size="section" eyebrow={<T k="home.posts.label">fresh</T>} title={<T k="home.posts.title">from the blog</T>} />
          <Link href="/blog" className="n-link inline-flex min-h-[44px] items-center text-body">
            <T k="home.posts.all">All posts</T>
          </Link>
        </div>
        <div className="section-body">
          {posts.length ? (
            <PostGallery posts={posts} label={cardLabel(content)} />
          ) : (
            <Callout icon={<Icon name="note-pencil" />}>
              <T k="home.posts.empty">No posts yet. Write one in Notion: a row with Kind set to Post and Published ticked. It appears here within a minute.</T>
            </Callout>
          )}
        </div>
      </MarketingSection>
    )
  },

  "home.template": ({ T, id }) => {
    const title = id("template-band-title")
    return (
      <section aria-labelledby={title} className="px-5 pb-6 sm:px-8">
        <div className="appear mx-auto max-w-site overflow-hidden rounded-panel border border-line bg-card">
          <div className="flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[640px]">
              <h2 id={title} className="title-slab text-head-s sm:text-head-m">
                <T k="home.template.title">this is a live demo</T>
              </h2>
              <p className="mt-2 text-body leading-relaxed text-sub">
                <T k="home.template.text">Everything here is a Notion-powered CMS running live: every word on this site can be written in Notion. Make your own: deploy it on Vercel in five steps, and call it whatever you like.</T>
              </p>
            </div>
            <ButtonRow className="shrink-0">
              <ButtonLink href="/features#deploy" tone="accent">
                <T k="home.template.deploy">Deploy in five steps</T>
              </ButtonLink>
              <ButtonLink href="/features" tone="quiet" className="group">
                <T k="home.template.more">How it works</T>
                <span aria-hidden="true" className="turn group-hover:translate-x-0.5">
                  →
                </span>
              </ButtonLink>
            </ButtonRow>
          </div>
        </div>
      </section>
    )
  },

  // the maker's plain facts, under the band that says what this site is
  "home.service": ({ T, content, id, tone }) => <ServiceFacts T={T} content={content} titleId={id("services-facts-title")} tone={tone} />,

  "home.final": ({ T, content, id }) => (
    <FinalCta
      titleId={id("final-title")}
      title={<T k="home.final.title">get the generic, call it whatever you like</T>}
      lede={<T k="home.final.lede">Plain products, plain plans, plain words. Start with the shelf or start with a question.</T>}
      actions={
        <ButtonRow className="justify-center">
          {/* its own row, not the hero's: a link on the hero's button moves
              that one alone, and this one still starts with the shelf */}
          <ButtonLink href={slotHref(content, "home.final.shop", "/shop")}>
            <T k="home.final.shop" words>
              Shop the shelf
            </T>
          </ButtonLink>
          <ButtonLink href={slotHref(content, "home.final.contact", "/contact")} tone="secondary">
            <T k="home.final.contact" words>
              Ask a question
            </T>
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),
} satisfies Partial<Record<SectionKey, SectionDraw>>
