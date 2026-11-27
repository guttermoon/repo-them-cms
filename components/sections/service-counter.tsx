import { fillIn, plainText, type SiteCopy, siteName, slotHidden, type T } from "@/components/system/notion-text"
import { Icon } from "@/components/ui/icon"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { MAKER, MAKER_HOST, REPO_URL, SITE_URL } from "@/lib/site"

import { MarketingSection, MoreLink, SectionHead } from "./marketing"
import { outsideLink } from "@/lib/outside"

/**
 * The service counter: help from the person who made the template, above
 * the footer on every page. /features#services sets the same offers out at
 * length. A fork that would rather not carry it publishes `service.title`
 * blank, and it is gone from every page.
 *
 * Every word is a Notion slot (`service.*`), so each offer can be reworded,
 * or hidden with a blank published row, without touching code. The
 * addresses are code: the email and the site are the maker's (lib/site.ts),
 * each email pre-filled with a subject that says which offer it is about
 * (`service.<key>.subject`).
 */
export const mail = (subject: string, site: string) => `mailto:${MAKER.email}?subject=${encodeURIComponent(`${subject} (${site})`)}`

/** An offer: a page of the site (`href`), or an email to the maker. */
export type Offer = { key: string; label: string; title: string; body: string; cta: string; subject?: string; href?: string }

/** Where an offer's button goes: its page, or an email whose subject names it. */
export function offerHref(content: SiteCopy, offer: Offer): string {
  return offer.href ?? mail(plainText(content, `service.${offer.key}.subject`, offer.subject ?? offer.label), siteName(content))
}

/** The note on a link to the maker's site, naming what they do. */
export const makerTitle = (content: SiteCopy) => fillIn(plainText(content, "maker.link.title", "Notion website setup and custom builds by {name}"), { name: MAKER.name })

/** The maker's address with a plain hello for a subject. */
export const helloHref = (content: SiteCopy) => mail(plainText(content, "service.hello.subject", "Hello"), siteName(content))

export const OFFERS: Offer[] = [
  {
    key: "setup",
    label: "Setup help",
    title: "Want it set up for you?",
    body: "Your Notion database, your integration, your deploy and your domain, connected for you. You get a site that works and a login to write in.",
    cta: "Email for setup help",
    subject: "Setup help",
  },
  {
    key: "build",
    label: "Done for you",
    title: "Want your site made for you?",
    body: "A website made to order, written in Notion and built by the person who built this one. Your words, your look, your address.",
    cta: "See the work",
    href: MAKER.url,
  },
  {
    key: "design",
    label: "Your brand, not ours",
    title: "Generic is a look. So is yours.",
    body: "The template is plain on purpose. A custom design swaps the tin for your brand, and every word stays editable in Notion.",
    cta: "Ask about design",
    subject: "Custom design",
  },
  {
    key: "move",
    label: "Moving in",
    title: "Already have a site?",
    body: "Pages and posts moved from wherever they live now into Notion, with the old addresses redirected so nothing breaks.",
    cta: "Ask about moving",
    subject: "Moving a site",
  },
  {
    key: "care",
    label: "Care plan",
    title: "Updates and fixes, monthly.",
    body: "Dependency updates, changes to the Notion API, and small edits handled for you, so the site keeps working while you write.",
    cta: "Ask about care",
    subject: "Care plan",
  },
  {
    key: "training",
    label: "Team training",
    title: "Teach the team to publish.",
    body: "One session on running the site from Notion: copy, pages, posts, scheduling, and which buttons to leave alone.",
    cta: "Ask about training",
    subject: "Team training",
  },
]

/**
 * Where the share card's links go: each platform's own way to start a post
 * (an address, not a script, so nobody is tracked), opened with words
 * written for it. Every word is a slot: the link's name
 * (`service.share.<platform>`, published blank to take the link away) and
 * the post (`service.share.<platform>.post`, the email's subject and body),
 * with `{site}` for the site's name and `{url}` for its address. A post
 * whose row leaves out `{url}` still carries the address, at its end.
 *
 * - Bluesky and X take the words in their own compose links.
 * - LinkedIn's documented link takes an address alone; its composer link
 *   (feed/?shareActive=true&text=) takes the words, and is the one used.
 *   LinkedIn has not documented it: it fills the post on a computer, and a
 *   phone may open the feed without it.
 * - Email opens the reader's own mail with a subject and a short note.
 */
export function shareLinks(content: SiteCopy): { key: string; name: string; href: string }[] {
  const site = siteName(content)
  const words = (key: string, fallback: string) => fillIn(plainText(content, `service.share.${key}`, fallback), { site, url: SITE_URL })
  // the address goes in the words where a platform has nowhere else for it
  const withUrl = (text: string) => (text.includes(SITE_URL) ? text : `${text} ${SITE_URL}`.trim())
  const enc = encodeURIComponent
  const x = words("x.post", "Suppose you're thinking about a new website. Suddenly someone'll say 'how about a Notion-powered CMS for free' out of the blue. It's all part of a cosmic unconsciousness.\n\n{site}: a free GitHub template → Notion as a CMS")
  const links = [
    {
      key: "bluesky",
      name: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${enc(withUrl(words("bluesky.post", "Suppose you're thinking about a new website. Suddenly someone'll say 'how about a Notion-powered CMS for free' out of the blue. It's all part of a cosmic unconsciousness.\n\n{site}: a free GitHub template → Notion as a CMS\n\n{url}")))}`,
    },
    {
      key: "linkedin",
      name: "LinkedIn",
      href: `https://www.linkedin.com/feed/?shareActive=true&text=${enc(
        withUrl(
          words(
            "linkedin.post",
            "Suppose you're thinking about a new website. Suddenly someone'll say 'how about a Notion-powered CMS for free' out of the blue, no explanation. No point in looking for one, either. It's all part of a cosmic unconsciousness.\n\n{site}. A GitHub repo template where all website copy and blog posts can be managed in Notion. It's a free template under the MIT licence, and it deploys on Vercel in five steps.\n\n{url}",
          ),
        ),
      )}`,
    },
    // X takes the address on its own, and counts it short
    { key: "x", name: "X", href: x.includes(SITE_URL) ? `https://x.com/intent/post?text=${enc(x)}` : `https://x.com/intent/post?text=${enc(x)}&url=${enc(SITE_URL)}` },
    {
      key: "email",
      name: "Email",
      href: `mailto:?subject=${enc(words("email.subject", "How about a Notion-powered CMS for free"))}&body=${enc(
        withUrl(words("email.body", "Suppose you're thinking about a new website. Suddenly someone'll say 'how about a Notion-powered CMS for free' out of the blue, no explanation. No point in looking for one, either. It's all part of a cosmic unconsciousness.\n\n{site}. A GitHub repo template where all website copy and blog posts can be managed in Notion. It's a free template under the MIT licence, and it deploys on Vercel in five steps.\n\n{url}")).replace(/\r?\n/g, "\r\n"),
      )}`,
    },
  ]
  return links.filter((link) => !slotHidden(content, `service.share.${link.key}`))
}

/** `here`: the counter is on /features itself, the page its "how this
 *  template works" link leads to, so that link is left out. */
export function ServiceCounter({ T, content, here = false }: { T: T; content: SiteCopy; here?: boolean }) {
  // a row left blank or unticked, or none once Notion is connected, takes the whole counter away
  if (slotHidden(content, "service.title")) return null
  const shareLink = "n-link inline-flex min-h-target min-w-target items-center justify-center"
  const shares = shareLinks(content)
  return (
    <MarketingSection id="service" labelledBy="service-title" tone="panel" className="!py-12 sm:!py-16">
      <SectionHead id="service-title" size="section" eyebrow={<T k="service.label">service counter</T>} title={<T k="service.title">would rather not do it yourself?</T>} />
      {/* the heading spans both columns, so the cards on the right start level
          with the words on the left; the two columns are one height, so the
          right one's cards end level with the "made by" card, sharing what
          room is left between them */}
      <div data-follows-head="its lede, with the cards beside it" className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-stretch">
        <div className="appear flex flex-col">
          <p className="max-w-[680px] text-lead leading-relaxed text-ink sm:text-head-s">
            <T k="service.lead">This site is a live demo of a free template. If you would like one of your own, set up for you or made to order, the person who made it is available.</T>
          </p>
          <div className="mt-6 flex-1 rounded-card bg-card p-6">
            <p className="eyebrow text-ui">
              <T k="service.maker.label">made by</T>
            </p>
            <p className="title-slab mt-2 text-head-s">
              <a href={MAKER.url} className="inline-flex min-h-target items-center hover:underline" title={makerTitle(content)} {...outsideLink(MAKER.url)}>
                {MAKER.name}
              </a>
            </p>
            <p className="mt-2 max-w-2xl text-body leading-relaxed text-ink">
              <T k="service.maker.body">
                Megan Aileen Williams made REPO THEM and builds websites to order, including ones that run on Notion. For setup help or a site made
                for you, write to the address below or visit denot.app.
              </T>
            </p>
            <ButtonRow className="mt-5">
              <ButtonLink href={helloHref(content)} tone="accent">
                {MAKER.email}
              </ButtonLink>
              <ButtonLink href={MAKER.url} tone="secondary">
                {MAKER_HOST}
              </ButtonLink>
            </ButtonRow>
          </div>
        </div>
        <div className="appear flex flex-col gap-4">
          {REPO_URL ? (
            <div className="flex-1 rounded-card bg-card p-6">
              {slotHidden(content, "service.star.label") ? null : (
                <p className="eyebrow flex items-center gap-1.5 text-ui">
                  <Icon name="star" className="text-accent" />
                  <T k="service.star.label">star the repo</T>
                </p>
              )}
              <p className="mt-2 text-ui text-ink">
                <T k="service.star.body">Stars cost nothing. They help the next person find it, and they make the maker unreasonably happy.</T>
              </p>
              <ButtonRow className="mt-4">
                <ButtonLink href={REPO_URL} tone="secondary">
                  <T k="service.star.cta">Star it on GitHub</T>
                </ButtonLink>
              </ButtonRow>
            </div>
          ) : null}
          <div className="flex-1 rounded-card bg-card p-6">
            <p className="eyebrow text-ui">
              <T k="service.share.label">share it</T>
            </p>
            <p className="mt-2 text-ui text-ink">
              <T k="service.share.body">Know somebody who writes in Notion and wants a website? Plain links, no share buttons tracking anybody.</T>
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ui">
              {shares.map((link) => (
                <li key={link.key}>
                  <a className={shareLink} href={link.href} {...outsideLink(link.href)}>
                    <T k={`service.share.${link.key}`}>{link.name}</T>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {/* below both columns, so it never holds the left one taller than the right */}
      {here ? null : (
        <MoreLink href="/features" className="mt-6">
          <T k="service.more">How this template works</T>
        </MoreLink>
      )}
    </MarketingSection>
  )
}
