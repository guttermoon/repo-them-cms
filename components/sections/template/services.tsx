import type React from "react"

import { MiniBrowser, MiniCalendar, MiniPricing, MiniShield, MiniTable } from "@/components/illustrations/mini"
import { JsonLd } from "@/components/system/json-ld"
import { plainText, slotText, type SiteCopy, type T } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Mark } from "@/components/ui/label"
import { MAKER, MAKER_HOST } from "@/lib/site"
import { serviceLd } from "@/lib/structured-data"

import { Bento, FeatureTabs, MarketingSection, SectionHead, SplitFeature, StatCards, TrustFacts } from "../marketing"
import { helloHref, makerTitle, offerHref, OFFERS } from "../service-counter"

/** Colours a brand might bring, for the design tab's picture. */
const SWATCHES = ["#283FA6", "#E6EAF9", "#37352F", "#F7F6F3", "#C2410C", "#15803D"]

/** The way to the maker, under a heading: their work, and their address
 *  (an email written for the offer, `helloHref`). */
function MakerButtons({ T, content, className = "" }: { T: T; content: SiteCopy; className?: string }) {
  return (
    <ButtonRow className={`mt-6 ${className}`.trim()}>
      <ButtonLink href={MAKER.url} title={makerTitle(content)}>
        <T k="services.cta.work">See my work at</T> {MAKER_HOST}
      </ButtonLink>
      <ButtonLink href={helloHref(content)} tone="secondary">
        {MAKER.email}
      </ButtonLink>
    </ButtonRow>
  )
}

/**
 * The maker's services, set out at length on /features (#services), under
 * the service counter there: the offer and a way to ask, the four services
 * as tabs, what comes with each, and the way to order. The
 * same offers the counter makes (components/sections/service-counter.tsx),
 * and every word a slot (`services.*`, `service.*`). Setup and care as
 * stories open /features (`TemplateSplits`), the plain facts are on the
 * homepage (`ServiceFacts`), the promises on /pricing (`ServicePromises`).
 */
export function TemplateServices({ T, content }: { T: T; content: SiteCopy }) {
  // the little site in the browser pictures
  const browser = { name: slotText(content, "services.art.name", "your site"), headline: slotText(content, "services.art.headline", "a website") }
  const offer = (key: string) => OFFERS.find((o) => o.key === key)!

  const tabs = [
    {
      key: "setup",
      panel: (
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
          <MiniTable
            rows={[
              { kind: "Site Copy", title: slotText(content, "services.tab.setup.row.1", "hero.title"), on: true },
              { kind: "Page", title: slotText(content, "services.tab.setup.row.2", "About us"), on: true },
              { kind: "Post", title: slotText(content, "services.tab.setup.row.3", "We are open"), on: true },
            ]}
          />
          <ul className="space-y-3 text-body text-ink">
            {["database", "integration", "deploy", "domain", "email"].map((step) => (
              <li key={step} className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-tint text-brand">
                  ✓
                </span>
                <T k={`services.tab.setup.${step}`}>{{ database: "Notion database made", integration: "Integration connected", deploy: "Deployed on your hosting", domain: "Your domain pointed at it", email: "Email platform wired in" }[step]}</T>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: "design",
      panel: (
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-2">
          <div aria-hidden="true" className="grid grid-cols-3 gap-3">
            {SWATCHES.map((colour) => (
              <span key={colour} className="h-20 rounded-block border border-line" style={{ background: colour }} />
            ))}
          </div>
          <div aria-hidden="true">
            <span className="title-slab title-display block text-display">Aa</span>
            <span className="mt-2 block font-serif text-head-s text-ink">{slotText(content, "services.tab.design.lettering", "Your lettering")}</span>
            <span className="mt-1 block font-mono text-small text-sub">{slotText(content, "services.tab.design.file", "your-brand.css")}</span>
          </div>
        </div>
      ),
    },
    {
      key: "move",
      panel: (
        <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto_1fr]">
          <MiniBrowser host={slotText(content, "services.tab.move.old", "old-site.example")} name={browser.name} headline={browser.headline} />
          <span aria-hidden="true" className="text-center text-head-l text-accent">
            →
          </span>
          <MiniTable
            rows={[
              { kind: "Page", title: slotText(content, "services.tab.move.row.1", "Home"), on: true },
              { kind: "Post", title: slotText(content, "services.tab.move.row.2", "Every old post"), on: true },
              { kind: "Page", title: slotText(content, "services.tab.move.row.3", "Contact"), on: true },
            ]}
          />
        </div>
      ),
    },
    {
      key: "care",
      panel: (
        <div className="p-6 sm:p-8">
          <MiniCalendar
            days={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
              day: slotText(content, `services.tab.care.day.${i + 1}`, day),
              post: i === 1 ? slotText(content, "services.tab.care.update", "update") : i === 3 ? slotText(content, "services.tab.care.fix", "fix") : undefined,
            }))}
          />
        </div>
      ),
    },
  ].map(({ key, panel }) => ({
    key,
    title: plainText(content, `service.${key}.label`, offer(key).label),
    text: <T k={`service.${key}.title`}>{offer(key).title}</T>,
    panel: (
      <div>
        {panel}
        <div className="border-t border-line px-6 py-5 sm:px-8">
          <p className="max-w-[720px] text-body leading-relaxed text-ink">
            <T k={`service.${key}.body`}>{offer(key).body}</T>
          </p>
          <ButtonRow className="mt-4">
            <ButtonLink href={offerHref(content, offer(key))} tone="outline">
              <T k={`service.${key}.cta`}>{offer(key).cta}</T>
            </ButtonLink>
          </ButtonRow>
        </div>
      </div>
    ),
  }))

  return (
    <>
      <JsonLd
        data={serviceLd(
          // what the page shows, and nothing it does not: a service whose
          // name has no row is left out, as the page leaves it out
          ["setup", "build", "design", "move", "care", "training"]
            .map((key) => ({
              name: slotText(content, `service.${key}.label`, offer(key).label),
              description: slotText(content, `service.${key}.body`, offer(key).body),
            }))
            .filter((service) => service.name),
        )}
      />
      <MarketingSection id="services" labelledBy="services-title" tone="panel">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHead
              id="services-title"
              eyebrow={<T k="services.eyebrow">done for you</T>}
              title={<T k="services.title">websites, made to order</T>}
              lede={
                <T k="services.lede">
                  Megan Aileen Williams made this template, and will set it up for you or build your site to order: your brand, your words, a site you run from Notion.
                </T>
              }
            />
            <MakerButtons T={T} content={content} />
          </div>
          <MiniBrowser host={slotText(content, "services.art.host", "your-site.example")}>
                      <div className="flex items-center gap-2">
                        <Mark className="h-5 w-5" />
                        <span className="title-slab text-ui">
                          <T k="services.art.brand">your brand</T>
                        </span>
                      </div>
                      <span className="title-slab title-display mt-4 block text-head-l">
                        <T k="services.art.title">made to order</T>
                      </span>
                      <div className="mt-5">
                        <MiniPricing
                          plans={[
                            { name: slotText(content, "services.art.plan.1", "basic"), price: slotText(content, "services.art.price.1", "£"), on: false },
                            { name: slotText(content, "services.art.plan.2", "pro"), price: slotText(content, "services.art.price.2", "££"), on: true },
                          ]}
                        />
                      </div>
                      <div className="stripe stripe-sm mt-4" />
                    </MiniBrowser>
        </div>
      </MarketingSection>

      <MarketingSection labelledBy="services-tabs-title">
        <SectionHead
          id="services-tabs-title"
          align="center"
          title={<T k="services.tabs.title">four ways to a website</T>}
          lede={<T k="services.tabs.lede">Pick one or take them all. Each is quoted on its own, in writing.</T>}
        />
        <div className="section-body">
          <FeatureTabs label={plainText(content, "services.tabs.label", "The services")} tabs={tabs} />
        </div>
      </MarketingSection>

      <MarketingSection labelledBy="services-bento-title">
        <SectionHead id="services-bento-title" align="center" title={<T k="services.bento.title">what you get, whichever you choose</T>} />
        <div className="section-body">
          <Bento
            items={[
              {
                key: "notion",
                title: <T k="services.bento.notion.title">your notion, your accounts</T>,
                text: <T k="services.bento.notion.text">Everything is set up in your name: the Notion workspace, the hosting, the domain and the email platform.</T>,
                art: (
                  <MiniTable
                    rows={[
                      { kind: "Page", title: slotText(content, "services.bento.notion.row.1", "Home"), on: true },
                      { kind: "Product", title: slotText(content, "services.bento.notion.row.2", "Your first product"), on: false },
                    ]}
                  />
                ),
              },
              {
                key: "shop",
                title: <T k="services.bento.shop.title">a shop or a price list</T>,
                text: <T k="services.bento.shop.text">Products brought in from your Shopify or Printify shop, which keeps the catalogue and takes the money, or plans with a comparison table written in Notion.</T>,
                art: (
                  <MiniPricing
                    plans={[
                      { name: slotText(content, "services.bento.shop.plan.1", "free"), price: slotText(content, "services.bento.shop.price.1", "£0") },
                      { name: slotText(content, "services.bento.shop.plan.2", "pro"), price: slotText(content, "services.bento.shop.price.2", "£12"), on: true },
                    ]}
                  />
                ),
              },
              {
                key: "privacy",
                title: <T k="services.bento.privacy.title">private by default</T>,
                text: <T k="services.bento.privacy.text">No third party in your readers&apos; browsers, analytics only after a yes, and fonts served from your own domain.</T>,
                art: (
                  <MiniShield
                    value={slotText(content, "services.bento.privacy.value", "0")}
                    caption={slotText(content, "services.bento.privacy.caption", "third-party requests from a reader's browser")}
                  />
                ),
              },
              {
                key: "handover",
                title: <T k="services.bento.handover.title">handed over, not locked in</T>,
                text: <T k="services.bento.handover.text">A walk-through of writing in Notion, the code in your repository, and nothing you need to come back for.</T>,
                href: "#deploy",
                more: <T k="services.bento.handover.more">Read the directions</T>,
              },
            ]}
          />
        </div>
      </MarketingSection>

      <MarketingSection labelledBy="services-final-title" className="pt-0 text-center sm:pt-0">
        <SectionHead
          id="services-final-title"
          align="center"
          size="section"
          title={<T k="services.final.title">one website, made to order</T>}
          lede={<T k="services.final.lede">Say what you need and get a fixed quote.</T>}
        />
        <MakerButtons T={T} content={content} className="justify-center" />
      </MarketingSection>
    </>
  )
}

/**
 * Two of the maker's services told as stories, setup and care, for /features
 * under its hero, above "one database": each a picture and a sentence, with
 * a link to where the page shows it. Each title heads its own section, an h2 under the page's
 * h1. "See what is in the tin" goes to the full list of ingredients further
 * down, and "See how it works" to how the words travel from Notion to the
 * site (#travel). Every word a slot (`services.split.*`).
 */
export function TemplateSplits({ T, content }: { T: T; content: SiteCopy }) {
  const browser = { name: slotText(content, "services.art.name", "your site"), headline: slotText(content, "services.art.headline", "a website") }
  return (
    <>
      <MarketingSection labelledBy="services-split-1" className="pb-10 sm:pb-12">
        <SplitFeature
          id="services-split-1"
          heading="h2"
          eyebrow={<T k="services.split.1.eyebrow">setup</T>}
          title={<T k="services.split.1.title">start from a site that already works</T>}
          text={<T k="services.split.1.text">Every page of this site comes with it. Setup is connecting it to your accounts and making it say your words, not starting from nothing.</T>}
          more={{ href: "#ingredients", label: <T k="services.split.1.more">See what is in the tin</T> }}
          media={<MiniBrowser host={slotText(content, "services.split.1.host", "your-site.example")} name={browser.name} headline={browser.headline} />}
        />
      </MarketingSection>
      <MarketingSection labelledBy="services-split-2" className="pt-10 sm:pt-12">
        <SplitFeature
          id="services-split-2"
          heading="h2"
          reverse
          eyebrow={<T k="services.split.2.eyebrow">care</T>}
          title={<T k="services.split.2.title">you keep writing, it keeps running</T>}
          text={<T k="services.split.2.text">A care plan covers the updates the code needs and the small changes you ask for, so the site keeps working while you get on with the words.</T>}
          more={{ href: "#travel", label: <T k="services.split.2.more">See how it works</T> }}
          media={
            <MiniCalendar
              days={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
                day: slotText(content, `services.tab.care.day.${i + 1}`, day),
                post: i === 2 ? slotText(content, "services.tab.care.update", "update") : undefined,
              }))}
            />
          }
        />
      </MarketingSection>
    </>
  )
}

/**
 * What the maker promises, whichever service: a price first, the work
 * yours to keep, private by default, independent of Notion, plain words and
 * a person. On /pricing, beside the prices. Every word a slot
 * (`services.trust.*`).
 */
export function ServicePromises({ T, titleId = "services-trust-title", tone = "panel" }: { T: T; titleId?: string; tone?: "page" | "panel" }) {
  return (
    <MarketingSection labelledBy={titleId} tone={tone}>
      <SectionHead id={titleId} size="section" title={<T k="services.trust.title">what is promised</T>} />
      <div className="section-body">
        <TrustFacts
          items={[
            { key: "quote", title: <T k="services.trust.quote.title">a price first</T>, text: <T k="services.trust.quote.text">A fixed quote, in writing, before any work starts.</T> },
            { key: "yours", title: <T k="services.trust.yours.title">yours to keep</T>, text: <T k="services.trust.yours.text">The code in your repository and the content in your Notion, both yours.</T> },
            { key: "private", title: <T k="services.trust.private.title">private by default</T>, text: <T k="services.trust.private.text">Readers&apos; browsers contact nobody but your site.</T> },
            { key: "independent", title: <T k="services.trust.independent.title">independent</T>, text: <T k="services.trust.independent.text">An independent service, not Notion&apos;s and not endorsed by Notion.</T> },
            { key: "plain", title: <T k="services.trust.plain.title">plain words</T>, text: <T k="services.trust.plain.text">What will be done, by when, and what it costs, in sentences.</T> },
            { key: "help", title: <T k="services.trust.help.title">a person</T>, text: <T k="services.trust.help.text">Questions answered by the person who made the template.</T> },
          ]}
        />
      </div>
    </MarketingSection>
  )
}

/**
 * The maker's plain facts, three figures and what each counts, for the
 * homepage after setup and care. Each figure is a slot as well as its words
 * (`services.facts.<fact>.value`): it is a promise written down, not a sum
 * the code works out.
 */
export function ServiceFacts({ T, content, titleId = "services-facts-title", tone = "panel" }: { T: T; content: SiteCopy; titleId?: string; tone?: "page" | "panel" }) {
  return (
    <MarketingSection labelledBy={titleId} tone={tone}>
      <SectionHead id={titleId} size="section" align="center" title={<T k="services.facts.title">plain facts</T>} />
      <div className="section-body">
        <StatCards
          band
          items={[
            { key: "quote", value: slotText(content, "services.facts.quote.value", "1"), label: <T k="services.facts.quote">fixed quote, in writing, before any work starts</T> },
            { key: "yours", value: slotText(content, "services.facts.yours.value", "100%"), label: <T k="services.facts.yours">of the code yours to keep, under the MIT licence</T> },
            { key: "accounts", value: slotText(content, "services.facts.accounts.value", "0"), label: <T k="services.facts.accounts">accounts held in somebody else&apos;s name</T> },
          ]}
        />
      </div>
    </MarketingSection>
  )
}
