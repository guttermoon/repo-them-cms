import type { Metadata } from "next"

import { makeT, plainText, siteName } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Package } from "@/components/ui/label"
import { Frame } from "@/components/ui/page"
import { getSiteData } from "@/lib/content/store"
import { menusFor } from "@/lib/content/select"

/** The 404's title and description, for any address with nothing at it:
 *  the routes that look a row up send a missing one here. */
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getSiteData()
  return {
    title: `${plainText(copy, "meta.notfound.title", "Nothing")} | ${siteName(copy)}`,
    description: plainText(copy, "meta.notfound.description", "There is nothing at this address."),
    robots: { index: false, follow: true },
  }
}

/** The 404: a generic tin with nothing in it. */
export default async function NotFound() {
  const data = await getSiteData()
  const { copy } = data
  const T = makeT(copy)
  return (
    <Frame wide className="py-16">
      <div className="settle mx-auto max-w-2xl">
        <Package
          brand={
            <>
              {siteName(copy)} · <T k="notfound.code">404</T>
            </>
          }
          noun={<T k="notfound.title">nothing</T>}
          band={<T k="notfound.band">page not found</T>}
          smallPrint={<T k="notfound.smallprint">Net contents: 0 pages. Best before: the link was moved or never existed.</T>}
        />
      </div>
      <ButtonRow className="mt-8 justify-center">
        <ButtonLink href="/">
          <T k="notfound.home">Home</T>
        </ButtonLink>
        {/* the ways out are the header's links, as Notion's Menu rows have them */}
        {menusFor(data).header.map((item) => (
          <ButtonLink key={item.href} href={item.href} tone="outline">
            {item.key ? <T k={item.key}>{item.name}</T> : item.name}
          </ButtonLink>
        ))}
      </ButtonRow>
    </Frame>
  )
}
