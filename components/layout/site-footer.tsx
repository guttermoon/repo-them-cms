import Link from "next/link"

import { CookieSettingsLink } from "@/components/layout/cookie-settings-link"
import { NewsletterForm } from "@/components/layout/newsletter-form"
import { makeT, pickCopy, plainText, siteDescriptor, siteName, slotHidden, type SiteCopy } from "@/components/system/notion-text"
import { Label, SiteMark, Stripe, Wordmark } from "@/components/ui/label"
import { makerTitle } from "@/components/sections/service-counter"
import { ThemeSelect } from "@/components/ui/theme-switch"
import { siteMenus, type FooterColumn } from "@/lib/menus"
import type { SiteLogo } from "@/lib/share"
import { MAKER, REPO_URL, TEMPLATE_NAME } from "@/lib/site"
import { outsideLink } from "@/lib/outside"

/**
 * The foot of every page: the mailing list, the contents, the maker's
 * credit, and the back of the tin (the small print, the "Made for Notion"
 * badge and Notion's attribution).
 *
 * The badge follows Notion's brand guidelines: the official file from
 * Notion's own zip, unaltered (public/brand/), shown once per page, in a
 * secondary position, 48px tall (their minimum on screen), never angled or
 * animated. tests/brand.test.mjs holds it to that.
 */
export function SiteFooter({
  content,
  columns = siteMenus().footer,
  cookies,
  emailReady = true,
  logo,
}: {
  content: SiteCopy
  /** the three columns of links, as Notion's Menu rows make them
   *  (lib/menus.ts): a designed page's words are its `nav.<page>` slot, a
   *  Notion page's its title. With none, as designed. */
  columns?: FooterColumn[]
  /** the cookie question is asked (lib/analytics-config.ts asksCookies),
   *  so "Cookie settings" can ask it again */
  cookies: boolean
  /** the site's own logo from Notion, drawn where the mark stands */
  logo?: SiteLogo
  /** whether an email platform is set; until then the mailing list is a placeholder */
  emailReady?: boolean
}) {
  const T = makeT(content)
  const year = new Date().getFullYear()
  // the site's name, and whether a copy has renamed it from the template's
  // (the credit then names the template separately)
  const name = siteName(content)
  const renamed = name.trim().toLowerCase() !== TEMPLATE_NAME.toLowerCase()
  const linkClass = "inline-flex min-h-target min-w-target items-center text-ui text-sub tone hover:text-ink"

  return (
    <footer className="mt-12 bg-page">
      <Stripe size="md" />
      <div className="mx-auto w-full max-w-site px-5 py-12 sm:px-8">
        {/* a hidden `newsletter.title` (blank, unticked, or no row once connected) takes the mailing list away */}
        {slotHidden(content, "newsletter.title") ? null : (
        <section aria-labelledby="newsletter-title" className="grid gap-5 rounded-panel bg-panel p-6 sm:p-8 md:grid-cols-[1fr_1.3fr] md:items-center">
          <div>
            <h2 id="newsletter-title" className="title-slab flex flex-wrap items-center gap-x-3 text-head-m">
              <T k="newsletter.title">mailing list</T>
              {!emailReady ? (
                <span className="rounded-full border border-line-strong px-2.5 py-0.5 font-sans text-fine font-semibold uppercase tracking-[0.06em] text-sub">
                  <T k="newsletter.example">example</T>
                </span>
              ) : null}
            </h2>
            <p className="mt-2 text-ui leading-relaxed text-sub">
              <T k="newsletter.body">Occasional emails about new things on the shelf. Generic ones. Unsubscribe any time.</T>
            </p>
          </div>
          <NewsletterForm content={pickCopy(content, "newsletter.")} ready={emailReady} />
        </section>
        )}

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr]">
          <div>
            <Link href="/" className="inline-flex min-h-target items-center gap-2.5 rounded-text">
              {/* the site's own logo carries its name, as most do; the mark
                  is followed by the name in words */}
              <SiteMark logo={logo} className="h-9 w-9" />
              {logo ? <span className="sr-only">{siteName(content)}</span> : <Wordmark className="text-head-s leading-none">{siteName(content)}</Wordmark>}
              <span className="sr-only">, {plainText(content, "nav.home", "home")}</span>
            </Link>
            <p className="mt-2 text-small text-sub">{siteDescriptor(content)}</p>
            <p className="mt-4 max-w-xs text-ui leading-relaxed text-ink">
              <T k="footer.blurb">Plain products, plain prices and plain words. Nothing else in the tin.</T>
            </p>
          </div>

          {/* a column its rows have emptied goes, heading and all, unless
              Cookie settings is still in it */}
          {columns.filter((column) => column.links.length || (column.key === "help" && cookies)).map((column) => (
            <nav key={column.key} aria-labelledby={`footer-${column.key}`}>
              <Label as="h2" id={`footer-${column.key}`} className="text-ui">
                <T k={`footer.col.${column.key}`}>{column.heading}</T>
              </Label>
              <ul className="mt-3 space-y-1.5">
                {column.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={linkClass}>
                      {item.key ? <T k={item.key}>{item.name}</T> : item.name}
                    </Link>
                  </li>
                ))}
                {column.key === "help" && cookies ? (
                  <li>
                    <CookieSettingsLink className={`${linkClass} text-left`} label={plainText(content, "footer.cookies", "Cookie settings")} />
                  </li>
                ) : null}
              </ul>
            </nav>
          ))}

          <div>
            <Label as="h2" className="text-ui">
              <T k="footer.maker.title">made by</T>
            </Label>
            <p className="mt-3 text-ui leading-relaxed text-ink">
              <a href={MAKER.url} className="n-link font-semibold" title={makerTitle(content)} {...outsideLink(MAKER.url)}>
                {MAKER.name}
              </a>
              . <T k="footer.maker.body">Setup help and custom builds, if you would rather not.</T>
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <a href={`mailto:${MAKER.email}?subject=${encodeURIComponent(`Help setting up ${TEMPLATE_NAME}`)}`} className={linkClass}>
                  {MAKER.email}
                </a>
              </li>
              <li>
                <Link href="/features#services" className={linkClass}>
                  <T k="footer.maker.services">See the services</T>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <p className="small-print max-w-measure">
              <T k="footer.smallprint">
                Net contents: 1 website. Ingredients: Notion, Next.js, words. Contains no artificial trackers until you add one. Keep in a cool, dry database.
              </T>
            </p>
            {/* Notion's required wording: not a Notion slot, so it cannot be blanked */}
            <p className="max-w-measure text-fine leading-relaxed text-sub">
              {TEMPLATE_NAME} is an independent template, not made, endorsed or maintained by Notion Labs, Inc. Notion and the Notion logo are
              trademarks of Notion Labs, Inc., and are used here with permission.
            </p>
            {/* The copyright and the template's credit: "© 2026 REPO THEM a
                GitHub template by Denot", GitHub linked to the template's
                repository and Denot to the maker's site. A copy renamed in
                Notion (`site.name`) keeps its own name first: "© 2026 Acme.
                Built on REPO THEM a GitHub template by Denot". Not a Notion
                slot, so a copy's owner cannot blank it from the database. The
                code is MIT, so a copy can still take it out; README asks it to
                keep it. */}
            <p className="text-fine text-sub" data-credit="template">
              © {year} {name}
              {renamed ? <>. Built on {TEMPLATE_NAME}</> : null} a{" "}
              {REPO_URL ? (
                <a href={REPO_URL} className="n-link" {...outsideLink(REPO_URL)}>
                  GitHub
                </a>
              ) : (
                "GitHub"
              )}{" "}
              template by{" "}
              <a href={MAKER.url} className="n-link" title={MAKER.name} {...outsideLink(MAKER.url)}>
                {MAKER.studio}
              </a>
              . <T k="footer.license">Free to fork under the MIT licence.</T>
            </p>
            <div className="pt-1">
              <ThemeSelect
                label={plainText(content, "footer.theme", "Appearance")}
                names={{
                  system: plainText(content, "footer.theme.system", "System"),
                  light: plainText(content, "footer.theme.light", "Light"),
                  dark: plainText(content, "footer.theme.dark", "Dark"),
                  mono: plainText(content, "footer.theme.mono", "Mono"),
                  rainbow: plainText(content, "footer.theme.rainbow", "Rainbow"),
                }}
              />
            </div>
          </div>
          {/* The official badge, unaltered, once per page, in a secondary place.
              Notion supplies it in black and in white; the one that suits the
              look's ground shows (white on dark, black on the light, mono and
              rainbow pages), the other is display:none. Mono's grey filter
              on pictures leaves it alone (app/globals.css). */}
          <a href="https://www.notion.com/" {...outsideLink("https://www.notion.com/")} className="shrink-0 self-start" data-badge="made-for-notion">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/made-for-notion-black.svg" alt="Made for Notion" width={106} height={48} className="h-12 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/made-for-notion-white.svg" alt="Made for Notion" width={106} height={48} className="hidden h-12 w-auto dark:block" />
          </a>
        </div>
      </div>
    </footer>
  )
}
