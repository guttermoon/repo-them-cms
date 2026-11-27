import type { Metadata } from "next"

import { Lineup } from "@/components/sections/lineup"
import { HeroCentered } from "@/components/sections/marketing"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/team", await getSiteData())
}

/**
 * /team: its title, then everybody and the way in, wherever Notion's
 * Section rows put them (components/sections/lineup/pages.tsx). The
 * people's structured data goes with the section that shows them.
 */
export default async function TeamPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)

  return (
    <>
      <JsonLd data={pageLd("/team", data)} />

      <HeroCentered
        eyebrow={<T k="team.eyebrow">the team</T>}
        title={<T k="team.title">meet the team</T>}
        lede={<T k="team.lede">The people behind the shelf. Generic job titles, specific opinions, and every one of them reads the email.</T>}
      />

      <Lineup page="/team" data={data} />
    </>
  )
}
