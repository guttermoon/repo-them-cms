import type { Metadata } from "next"

import { Lineup, pageQuestions } from "@/components/sections/lineup"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { answeredRows, pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/pricing", await getSiteData())
}

/**
 * /pricing, set as a SaaS pricing page: its title, then its sections (the
 * plans, compared, the maker's promises, the questions people ask about
 * money, the way in) wherever Notion's Section rows put them
 * (components/sections/lineup/pages.tsx, lib/sections.ts). Its FAQPage data
 * names the questions its sections show.
 */
export default async function PricingPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)

  return (
    <>
      <JsonLd data={pageLd("/pricing", data, { questions: answeredRows(pageQuestions(data, "/pricing")) })} />

      <section aria-labelledby="pricing-title" className="pb-8 pt-14 sm:pt-20">
        <div className="settle mx-auto w-full max-w-site px-5 sm:px-8">
          <p className="eyebrow mb-3 text-lead">
            <T k="pricing.eyebrow">pricing</T>
          </p>
          <h1 id="pricing-title" className="title-slab title-display max-w-[900px] text-fluid-hero">
            <T k="pricing.title">a plan for every size</T>
          </h1>
          <p className="mt-5 max-w-[680px] text-lead leading-relaxed text-ink sm:text-head-s">
            <T k="pricing.lede">Start free and stay free, or pay a little for a lot more. Monthly or yearly, every feature listed, and no plan you cannot leave.</T>
          </p>
        </div>
      </section>

      <Lineup page="/pricing" data={data} />
    </>
  )
}
