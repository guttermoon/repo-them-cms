import { Pack } from "@/components/illustrations/pack"
import { ComparisonTable, Faq, FinalCta, MarketingSection, MoreLink, PricingPlans, QuoteCard, SectionHead, StatCards, TrustFacts } from "@/components/sections/marketing"
import { PersonCard } from "@/components/sections/person-card"
import { sitePlans } from "@/components/sections/plans"
import { ServicePromises } from "@/components/sections/template/services"
import { JsonLd } from "@/components/system/json-ld"
import { LinkedText } from "@/components/system/linked-text"
import { plainText, slotText } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { mediaUrl } from "@/lib/content/media"
import { liveQuestions, livePeople, liveProducts, quoteFor } from "@/lib/content/select"
import { NOT_FOUND_LINKS } from "@/lib/nav"
import type { Entry, SiteData } from "@/lib/notion/rows"
import { PRICING_FOOTNOTE } from "@/lib/plans"
import { comparison, formatPrice, priceFor } from "@/lib/pricing"
import type { SectionKey } from "@/lib/sections"
import { MAKER, REPO_URL } from "@/lib/site"
import { teamLd } from "@/lib/structured-data"
import type { SectionDraw } from "./context"
import { quoteView } from "./quote"

/** The questions about money (Category Pricing), which pricing.faq shows. */
export const pricingQuestions = (data: SiteData) => liveQuestions(data, "Pricing")

/** Every question but those about the template itself, which /features
 *  asks: what questions.list shows. */
export const listedQuestions = (data: SiteData) => liveQuestions(data).filter((row) => row.category?.name.toLowerCase() !== "template")

/** Question rows under their Category, in the order the categories first
 *  appear; uncategorised ones last. */
function byGroup(rows: Entry[]): { name: string; rows: Entry[] }[] {
  const groups: { name: string; rows: Entry[] }[] = []
  for (const row of rows) {
    const name = row.category?.name ?? ""
    const found = groups.find((g) => g.name === name)
    if (found) found.rows.push(row)
    else groups.push({ name, rows: [row] })
  }
  return groups.sort((a, b) => (a.name === "" ? 1 : b.name === "" ? -1 : 0))
}

/**
 * What is true of the code, each held by a test (docs/privacy-and-security.md
 * lists which).
 */
const SECURITY_FACTS = [
  { key: "browser", title: "no third parties in the browser", text: "Fonts, pictures, files and analytics come from this site. A video loads from YouTube or Vimeo only when somebody presses play." },
  { key: "csp", title: "a strict content policy", text: "The browser is told to load scripts, styles and fonts from this site only, to frame nothing but the two video players, and to post forms nowhere else." },
  { key: "media", title: "signed pictures", text: "Pictures from Notion are served through signed addresses, so nothing else can be fetched through this site, and addresses inside its own network are refused." },
  { key: "limits", title: "rate limits", text: "Both forms, and every route that passes a request on to another service, take only so many requests a minute from one address." },
  { key: "secrets", title: "no secrets in the code", text: "Every key, token and ID is set per deployment. The code holds none, so a fork leaks nothing." },
  { key: "honeypot", title: "honeypots, not puzzles", text: "Forms catch bots with a field no person sees, never a CAPTCHA that follows readers around." },
  { key: "keep", title: "nothing kept here", text: "The site has no database of its own. Sign-ups go to the email platform, messages to an inbox." },
  { key: "notion", title: "read-only notion", text: "The site only reads from Notion, so its integration needs no permission to change anything." },
  { key: "analytics", title: "analytics after a yes", text: "Analytics starts only after a reader agrees, and goes through this site with IP addresses shortened." },
]

/**
 * The sections of /pricing, /about, /team, /security and /questions, below
 * each page's hero (lib/sections.ts).
 */
export const PAGE_SECTIONS = {
  // the plans, their switch and a quotation. Plans are Plan rows and nothing
  // else: with none, it says so and how to add one
  "pricing.plans": ({ T, content, data, id, first }) => {
    const plans = sitePlans(data)
    const custom = slotText(content, "pricing.custom", "custom pricing")
    // with two quotations, the homepage shows the first and this the next
    const quote = quoteFor(data, "pricing")
    const title = id("plans-title")
    return (
      <section aria-labelledby={title} className={first ? "pb-12" : "py-16 sm:py-24"}>
        <div className="mx-auto w-full max-w-site px-5 sm:px-8">
          {/* the plans' own headings are h3s: this h2 is what they sit under */}
          <h2 id={title} className="sr-only">
            {plainText(content, "pricing.plans.label", "Plans")}
          </h2>
          {plans.length ? (
            <>
              <PricingPlans
                plans={plans}
                labels={{
                  billing: plainText(content, "pricing.billing", "Billing"),
                  // each is a radio button's whole name: falls back rather than leave it unnamed
                  monthly: plainText(content, "pricing.monthly", "Pay monthly"),
                  yearly: plainText(content, "pricing.yearly", "Pay yearly"),
                  saveBefore: <T k="pricing.save.before">Save up to</T>,
                  saveAfter: <T k="pricing.save.after">with yearly</T>,
                  recommended: <T k="pricing.recommended">recommended</T>,
                  custom,
                  includes: <T k="pricing.includes">includes</T>,
                }}
                footnote={<T k="pricing.footnote">{PRICING_FOOTNOTE}</T>}
              />
              {/* there is no small print, and the link proves it (lib/nav.ts) */}
              <ButtonRow className="mt-4 justify-center">
                <ButtonLink href={NOT_FOUND_LINKS.smallPrint} tone="outline" rel="nofollow">
                  <T k="pricing.smallprint">Read the small print</T>
                </ButtonLink>
              </ButtonRow>
            </>
          ) : (
            <Callout icon={<Icon name="receipt" />}>
              <T k="pricing.empty">
                No plans yet. In the Notion database, add a row, set Kind to Plan, give it a Price and its features in Text, and tick Published. It appears here within a
                minute.
              </T>
            </Callout>
          )}
          {quote ? (
            <div className="mt-14">
              <QuoteCard {...quoteView(quote)} />
            </div>
          ) : null}
        </div>
      </section>
    )
  },

  // plans with no lines to compare have no table, and so no heading over one
  "pricing.compare": ({ T, content, data, id, tone }) => {
    const plans = sitePlans(data)
    const compared = comparison(plans)
    if (!compared.length) return null
    const custom = slotText(content, "pricing.custom", "custom pricing")
    const title = id("compare-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <SectionHead id={title} size="section" title={<T k="pricing.compare.title">plans and features</T>} />
        <div className="section-body">
          <ComparisonTable
            label={plainText(content, "pricing.compare.region", "Plans compared (scrolls sideways on a small screen)")}
            caption={plainText(content, "pricing.compare.caption", "Every plan, feature by feature")}
            plans={plans.map((plan) => {
              const amount = priceFor(plan, "monthly")
              return { key: plan.key, name: plan.name, price: amount === undefined ? custom : formatPrice(amount, plan.currency), cta: plan.cta }
            })}
            groups={compared}
            labels={{
              yes: plainText(content, "pricing.compare.yes", "Included"),
              no: plainText(content, "pricing.compare.no", "Not included"),
              feature: plainText(content, "pricing.compare.feature", "Feature"),
            }}
          />
        </div>
      </MarketingSection>
    )
  },

  "pricing.promises": ({ T, id, tone }) => <ServicePromises T={T} titleId={id("services-trust-title")} tone={tone} />,

  "pricing.faq": ({ T, data, id, tone }) => {
    const items = pricingQuestions(data).map((row) => ({ key: row.id, question: row.title, answer: <LinkedText text={row.text ?? ""} /> }))
    if (!items.length) return null
    const title = id("faq-title")
    return (
      <MarketingSection labelledBy={title} tone={tone} size="text">
        <SectionHead id={title} size="section" title={<T k="pricing.faq.title">questions and answers</T>} />
        <div className="section-body">
          <Faq items={items} />
        </div>
        <ButtonRow className="mt-8">
          <ButtonLink href="/questions" tone="outline">
            <T k="pricing.faq.more">Every question</T>
          </ButtonLink>
        </ButtonRow>
      </MarketingSection>
    )
  },

  "pricing.final": ({ T, id }) => (
    <FinalCta
      titleId={id("final-title")}
      title={<T k="pricing.final.title">not sure which?</T>}
      lede={<T k="pricing.final.lede">Say what you need in a sentence or two and get a straight answer from a person.</T>}
      actions={
        <ButtonRow className="justify-center">
          <ButtonLink href="/contact?type=question">
            <T k="pricing.final.ask">Ask a question</T>
          </ButtonLink>
          <ButtonLink href="/questions" tone="secondary">
            <T k="pricing.final.questions">Every question</T>
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),

  "about.story": ({ T, id, tone }) => {
    const title = id("story-title")
    return (
      <MarketingSection labelledBy={title} tone={tone} size="text">
        <SectionHead id={title} size="section" eyebrow={<T k="about.story.label">the story so far</T>} title={<T k="about.story.title">one product, one plain label</T>} />
        <div className="mt-6 space-y-4 text-lead leading-relaxed text-ink">
          <p>
            <T k="about.story.1">
              It started with one product and a plain label. People bought it because they could read it: what was in it, what it cost, and what to do if it went wrong.
            </T>
          </p>
          <p>
            <T k="about.story.2">We have added a few more since, and a plan or two for people who come back. The labels are still plain. The prices are still on the front.</T>
          </p>
        </div>
      </MarketingSection>
    )
  },

  // on the panel's tint between the story and the team, so no two sections run together
  "about.numbers": ({ T, data, id, tone }) => {
    const title = id("numbers-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <SectionHead id={title} size="section" align="center" title={<T k="about.numbers.title">by the numbers</T>} />
        <div className="section-body">
          <StatCards
            band
            items={[
              { key: "products", value: String(liveProducts(data).length), label: <T k="about.numbers.products">products on the shelf, each with its ingredients listed</T> },
              { key: "people", value: String(livePeople(data).length), label: <T k="about.numbers.people">people, every one of whom reads the email</T> },
              { key: "logos", value: <T k="about.numbers.logos.value">0</T>, label: <T k="about.numbers.logos">logos on the front of anything we sell</T> },
            ]}
          />
        </div>
      </MarketingSection>
    )
  },

  "about.team": ({ T, content, data, id, tone }) => {
    const people = livePeople(data)
    if (!people.length) return null
    const title = id("about-team-title")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead id={title} size="section" eyebrow={<T k="about.team.label">the team</T>} title={<T k="about.team.title">the people behind the shelf</T>} />
          <MoreLink href="/team">
            <T k="about.team.more">Meet everybody</T>
          </MoreLink>
        </div>
        <ul className="arrive-each section-body grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {people.slice(0, 3).map((person) => (
            <PersonCard key={person.id} person={person} heading="h3" profile={plainText(content, "team.profile", "Profile")} />
          ))}
        </ul>
      </MarketingSection>
    )
  },

  "about.final": ({ T, id }) => (
    <FinalCta
      titleId={id("final-title")}
      title={<T k="about.final.title">say hello</T>}
      lede={<T k="about.final.lede">Questions, orders, ideas and complaints all go to the same place, and a person reads every one.</T>}
      actions={
        <ButtonRow className="justify-center">
          <ButtonLink href="/contact">
            <T k="about.cta.contact">Get in touch</T>
          </ButtonLink>
          <ButtonLink href="/pricing" tone="secondary">
            <T k="about.final.plans">See the plans</T>
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),

  // everybody, and the people's structured data wherever they are shown
  "team.people": ({ T, content, data, tone, first }) => {
    const people = livePeople(data)
    return (
      <>
        {people.length ? (
          <JsonLd
            data={teamLd(
              people.map((person) => ({
                title: person.title,
                description: person.description,
                text: person.text,
                image: person.cover ? mediaUrl(person.cover, "portrait") : undefined,
                link: person.link,
              })),
            )}
          />
        ) : null}
        <MarketingSection tone={tone} className={first ? "pt-0 sm:pt-0" : ""}>
          {people.length ? (
            <ul className="arrive-each grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {people.map((person) => (
                <PersonCard key={person.id} person={person} profile={plainText(content, "team.profile", "Profile")} />
              ))}
            </ul>
          ) : (
            <Callout icon={<Icon name="users-three" />}>
              <T k="team.empty">Nobody here yet. In Notion, add a row with Kind set to Person: the name in Title, the role in Description, a line in Text and a portrait in Image. Tick Published.</T>
            </Callout>
          )}
        </MarketingSection>
      </>
    )
  },

  "team.final": ({ T, id }) => (
    <FinalCta
      titleId={id("final-title")}
      title={<T k="team.final.title">want to join?</T>}
      lede={<T k="team.final.lede">We are not hiring right now. When we are, it will say so here, in plain words.</T>}
      actions={
        <ButtonRow className="justify-center">
          <ButtonLink href="/contact">
            <T k="team.final.contact">Say hello anyway</T>
          </ButtonLink>
          <ButtonLink href="/about" tone="secondary">
            <T k="team.final.about">About us</T>
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),

  "security.facts": ({ T, id, tone }) => {
    const title = id("security-facts")
    return (
      <MarketingSection labelledBy={title} tone={tone}>
        <SectionHead id={title} size="section" title={<T k="security.facts.title">what is true of the code</T>} />
        <div className="section-body">
          <TrustFacts
            items={SECURITY_FACTS.map((fact) => ({
              key: fact.key,
              title: <T k={`security.${fact.key}.title`}>{fact.title}</T>,
              text: <T k={`security.${fact.key}.text`}>{fact.text}</T>,
            }))}
          />
        </div>
      </MarketingSection>
    )
  },

  "security.report": ({ T, id }) => (
    <FinalCta
      titleId={id("security-report")}
      title={<T k="security.report.title">found a problem?</T>}
      lede={<T k="security.report.lede">Please say so privately, not in a public issue, so it can be fixed before anybody else finds it.</T>}
      actions={
        <ButtonRow className="justify-center">
          <ButtonLink href="/contact?type=problem">
            <T k="security.report.contact">Report it privately</T>
          </ButtonLink>
          {REPO_URL ? (
            <ButtonLink href={`${REPO_URL}/security/policy`} tone="secondary">
              <T k="security.report.policy">The security policy</T>
            </ButtonLink>
          ) : null}
          <ButtonLink href="/privacy" tone="secondary">
            <T k="security.report.privacy">The privacy notice</T>
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),

  // the Question rows, under their categories. No rows, no questions: it
  // says so and how to add one
  "questions.list": ({ T, data, id, tone }) => {
    const groups = byGroup(listedQuestions(data))
    if (!groups.length) {
      return (
        <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8">
          <Callout icon={<Icon name="chat-circle" />}>
            <T k="questions.empty">
              No questions yet. In the Notion database, add a row, set Kind to Question, put the question in Title and the answer in Text, and tick Published. It
              appears here within a minute.
            </T>
          </Callout>
        </div>
      )
    }
    return (
      <>
        {groups.map((group, n) => {
          const title = id(`q-g${n}`)
          return (
            <MarketingSection key={n} labelledBy={title} tone={tone} size="text" className="py-8 sm:py-10">
              <SectionHead id={title} size="section" title={group.name || <T k="questions.other">Other questions</T>} />
              <div className="group-body">
                <Faq items={group.rows.map((row) => ({ key: row.id, question: row.title, answer: <LinkedText text={row.text ?? ""} /> }))} />
              </div>
            </MarketingSection>
          )
        })}
      </>
    )
  },

  "questions.more": ({ T, id }) => (
    <FinalCta
      titleId={id("questions-more")}
      title={<T k="questions.more.title">still not answered?</T>}
      lede={<T k="questions.more.body">Ask, and the answer may end up on this page.</T>}
      actions={
        <ButtonRow className="justify-center">
          <ButtonLink href="/contact">
            <T k="questions.more.button">Get in touch</T>
          </ButtonLink>
          <ButtonLink href={`mailto:${MAKER.email}`} tone="secondary">
            {MAKER.email}
          </ButtonLink>
        </ButtonRow>
      }
    />
  ),
} satisfies Partial<Record<SectionKey, SectionDraw>>
