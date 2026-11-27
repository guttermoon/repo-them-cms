import type { Metadata } from "next"

import { Lineup } from "@/components/sections/lineup"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/security", await getSiteData())
}

/**
 * /security: its title, then what is true of the code and how to report a
 * problem, wherever Notion's Section rows put them
 * (components/sections/lineup/pages.tsx).
 */
export default async function SecurityPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)

  return (
    <>
      <JsonLd data={pageLd("/security", data)} />

      <section aria-labelledby="security-title" className="pb-4 pt-14 sm:pt-20">
        <div className="settle mx-auto w-full max-w-site px-5 sm:px-8">
          <p className="eyebrow text-lead">
            <T k="security.eyebrow">security and privacy</T>
          </p>
          <h1 id="security-title" className="title-slab title-display mt-3 max-w-[900px] text-fluid-hero">
            <T k="security.title">private by default, safe by design</T>
          </h1>
          <p className="mt-5 max-w-[680px] text-lead leading-relaxed text-ink sm:text-head-s">
            <T k="security.lede">What this site does to keep its readers private and itself safe, in plain words. The code that keeps each is tested every time it changes.</T>
          </p>
        </div>
      </section>

      <Lineup page="/security" data={data} />
    </>
  )
}
