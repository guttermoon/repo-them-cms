import type { Metadata } from "next"

import { makeT, plainText, siteName } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Frame, PageHeader } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import { getSiteData } from "@/lib/content/store"
import { pageMeta } from "@/lib/seo"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getSiteData()
  return pageMeta({
    site: siteName(copy),
    path: "/subscribed",
    title: plainText(copy, "meta.subscribed.title", "Subscribed"),
    description: plainText(copy, "meta.subscribed.description", "The address is confirmed and on the mailing list. This is the page a confirmation email's link lands on."),
    noindex: true,
  })
}

/** Where a double opt-in confirmation lands (BREVO_DOI_REDIRECT_URL). */
export default async function SubscribedPage() {
  const T = makeT((await getSiteData()).copy)
  return (
    <>
      <PageHeader
        icon={<Icon name="check-circle" />}
        label={<T k="subscribed.label">Confirmed</T>}
        title={<T k="subscribed.title">You are on the list</T>}
        description={<T k="subscribed.lede">Thanks for confirming. Occasional emails, generic ones, and an unsubscribe link in every one.</T>}
      />
      <Frame className="pb-6 pt-6">
        <ButtonRow>
          <ButtonLink href="/blog">
            <T k="subscribed.blog">Read the blog</T>
          </ButtonLink>
          <ButtonLink href="/" tone="secondary">
            <T k="subscribed.home">Home</T>
          </ButtonLink>
        </ButtonRow>
      </Frame>
    </>
  )
}
