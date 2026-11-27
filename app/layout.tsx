import type React from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { FONT_VARIABLES } from "./fonts"
import { CartProvider } from "@/components/commerce/cart-context"
import { CookieNotice } from "@/components/layout/cookie-notice"
import { Feedback } from "@/components/layout/feedback"
import { GoogleAnalytics } from "@/components/layout/google-analytics"
import { PostHogAnalytics } from "@/components/layout/posthog-analytics"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SkipLink } from "@/components/layout/skip-link"
import { ServiceCounter } from "@/components/sections/service-counter"
import { JsonLd } from "@/components/system/json-ld"
import { ExceptOn } from "@/components/system/except-on"
import { makeT, pickCopy, siteName, slotHref } from "@/components/system/notion-text"
import { Icon } from "@/components/ui/icon"
import { themeIcons } from "@/components/ui/theme-icons"
import { ANALYTICS_ON, asksCookies, cookieShape, GA_ON, POSTHOG_ON } from "@/lib/analytics-config"
import { commerce, headerCart } from "@/lib/commerce/config"
import { liveProducts, menusFor } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { listReady } from "@/lib/email"
import { FEED_LINK, siteVerification } from "@/lib/seo"
import { iconLinks, siteIcon, siteLogo } from "@/lib/share"
import { PointerLight } from "@/components/system/pointer-light"
import { pageWords } from "@/lib/page-meta"
import { MAKER, REPO_URL, SITE_LANGUAGE, SITE_LOCALE, SITE_URL, TEMPLATE_NAME } from "@/lib/site"
import { slotHidden } from "@/lib/slots"
import { siteLd } from "@/lib/structured-data"
import { THEME_SCRIPT } from "@/lib/theme"

// the browser's colour round the page before any script runs; once the page
// is up it follows the look showing (syncThemeColour in lib/theme.ts)
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070d09" },
  ],
}

/** The site's own metadata, which every page's builds on: its name as the
 *  copy has it (`site.name`), and the homepage's description. */
export async function generateMetadata(): Promise<Metadata> {
  const data = await getSiteData()
  const copy = data.copy
  const name = siteName(copy)
  // the site's own icon from Notion (`site.icon`, else its logo), made
  // square by the media route; without, the mark's, drawn by `npm run icons`
  const icon = siteIcon(data)
  return {
    metadataBase: new URL(SITE_URL),
    // Nothing URL-shaped of a page's own here (a canonical, an og:url): Next
    // merges metadata per top-level key, so it would be inherited by every
    // page that did not replace it. Pages build theirs through pageMeta() in
    // lib/seo.ts, which repeats the feed's link, because a page's `alternates`
    // replaces this one whole.
    title: name,
    description: pageWords("/", copy).description,
    applicationName: name,
    authors: [{ name: MAKER.name, url: MAKER.url }],
    creator: MAKER.name,
    // the template's credit in every page's head, where the tools that tell
    // what a site is built with look; code, like the footer's credit
    generator: `${TEMPLATE_NAME} a GitHub template by ${MAKER.studio}`,
    icons: icon ? iconLinks(icon) : MARK_ICONS,
    // the manifest (app/manifest.ts) is linked by Next itself
    verification: siteVerification(),
    openGraph: { siteName: name, locale: SITE_LOCALE, type: "website" },
    twitter: { card: "summary_large_image" },
    alternates: { types: FEED_LINK },
  }
}

/** The mark's icons (public/, drawn by `npm run icons`), for a site with no
 *  icon or logo of its own in Notion. */
const MARK_ICONS = {
  icon: [
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/favicon.ico", sizes: "48x48" },
    { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
}

export const revalidate = 60

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await getSiteData()
  const content = data.copy
  // the cookie question, for real or as an example (lib/analytics-config.ts)
  const askCookies = asksCookies(content)
  // the header's, the phone's and the footer's links, as the Menu rows say
  const menus = menusFor(data)
  // the site's own logo from Notion, where the mark stands
  const logo = siteLogo(data)
  return (
    <html lang={SITE_LANGUAGE} suppressHydrationWarning data-theme="light" className={FONT_VARIABLES}>
      <head>
        {/* the reader's look, before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <PointerLight />
        <JsonLd data={siteLd(data)} />
        <SkipLink content={pickCopy(content, "nav.")} />
        <CartProvider>
          <SiteHeader
            content={pickCopy(content, "nav.")}
            brand={siteName(content)}
            // "Get started": a link in its row, else the template's
            // repository, else the deploy steps
            getHref={slotHref(content, "nav.get", REPO_URL || "/features#deploy")}
            shop={headerCart(liveProducts(data).length, commerce())}
            themeIcons={themeIcons()}
            menus={{ header: menus.header, side: menus.side, phone: menus.phone }}
            logo={logo}
          />
          <main id="main">{children}</main>
          {/* the maker's counter, above the footer on every page (blank
              `service.title` hides it); /features places its own, above the
              services in full */}
          <ExceptOn paths={["/features"]}>
            <ServiceCounter T={makeT(content)} content={content} />
          </ExceptOn>
          <SiteFooter content={content} columns={menus.footer} cookies={askCookies} emailReady={listReady()} logo={logo} />
        </CartProvider>
        {/* the feedback button in the corner (blank `feedback.button` removes it) */}
        {slotHidden(content, "feedback.button") ? null : <Feedback content={pickCopy(content, "feedback.")} ready={POSTHOG_ON} icon={<Icon name="chat-circle" />} />}
        <PostHogAnalytics />
        <GoogleAnalytics />
        {askCookies ? <CookieNotice content={pickCopy(content, "cookies.")} shape={cookieShape(content)} posthog={POSTHOG_ON} google={GA_ON} example={!ANALYTICS_ON} /> : null}
      </body>
    </html>
  )
}
