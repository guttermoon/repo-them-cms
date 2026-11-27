import type { Metadata } from "next"

import { gridLabels, shopSearchLabels } from "@/components/commerce/labels"
import { productView } from "@/components/commerce/product"
import { ProductGrid } from "@/components/commerce/product-grid"
import { ShopFrame } from "@/components/commerce/shop-frame"
import { JsonLd } from "@/components/system/json-ld"
import { Icon } from "@/components/ui/icon"
import { makeT, plainText } from "@/components/system/notion-text"
import { commerce, shopIsLive } from "@/lib/commerce/config"
import { collections, liveProducts } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"

export const revalidate = 60

/** The example shop is not for search engines: its goods are not for sale. */
export async function generateMetadata(): Promise<Metadata> {
  const meta = pageMetaFor("/shop", await getSiteData())
  return shopIsLive(commerce()) ? meta : { ...meta, robots: { index: false, follow: true } }
}

/**
 * /shop: every product written in Notion (Kind "Product"), on shelves the
 * reader can sort, with the collections above them. How they are bought is
 * the deployment's choice (lib/commerce/config.ts).
 */
export default async function ShopPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const products = liveProducts(data)
  const mode = commerce()

  return (
    <>
      <JsonLd data={pageLd("/shop", data)} />
      <ShopFrame
        T={T}
        title={<T k="shop.title">the generic store</T>}
        lede={<T k="shop.lede">Plain goods with plain labels. The price is on the front, and the ingredients are on the side.</T>}
        demo={!shopIsLive(mode)}
        collections={collections(products)}
        navLabel={plainText(content, "shop.collections", "Collections")}
      >
        <ProductGrid products={products.map(productView)} labels={gridLabels(content)} heading="h2" search={{ labels: shopSearchLabels(content), icon: <Icon name="magnifying-glass" /> }} />
      </ShopFrame>
    </>
  )
}
