import type { Metadata } from "next"
import Link from "next/link"

import { CookieSettingsLink } from "@/components/layout/cookie-settings-link"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, plainText } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { Frame, PageHeader } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import { POSTHOG_IN_EU, posthogCookieName } from "@/lib/analytics"
import { GA_ON, POSTHOG_KEY, POSTHOG_ON } from "@/lib/analytics-config"
import { CART_KEY } from "@/lib/commerce/cart"
import { commerce, shopIsLive } from "@/lib/commerce/config"
import { CONSENT_KEY } from "@/lib/consent"
import { liveProducts } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { metaKey, PAGE_META } from "@/lib/page-meta"
import { processors } from "@/lib/email"
import { GA_COOKIE_SECONDS, GA_MEASUREMENT_ID, gaCookieNames } from "@/lib/google-analytics"
import { sharedStore } from "@/lib/rate-limit"
import { pageMetaFor } from "@/lib/seo"
import { SITE_LANGUAGE, SITE_NAME } from "@/lib/site"
import { pageLd } from "@/lib/structured-data"
import { THEME_KEY } from "@/lib/theme"
import { outsideLink } from "@/lib/outside"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/privacy", await getSiteData())
}

/**
 * The privacy notice: what the site keeps and why. It describes this build
 * as it is configured: the email platforms it names are the ones in use, and
 * the analytics paragraphs and cookie rows appear only when analytics is on.
 * Every paragraph is a Notion slot, so the site's owner can say who they are
 * and add what is particular to them.
 */
export default async function PrivacyPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const platforms = processors()
  const hasShop = liveProducts(data).length > 0 || shopIsLive(commerce())
  const H = "n-h2"
  const months = Math.round(GA_COOKIE_SECONDS / (30 * 24 * 60 * 60))

  return (
    <>
      <JsonLd data={pageLd("/privacy", data)} />
      <PageHeader
        icon={<Icon name="lock-simple" />}
        label={<T k={metaKey("/privacy", "label")}>{PAGE_META["/privacy"].label}</T>}
        title={<T k="privacy.title">Privacy notice</T>}
        description={<T k="privacy.lede">What this website keeps about you. Not much.</T>}
      />
      <Frame className="pb-6 pt-6">
        <div className="n-page">
          <Callout icon={<Icon name="clipboard-text" />}>
            <p>
              <strong className="font-semibold">
                <T k="privacy.short.title">The short version.</T>
              </strong>{" "}
              <T k="privacy.short.body">
                Your browser talks to this site and nobody else. Nothing is counted unless you say yes. If you write to us or join the mailing
                list, we keep what you sent, and only to answer you or send you the emails you asked for.
              </T>
            </p>
          </Callout>

          <h2 className={H} id="who">
            <T k="privacy.who.title">Who we are</T>
          </h2>
          <p className="n-block">
            <T k="privacy.who.body">
              This website is run by its owner, who is responsible for the information described here. To ask about it, or to use any of your
              rights below, use the contact page.
            </T>
          </p>

          <h2 className={H} id="forms">
            <T k="privacy.forms.title">If you write to us or join the list</T>
          </h2>
          <p className="n-block">
            <T k="privacy.forms.contact">
              The contact form sends us your name, address and message, with your company and what it is about if you gave them. The site does not store it; our mailbox does, for as long
              as the conversation needs.
            </T>
          </p>
          <p className="n-block">
            <T k="privacy.forms.list">
              The mailing list keeps your address and, if you give one, your first name, so we can send you the emails you asked for. Every email
              has an unsubscribe link, and unsubscribing is the end of it.
            </T>
          </p>
          {POSTHOG_ON ? (
            <p className="n-block">
              <T k="privacy.forms.feedback">
                The Feedback button sends what you write, with the page you were on, the browser you use (its name and version), the look you had and the size of your window, to PostHog, which we use to read it. If you said
                yes to cookies, it also sends which visit it came from, so we can see what went wrong. It never sends your address or your name.
              </T>
            </p>
          ) : null}
          {platforms.length ? (
            <p className="n-block">
              <T k="privacy.forms.processors">Both are handled for us by</T>{" "}
              {/* "A, B and C" in the site's own language, each linked to its policy */}
              {new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" }).formatToParts(platforms.map((p) => p.name)).map((part, i) => {
                const platform = part.type === "element" ? platforms.find((p) => p.name === part.value) : undefined
                return platform?.privacyUrl ? (
                  <a key={i} href={platform.privacyUrl} className="n-link" {...outsideLink(platform.privacyUrl)}>
                    {platform.name}
                  </a>
                ) : (
                  <span key={i}>{part.value}</span>
                )
              })}
              .
            </p>
          ) : null}

          <h2 className={H} id="cookies">
            <T k="privacy.cookies.title">Cookies and storage</T>
          </h2>
          {POSTHOG_ON || GA_ON ? (
            <>
              <p className="n-block">
                <T k="privacy.analytics.body">
                  Only after you say yes in the cookie notice, we record which pages are opened and what is done on them: what is pressed, what goes in a cart, when a form is sent, and errors a page runs into. It all goes through this site,
                  which shortens your IP address before passing anything on, and takes names and addresses out of page addresses.
                </T>{" "}
                <CookieSettingsLink className="n-link" label={plainText(content, "privacy.analytics.change", "Change your answer")} />
              </p>
              <p className="n-block">
                {POSTHOG_ON ? (
                  POSTHOG_IN_EU ? (
                    <T k="privacy.analytics.posthog.eu">
                      PostHog counts the visits for us, on its servers in the European Union (
                      <a href="https://posthog.com/privacy" className="n-link" {...outsideLink("https://posthog.com/privacy")}>
                        its privacy policy
                      </a>
                      ).
                    </T>
                  ) : (
                    <T k="privacy.analytics.posthog.us">
                      PostHog counts the visits for us, on its servers in the United States (
                      <a href="https://posthog.com/privacy" className="n-link" {...outsideLink("https://posthog.com/privacy")}>
                        its privacy policy
                      </a>
                      ).
                    </T>
                  )
                ) : null}{" "}
                {GA_ON ? (
                  <T k="privacy.analytics.google">
                    Google Analytics counts them as well, and Google may handle what it receives in the United States (
                    <a href="https://policies.google.com/privacy" className="n-link" {...outsideLink("https://policies.google.com/privacy")}>
                      Google&apos;s privacy policy
                    </a>
                    ).
                  </T>
                ) : null}
              </p>
            </>
          ) : (
            <p className="n-block">
              <T k="privacy.analytics.none">This site counts nothing. There are no analytics and no tracking cookies.</T>
            </p>
          )}
          <div className="relative my-2 overflow-x-auto" role="region" aria-label={plainText(content, "privacy.table.region", "What this site keeps in your browser")} tabIndex={0}>
            <table className="n-table">
              <thead>
                <tr>
                  <th scope="col">
                    <T k="privacy.table.name">Name</T>
                  </th>
                  <th scope="col">
                    <T k="privacy.table.what">What it is for</T>
                  </th>
                  <th scope="col">
                    <T k="privacy.table.how">How long</T>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code className="n-code-inline">{THEME_KEY}</code>
                  </td>
                  <td>
                    <T k="privacy.table.theme">Remembers the look you chose (light, dark, mono or rainbow), if you chose one. Stays in your browser.</T>
                  </td>
                  <td>
                    <T k="privacy.table.untilcleared">Until you clear it</T>
                  </td>
                </tr>
                {hasShop ? (
                  <tr>
                    <td>
                      <code className="n-code-inline">{CART_KEY}</code>
                    </td>
                    <td>
                      <T k="privacy.table.cart">What you put in the cart, written only once you add something. Stays in your browser until you empty it.</T>
                    </td>
                    <td>
                      <T k="privacy.table.untilcleared">Until you clear it</T>
                    </td>
                  </tr>
                ) : null}
                {POSTHOG_ON || GA_ON ? (
                  <tr>
                    <td>
                      <code className="n-code-inline">{CONSENT_KEY}</code>
                    </td>
                    <td>
                      <T k="privacy.table.consent">Remembers your answer to the cookie notice. Stays in your browser.</T>
                    </td>
                    <td>
                      <T k="privacy.table.untilcleared">Until you clear it</T>
                    </td>
                  </tr>
                ) : null}
                {POSTHOG_ON && POSTHOG_KEY ? (
                  <tr>
                    <td>
                      <code className="n-code-inline">{posthogCookieName(POSTHOG_KEY)}</code>
                    </td>
                    <td>
                      <T k="privacy.table.posthog">PostHog: a random identifier, kept as this cookie and in the storage of your browser, so a visit is counted once. Only after a yes, and a later no deletes both.</T>
                    </td>
                    <td>
                      <T k="privacy.table.year">Up to a year</T>
                    </td>
                  </tr>
                ) : null}
                {GA_ON && GA_MEASUREMENT_ID ? (
                  <tr>
                    <td>
                      {gaCookieNames(GA_MEASUREMENT_ID).map((n) => (
                        <code key={n} className="n-code-inline mr-1">
                          {n}
                        </code>
                      ))}
                    </td>
                    <td>
                      <T k="privacy.table.google">Google Analytics: a random identifier, so a visit is counted once. Only after a yes.</T>
                    </td>
                    <td>
                      {months} <T k="privacy.table.months">months</T>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <h2 className={H} id="third-parties">
            <T k="privacy.third.title">Nobody else in your browser</T>
          </h2>
          <p className="n-block">
            <T k="privacy.third.body">
              Fonts, pictures and files are served from this site, never fetched by your browser from anybody else. A YouTube or Vimeo video
              loads only if you press play, and from then on that video is between you and them.
            </T>
          </p>
          <p className="n-block">
            <T k="privacy.third.hosting">
              Like any website, the company hosting this one keeps short-lived server logs, including IP addresses, to keep the site running
              and secure.
            </T>
          </p>
          {sharedStore() ? (
            <p className="n-block">
              <T k="privacy.third.limits">
                To stop any one visitor flooding the site, Upstash counts the requests each one makes, a minute at a time. It never learns who: it is given a
                stand-in for your IP address, scrambled with a key it does not have, and each count is gone within the minute.
              </T>
            </p>
          ) : null}

          <h2 className={H} id="rights">
            <T k="privacy.rights.title">Your rights</T>
          </h2>
          <p className="n-block">
            <T k="privacy.rights.body">
              You can ask what we hold about you, have it corrected or deleted, object to how it is used, or take it elsewhere. Ask through the
              contact page and we will answer within a month. If you are unhappy with the answer, you can complain to your data protection
              authority.
            </T>
          </p>
          <p className="n-block text-sub">
            <T k="privacy.updated">Last updated when this site was set up.</T>
          </p>
        </div>
        <p className="mt-6">
          <Link href="/contact" className="n-link inline-flex min-h-target items-center text-ui">
            <T k="privacy.contact">Contact {SITE_NAME}</T>
          </Link>
        </p>
      </Frame>
    </>
  )
}
