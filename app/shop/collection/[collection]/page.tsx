import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { gridLabels } from "@/components/commerce/labels"
import { productView } from "@/components/commerce/product"
import { ProductGrid } from "@/components/commerce/product-grid"
import { ShopFrame } from "@/components/commerce/shop-frame"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, plainText, siteName, type SiteCopy } from "@/components/system/notion-text"
import { commerce, shopIsLive } from "@/lib/commerce/config"
import { collections, liveProducts, tagSlug } from "@/lib/content/select"
import { fillTitles } from "@/lib/filter-words"
import { getSiteData } from "@/lib/content/store"
import { pageMeta } from "@/lib/seo"
import { shareImage } from "@/lib/share"
import { collectionLd } from "@/lib/structured-data"

/** One collection: the products whose Category is it. */
export const revalidate = 60
export const dynamicParams = true

export async function generateStaticParams() {
  return collections(liveProducts(await getSiteData())).map((c) => ({ collection: c.slug }))
}

async function find(slug: string) {
  const products = liveProducts(await getSiteData())
  const collection = collections(products).find((c) => c.slug === slug)
  return collection ? { collection, products: products.filter((p) => p.category && tagSlug(p.category.name) === slug) } : undefined
}

/** What a collection's page says it holds, with `{name}`, `{count}` and
 *  `{titles}` filled in from the products (`meta.collection.*` in Site
 *  Copy; lib/filter-words.ts fits the titles to a search result). */
function describe(content: SiteCopy, name: string, titles: string[]): string {
  const count = titles.length
  const words = count === 1 ? plainText(content, "meta.collection.one", "{name}: 1 product in the shop: {titles}.") : plainText(content, "meta.collection.many", "{name}: {count} products in the shop: {titles}.")
  return fillTitles(words, { name, count }, titles)
}

export async function generateMetadata({ params }: { params: Promise<{ collection: string }> }): Promise<Metadata> {
  const { collection } = await params
  const found = await find(collection)
  // the 404's own metadata (app/not-found.tsx)
  if (!found) notFound()
  const data = await getSiteData()
  const { copy } = data
  const image = shareImage(data)
  return pageMeta({
    site: siteName(copy),
    path: `/shop/collection/${found.collection.slug}`,
    title: found.collection.name,
    description: describe(copy, found.collection.name, found.products.map((product) => product.title)),
    noindex: !shopIsLive(commerce()),
    ...(image ? { image } : {}),
  })
}

export default async function CollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const found = await find(collection)
  if (!found) notFound()
  const all = liveProducts(data)

  return (
    <>
      <JsonLd
        data={collectionLd(found.products, content, {
          path: `/shop/collection/${found.collection.slug}`,
          name: found.collection.name,
          description: describe(content, found.collection.name, found.products.map((product) => product.title)),
        })}
      />
      <ShopFrame
        T={T}
        title={found.collection.name}
        demo={!shopIsLive(commerce())}
        collections={collections(all)}
        current={found.collection.slug}
        navLabel={plainText(content, "shop.collections", "Collections")}
      >
        <ProductGrid products={found.products.map(productView)} labels={gridLabels(content)} heading="h2" />
      </ShopFrame>
    </>
  )
}
