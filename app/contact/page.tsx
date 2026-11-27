import type { Metadata } from "next"

import { ContactForm } from "@/components/sections/contact-form"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, pickCopy } from "@/components/system/notion-text"
import { Frame, PageHeader } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import { getSiteData } from "@/lib/content/store"
import { contactReady } from "@/lib/email"
import { metaKey, PAGE_META } from "@/lib/page-meta"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/contact", await getSiteData())
}

/** The site's own public address, when the owner wants one printed. */
const PUBLIC_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()

export default async function ContactPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)
  return (
    <>
      <JsonLd data={pageLd("/contact", data, { type: "ContactPage" })} />
      <PageHeader
        icon={<Icon name="envelope-simple" />}
        label={<T k={metaKey("/contact", "label")}>{PAGE_META["/contact"].label}</T>}
        title={<T k="contact.title">Send a message</T>}
        description={<T k="contact.lede">It arrives as an email. A person reads it.</T>}
      />
      <Frame className="appear pb-6 pt-6">
        <ContactForm content={pickCopy(data.copy, "contact.form.")} ready={contactReady()} />
        {PUBLIC_EMAIL ? (
          <p className="mt-6 text-ui text-sub">
            <T k="contact.or">Or write to</T>{" "}
            <a href={`mailto:${PUBLIC_EMAIL}`} className="n-link text-ink">
              {PUBLIC_EMAIL}
            </a>
          </p>
        ) : null}
      </Frame>
    </>
  )
}
