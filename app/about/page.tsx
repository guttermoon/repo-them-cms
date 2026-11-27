import type { Metadata } from "next"

import { Pack } from "@/components/illustrations/pack"
import { Lineup } from "@/components/sections/lineup"
import { HeroSplit } from "@/components/sections/marketing"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, plainText, siteName, slotText } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/about", await getSiteData())
}

/**
 * /about: the company in a sentence beside its pack, then its sections (the
 * story, the numbers, the first of the team, the way in) wherever Notion's
 * Section rows put them (components/sections/lineup/pages.tsx).
 */
export default async function AboutPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)

  return (
    <>
      <JsonLd data={pageLd("/about", data, { type: "AboutPage" })} />

      <HeroSplit
        eyebrow={<T k="about.eyebrow">about us</T>}
        title={<T k="about.title">a company, generic on purpose</T>}
        lede={
          <T k="about.lede">
            We make plain things and sell them plainly. The label says what is inside, the price says what it costs, and a person answers the email.
          </T>
        }
        actions={
          <ButtonRow>
            <ButtonLink href="/team">
              <T k="about.cta.team">Meet the team</T>
            </ButtonLink>
            <ButtonLink href="/contact" tone="secondary">
              <T k="about.cta.contact">Get in touch</T>
            </ButtonLink>
          </ButtonRow>
        }
        art={
          <Pack
            top={siteName(content).toLowerCase()}
            word={slotText(content, "about.art.word", "company")}
            lines={[slotText(content, "about.art.weight", "NET WT 1 COMPANY"), slotText(content, "about.art.keep", "KEEP IN A COOL DRY OFFICE")]}
            label={plainText(content, "about.art.label", "A white generic pack with a blue band, labelled company.")}
          />
        }
      />

      <Lineup page="/about" data={data} />
    </>
  )
}
