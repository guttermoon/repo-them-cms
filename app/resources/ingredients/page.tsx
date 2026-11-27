import type { Metadata } from "next"
import Link from "next/link"

import { IngredientChips, IngredientsList } from "@/components/sections/template/ingredients"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Frame, PageHeader } from "@/components/ui/page"
import { getSiteData } from "@/lib/content/store"
import { metaKey, PAGE_META } from "@/lib/page-meta"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/resources/ingredients", await getSiteData())
}

/**
 * /resources/ingredients: the template's full list of ingredients, a
 * resource among the resources. It stood on /features, where it was most of
 * the page's length; /features now shows its groups and the way here.
 */
export default async function IngredientsPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  return (
    <>
      <JsonLd data={pageLd("/resources/ingredients", data)} />
      <PageHeader
        icon={<Icon name="clipboard-text" />}
        label={
          <Link href="/resources" className="n-link inline-flex min-h-target items-center">
            <T k={metaKey("/resources", "label")} words>
              {PAGE_META["/resources"].label}
            </T>
          </Link>
        }
        title={<T k="features.list.title">the full list of ingredients</T>}
        description={<T k="features.list.page.lede">Everything the template does, group by group, and what it leaves out. Nothing hidden, nothing artificial.</T>}
      />
      <Frame className="pb-6">
        <IngredientChips T={T} content={content} />
        <IngredientsList T={T} content={content} />
        <ButtonRow className="mt-10">
          <ButtonLink href="/features#deploy">
            <T k="features.list.deploy">Deploy in five steps</T>
          </ButtonLink>
          <ButtonLink href="/features" tone="secondary">
            <T k="features.list.back">How it works</T>
          </ButtonLink>
        </ButtonRow>
      </Frame>
    </>
  )
}
