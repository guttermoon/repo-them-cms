import type { Metadata } from "next"

import { Lineup } from "@/components/sections/lineup"
import { HeroCentered, KineticWords } from "@/components/sections/marketing"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, siteName, slotHref, slotText } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { heroBackdrop } from "@/lib/share"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/", await getSiteData())
}

/**
 * The homepage of the generic site a copy of the template starts as: the
 * hero (what is this), then its sections in the order a stranger asks,
 * wherever Notion's Section rows put them (components/sections/lineup/home.tsx,
 * lib/sections.ts). The service counter and the footer follow on every page.
 */
export default async function HomePage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)

  return (
    <>
      <JsonLd data={pageLd("/", data)} />

      <HeroCentered
        // the site's own name (site.name), alone and centred: the header shows
        // only the mark, and the descriptor is in the footer
        name={{ name: siteName(content) }}
        eyebrow={<T k="home.hero.eyebrow">generic, on purpose</T>}
        // the title's words land one after another, so the slot is read as a string
        title={<KineticWords text={slotText(content, "home.hero.title", "everything you need, nothing you don't")} />}
        lede={
          <T k="home.lead">
            Plain products with plain labels, and plain plans to go with them. Prices up front, ingredients on the side, and a person on the other end of the email.
          </T>
        }
        actions={
          <ButtonRow className="justify-center">
            {/* a link in a button's row is where it goes (slotHref) */}
            <ButtonLink href={slotHref(content, "home.cta.shop", "/shop")}>
              <T k="home.cta.shop" words>
                Shop the shelf
              </T>
            </ButtonLink>
            <ButtonLink href={slotHref(content, "home.cta.plans", "/pricing")} tone="secondary">
              <T k="home.cta.plans" words>
                See the plans
              </T>
            </ButtonLink>
          </ButtonRow>
        }
        note={<T k="home.cta.note">No small print. We checked.</T>}
        // a picture under it all, if the home.hero.image row has one
        backdrop={heroBackdrop(data)}
      />

      <Lineup page="/" data={data} />
    </>
  )
}
