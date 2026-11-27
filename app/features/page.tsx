import type { Metadata } from "next"
import Link from "next/link"
import type React from "react"

import { MiniAccess, MiniBrowser, MiniCalendar, MiniFanout, MiniForm, MiniPricing, MiniShield, MiniTable } from "@/components/illustrations/mini"
import { STILL_LIFE_WORDS, StillLife, type StillLifeWords } from "@/components/illustrations/still-life"
import { Bento, Faq, FeatureTabs, HeroCentered, logoItems, MarketingSection, MoreLink, SectionHead } from "@/components/sections/marketing"
import { DeploySteps } from "@/components/sections/template/deploy"
import { IngredientChips, INGREDIENTS_PATH } from "@/components/sections/template/ingredients"
import { TemplateFacts, TemplateRows, TemplateStates, TemplateTravel } from "@/components/sections/template/how-it-works"
import { TemplateServices, TemplateSplits } from "@/components/sections/template/services"
import { ServiceCounter } from "@/components/sections/service-counter"
import { JsonLd } from "@/components/system/json-ld"
import { LinkedText } from "@/components/system/linked-text"
import { makeT, plainText, siteName, slotHidden, slotHref, slotText } from "@/components/system/notion-text"
import { Callout, Divider, Todo, Toggle } from "@/components/ui/blocks"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Frame, TagLink } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/lib/icons"
import { mediaUrl } from "@/lib/content/media"
import { liveLogos, livePages, liveQuestions } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { REPO_URL, TEMPLATE_URL } from "@/lib/site"
import { answeredRows, pageLd } from "@/lib/structured-data"
import { NOT_FOUND_LINKS } from "@/lib/nav"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/features", await getSiteData())
}

const SHELF_LINKS: { key: string; title: string; text: string; link: string; href: string }[] = [
  { key: "website", title: "website", text: "The whole site in one box: pages, a blog, a shop and plans, live in five steps.", link: "Deploy in five steps", href: "#deploy" },
  { key: "blog", title: "blog", text: "Posts with dates, categories, tags and a feed. Tick Published and it is out.", link: "Read the blog", href: "/blog" },
  { key: "pages", title: "pages", text: "Write a page in Notion and it is a page here, drawn as Notion draws it.", link: "See how it works", href: "#rows" },
  { key: "copy", title: "copy", text: "Every word on the site is a row. Change it in Notion and the site follows.", link: "Read the ingredients", href: "/resources/ingredients" },
]

export default async function FeaturesPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const getHref = TEMPLATE_URL || "#deploy"
  const logos = logoItems(liveLogos(data).map((logo) => ({ id: logo.id, title: logo.title, cover: logo.cover ? mediaUrl(logo.cover, "logo") : undefined, link: logo.link })), content)
  // the page that shows every block, when the database still has it
  const everyBlock = livePages(data).some((page) => page.slug === "every-block")
  const templateRows = liveQuestions(data, "Template")
  // the template's own questions: Question rows with Category Template
  const questions = templateRows.map((row) => ({ key: row.id, question: row.title, answer: <LinkedText text={row.text ?? ""} /> }))
  const answered = answeredRows(templateRows)
  const jumps = [
    { href: "#rows", key: "rows", name: "How it works" },
    { href: "#ingredients", key: "ingredients", name: "Every ingredient" },
    { href: "#deploy", key: "deploy", name: "Deploy in five steps" },
    { href: "#services", key: "services", name: "Have it made" },
    ...(questions.length ? [{ href: "#template-questions", key: "questions", name: "Questions" }] : []),
  ]
  const tab = (key: string, title: string, text: string, panel: React.ReactNode) => ({
    key,
    title: plainText(content, `features.tab.${key}.title`, title),
    text: <T k={`features.tab.${key}.text`}>{text}</T>,
    panel: <div className="p-6 sm:p-8">{panel}</div>,
  })
  return (
    <>
      <JsonLd data={pageLd("/features", data, { questions: answered })} />
      <HeroCentered
        eyebrow={<T k="features.label">a notion-powered cms</T>}
        title={<T k="features.title">everything in the tin</T>}
        lede={
          <T k="features.lede">
            This site is a live demo of the template, and Notion is its CMS. Copy, pages, posts, plans and products live in one database: tick Published and the site follows. The full list of ingredients is one press away. Nothing hidden, nothing artificial.
          </T>
        }
        actions={
          <ButtonRow className="justify-center">
            <ButtonLink href={getHref}>
              <T k="features.cta.get">Get it free</T>
            </ButtonLink>
            <ButtonLink href="#deploy" tone="secondary">
              <T k="features.cta.setup">Deploy in five steps</T>
            </ButtonLink>
          </ButtonRow>
        }
        note={<T k="features.cta.note">Free. Open source. MIT licence. Runs on Notion.</T>}
        visual={
          <div className="shelf-stage">
            <StillLife
              brand={siteName(content)}
              links={{ box: "#shelf-website", can: "#shelf-blog", carton: "#shelf-pages", bag: "#shelf-copy" }}
              words={Object.fromEntries(Object.entries(STILL_LIFE_WORDS).map(([key, words]) => [key, slotText(content, `features.art.${key}`, words)])) as StillLifeWords}
              label={plainText(
                content,
                "features.art.label",
                "White generic packs with blue stripes on a shelf: a box labelled website, a can labelled blog, a carton labelled pages and a bag labelled copy.",
              )}
            />
            {/* under each pack, what it is and the way to it, in the shelf's order.
                Pressing a pack picks it up and jumps to its column (app/globals.css). */}
            <ul className="mt-10 grid gap-x-8 gap-y-8 text-left sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
              {SHELF_LINKS.map((item) => (
                <li key={item.key} id={`shelf-${item.key}`} className="jump-target border-t-2 border-ink pt-4">
                  <h2 className="title-slab text-head-s">
                    <T k={`features.shelf.${item.key}.title`}>{item.title}</T>
                  </h2>
                  <p className="mt-2 text-body leading-relaxed text-sub">
                    <T k={`features.shelf.${item.key}.text`}>{item.text}</T>
                  </p>
                  <MoreLink href={slotHref(content, `features.shelf.${item.key}.link`, item.href)} className="mt-3 min-h-[44px]">
                    <T k={`features.shelf.${item.key}.link`} words>
                      {item.link}
                    </T>
                  </MoreLink>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <nav aria-label={plainText(content, "features.jump.label", "On this page")} className="px-5 pb-4 sm:px-8">
        <ul className="mx-auto flex max-w-site flex-wrap justify-center gap-1.5">
          {jumps.map((jump) => (
            <li key={jump.key}>
              <TagLink href={jump.href}>
                {/* a link's whole name: falls back rather than leave a link with none */}
                {plainText(content, `features.jump.${jump.key}`, jump.name)}
              </TagLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* two of the maker's services, setup and care, before how it works */}
      <TemplateSplits T={T} content={content} />

      <div id="rows">
        <TemplateRows T={T} content={content} />
      </div>

      <MarketingSection labelledBy="features-tabs-title" className="pt-0 sm:pt-0">
        <SectionHead id="features-tabs-title" align="center" size="section" title={<T k="features.tabs.title">four things it does</T>} />
        <div className="section-body">
          <FeatureTabs
            label={plainText(content, "features.tabs.label", "What it does")}
            tabs={[
              tab(
                "words",
                "words from notion",
                "Every slot a row, three states each.",
                <MiniTable
                  rows={[
                    { kind: "Site Copy", title: slotText(content, "features.tab.words.row.1", "hero.title"), on: true },
                    { kind: "Site Copy", title: slotText(content, "features.tab.words.row.2", "hero.lede"), on: true },
                    { kind: "Site Copy", title: slotText(content, "features.tab.words.row.3", "footer.blurb"), on: false },
                  ]}
                />,
              ),
              tab("pages", "pages and posts", "Written in Notion, laid out as Notion lays them out.", <MiniBrowser host={slotText(content, "features.tab.pages.host", "your-site.example/blog")} />),
              tab(
                "shop",
                "shop and pricing",
                "Products, plans and a cart, from rows.",
                <MiniPricing
                  plans={[
                    { name: slotText(content, "features.tab.shop.plan.1", "drink"), price: slotText(content, "features.tab.shop.price.1", "£1") },
                    { name: slotText(content, "features.tab.shop.plan.2", "corn flakes"), price: slotText(content, "features.tab.shop.price.2", "£2.50"), on: true },
                  ]}
                />,
              ),
              tab(
                "mail",
                "email anywhere",
                "Eleven platforms, or a webhook.",
                <MiniForm
                  address={slotText(content, "features.tab.mail.address", "reader@example.com")}
                  button={slotText(content, "features.tab.mail.button", "Subscribe")}
                  note={slotText(content, "features.tab.mail.note", "Brevo · Resend · Mailchimp · a webhook")}
                />,
              ),
            ]}
          />
        </div>
      </MarketingSection>

      <TemplateTravel T={T} content={content} />

      <MarketingSection labelledBy="features-bento-title">
        <SectionHead id="features-bento-title" align="center" title={<T k="features.bento.title">and it behaves</T>} />
        <div className="section-body">
          <Bento
            items={[
              {
                key: "privacy",
                title: <T k="features.bento.privacy.title">private by construction</T>,
                text: <T k="features.bento.privacy.text">A reader&apos;s browser talks to your site and nobody else.</T>,
                art: (
                  <MiniShield
                    value={slotText(content, "features.bento.privacy.value", "0")}
                    caption={slotText(content, "features.bento.privacy.caption", "third-party requests from a reader's browser")}
                  />
                ),
                href: "/security",
                more: <T k="features.bento.privacy.more">How</T>,
              },
              {
                key: "publishing",
                title: <T k="features.bento.publishing.title">scheduled, not rushed</T>,
                text: <T k="features.bento.publishing.text">Date a post for next Tuesday at 4pm, tick Published, and it waits for the minute.</T>,
                art: (
                  <MiniCalendar
                    days={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
                      day: slotText(content, `features.bento.publishing.day.${i + 1}`, day),
                      post: i === 4 ? slotText(content, "features.bento.publishing.post", "new post") : undefined,
                    }))}
                  />
                ),
              },
              {
                // one fact, one row: the reason every word is a row
                key: "once",
                title: <T k="features.bento.once.title">change it once</T>,
                text: (
                  <T k="features.bento.once.text">
                    A price, a portrait, a name: each lives in one row, and every place that shows it reads that row. Change a plan&apos;s price in Notion and the pricing page, the homepage, the comparison table and what search engines and assistants read all follow, with nothing to hunt down.
                  </T>
                ),
                art: (
                  <MiniFanout
                    source={slotText(content, "features.bento.once.source", "Plan row, Price")}
                    value={slotText(content, "features.bento.once.value", "£12")}
                    places={["pricing", "home", "comparison", "llms", "search"].map((place, i) =>
                      slotText(content, `features.bento.once.place.${place}`, ["pricing page", "homepage", "comparison table", "llms.txt", "search data"][i]),
                    )}
                  />
                ),
              },
              {
                // what docs/accessibility.md holds the site to, in a card
                key: "access",
                title: <T k="features.bento.access.title">open to every reader</T>,
                text: (
                  <T k="features.bento.access.text">
                    WCAG 2.2 AA throughout, and AAA where a site can hold it: every page is checked in all four looks, at three widths.
                  </T>
                ),
                art: (
                  <MiniAccess
                    value={slotText(content, "features.bento.access.value", "7:1")}
                    caption={slotText(content, "features.bento.access.caption", "contrast for running text, in every look")}
                    checks={["keyboard", "reader", "motion", "targets"].map((check, i) =>
                      slotText(content, `features.bento.access.check.${check}`, ["every control by keyboard", "named for screen readers", "still when asked", "44px targets"][i]),
                    )}
                  />
                ),
              },
            ]}
          />
        </div>
      </MarketingSection>

      <TemplateStates T={T} content={content} />

      <TemplateFacts T={T} content={content} logos={logos} />

      {/* the full list has a page of its own (/resources/ingredients): here,
          its groups as chips that go straight to each, and the way in */}
      <Frame className="arrive pb-6 pt-16">
        <h2 id="ingredients" className="title-slab text-head-l">
          <T k="features.list.title">the full list of ingredients</T>
        </h2>
        <p className="mt-3 max-w-[620px] text-lead leading-relaxed text-ink">
          <T k="features.list.lede">Ten groups, every one written out, with what is not included. It is a long list, so it has a page of its own.</T>
        </p>
        <IngredientChips T={T} content={content} base={INGREDIENTS_PATH} />
        <ButtonRow className="mt-8">
          <ButtonLink href={INGREDIENTS_PATH}>
            <T k="features.list.all">Read the full list</T>
          </ButtonLink>
          <ButtonLink href={getHref} tone="secondary">
            <T k="features.cta.get">Get it free</T>
          </ButtonLink>
          {everyBlock ? (
            <ButtonLink href="/every-block" tone="secondary">
              <T k="features.cta.blocks">See every block</T>
            </ButtonLink>
          ) : null}
          {/* the 404 is a page too, and worth a look (lib/nav.ts) */}
          <ButtonLink href={NOT_FOUND_LINKS.notFound} tone="secondary" rel="nofollow">
            <T k="features.cta.notfound">See the 404</T>
          </ButtonLink>
        </ButtonRow>
      </Frame>

      <DeploySteps T={T} content={content} />

      {questions.length ? (
        <MarketingSection id="template-questions" labelledBy="template-questions-title" size="text">
          <SectionHead id="template-questions-title" size="section" title={<T k="features.questions.title">questions about the template</T>} />
          <div className="section-body">
            <Faq items={questions} />
          </div>
        </MarketingSection>
      ) : null}

      {REPO_URL ? (
        <MarketingSection labelledBy="star-title" className="pt-0 text-center sm:pt-0">
          <SectionHead id="star-title" align="center" size="section" title={<T k="features.star.title">like it? star it</T>} lede={<T k="features.star.lede">Stars cost nothing and help the next person find it.</T>} />
          <ButtonRow className="mt-6 justify-center">
            <ButtonLink href={REPO_URL} tone="secondary">
              <T k="features.star.cta">Star it on GitHub</T>
            </ButtonLink>
          </ButtonRow>
        </MarketingSection>
      ) : null}

      {/* the maker's counter, placed here rather than above the footer
          (app/layout.tsx leaves it out on this page), with every service set
          out in full under it */}
      <ServiceCounter T={T} content={content} here />
      <TemplateServices T={T} content={content} />
    </>
  )
}
