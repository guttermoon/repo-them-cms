import type { Metadata } from "next"

import { Lineup, pageQuestions } from "@/components/sections/lineup"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { answeredRows, pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/questions", await getSiteData())
}

/**
 * /questions: its title, then the Question rows under their categories and
 * the way in, wherever Notion's Section rows put them
 * (components/sections/lineup/pages.tsx). Its FAQPage data names the
 * questions its sections show.
 */
export default async function QuestionsPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)

  return (
    <>
      <JsonLd data={pageLd("/questions", data, { questions: answeredRows(pageQuestions(data, "/questions")) })} />

      <section aria-labelledby="questions-title" className="pb-2 pt-14 sm:pt-20">
        <div className="settle mx-auto w-full max-w-[860px] px-5 sm:px-8">
          <p className="eyebrow text-lead">
            <T k="questions.label">questions</T>
          </p>
          <h1 id="questions-title" className="title-slab title-display mt-3 text-fluid-hero">
            <T k="questions.title">questions and answers</T>
          </h1>
          <p className="mt-4 text-lead leading-relaxed text-ink sm:text-head-s">
            <T k="questions.lede">The ones people ask. Plain answers.</T>
          </p>
        </div>
      </section>

      <Lineup page="/questions" data={data} />
    </>
  )
}
