import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AddToCart } from "@/components/commerce/add-to-cart"
import { addLabels, gridLabels, stockLabel } from "@/components/commerce/labels"
import { productView } from "@/components/commerce/product"
import { ProductGallery } from "@/components/commerce/product-gallery"
import { ProductGrid } from "@/components/commerce/product-grid"
import { NotionBody } from "@/components/notion/blocks"
import { blockLabels, makeContext } from "@/components/notion/context"
import { Container } from "@/components/sections/marketing"
import { JsonLd } from "@/components/system/json-ld"
import { fillIn, makeT, plainText, siteName } from "@/components/system/notion-text"
import { buyAction, commerce, shopIsLive } from "@/lib/commerce/config"
import { getBlocks, prerenderable } from "@/lib/content/blocks"
import { liveProducts, urlForNotionId } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { blocksExcerpt } from "@/lib/notion/blocks"
import { formatPrice } from "@/lib/pricing"
import { pageMeta } from "@/lib/seo"
import { shareImage } from "@/lib/share"
import { productLd } from "@/lib/structured-data"
import { LinkedText } from "@/components/system/linked-text"
import { inlineWords } from "@/lib/inline-text"

/**
 * One product: its pictures, its name and price, how to buy it (as the shop
 * is set up to sell), its own page from Notion as the long description, and
 * more from the same collection.
 */
export const revalidate = 60
export const dynamicParams = true

export async function generateStaticParams() {
  return prerenderable(liveProducts(await getSiteData())).map((p) => ({ slug: p.slug }))
}

async function find(slug: string) {
  return liveProducts(await getSiteData()).find((p) => p.slug === decodeURIComponent(slug).toLowerCase())
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const entry = await find(slug)
  // the 404's own metadata (app/not-found.tsx)
  if (!entry) notFound()
  const data = await getSiteData()
  const { copy } = data
  // read first, so the slot is there to find (npm run copy) whichever is used
  const fallback = fillIn(plainText(copy, "meta.product.description", "{title}, in the shop."), { title: entry.title })
  const view = productView(entry)
  const image = shareImage(data, view.images[0] ? { url: view.images[0], alt: view.alts[0] || entry.title } : undefined)
  return pageMeta({
    site: siteName(copy),
    path: `/shop/${entry.slug}`,
    title: entry.title,
    description:
      inlineWords(entry.description) || blocksExcerpt(await getBlocks(entry)) || fallback,
    ...(image ? { image } : {}),
    noindex: !shopIsLive(commerce()),
    // a copy is offered only while the shop sells for real (app/markdown)
    markdown: shopIsLive(commerce()),
  })
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const entry = await find(slug)
  if (!entry) notFound()
  const product = productView(entry)
  const mode = commerce()
  const live = shopIsLive(mode)
  const blocks = await getBlocks(entry)
  // the body sits under the "details" <h2>
  const ctx = makeContext(blocks, (id) => urlForNotionId(data, id), blockLabels(data.copy), 2)
  const related = liveProducts(data)
    .filter((p) => p.id !== entry.id && p.category?.name === entry.category?.name)
    .slice(0, 4)
    .map(productView)

  return (
    <>
      {live ? <JsonLd data={productLd(product, content)} /> : null}
      <Container className="pb-16 pt-10 sm:pt-14">
        <nav aria-label={plainText(content, "shop.breadcrumb", "Breadcrumb")} className="text-small text-sub">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/shop" className="inline-flex min-h-target items-center hover:text-ink hover:underline">
                <T k="shop.eyebrow">shop</T>
              </Link>
            </li>
            {product.collection ? (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/shop/collection/${product.collection.slug}`} className="inline-flex min-h-target items-center hover:text-ink hover:underline">
                    {product.collection.name}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery
            images={product.images}
            alts={product.alts}
            title={product.title}
            labels={{ picture: plainText(content, "shop.picture", "Picture"), of: plainText(content, "shop.picture.of", "of") }}
          />
          <div>
            <h1 className="title-slab title-display text-fluid-title">{product.title}</h1>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
              {product.price !== undefined ? <span className="title-slab text-head-l">{formatPrice(product.price, product.currency)}</span> : null}
              {product.compareAt !== undefined ? (
                <span className="text-lead text-sub line-through">
                  <span className="sr-only">{plainText(content, "shop.was", "Was")} </span>
                  {formatPrice(product.compareAt, product.currency)}
                </span>
              ) : null}
            </p>
            {product.stock ? <p className="mt-2 text-ui font-medium text-sub">{stockLabel(content, product.stock)}</p> : null}
            {product.description ? (
              <p className="mt-5 max-w-[560px] text-lead leading-relaxed text-ink">
                <LinkedText text={product.description} />
              </p>
            ) : null}
            {!live ? (
              <p role="note" className="mt-6 rounded-card bg-tint px-4 py-3 text-ui text-brand">
                <T k="shop.product.demo">An example product: it can go in the cart, but nothing here is for sale.</T>
              </p>
            ) : null}
            <div className="mt-6">
              <AddToCart slug={product.slug} title={product.title} variants={product.variants} action={buyAction(mode, entry)} labels={addLabels(content)} />
            </div>
          </div>
        </div>

        {blocks.length ? (
          <section aria-labelledby="product-details" className="mt-16 border-t border-line pt-10">
            <h2 id="product-details" className="title-slab text-head-m">
              <T k="shop.product.details">details</T>
            </h2>
            {/* the product's own pictures: goods, shown as uploaded */}
            <div data-goods className="group-body max-w-[760px]">
              <NotionBody blocks={blocks} ctx={ctx} font={entry.font} />
            </div>
          </section>
        ) : null}

        {related.length ? (
          <section aria-labelledby="product-related" className="mt-16 border-t border-line pt-10">
            <h2 id="product-related" className="title-slab text-head-m">
              <T k="shop.product.related">from the same shelf</T>
            </h2>
            <div className="group-body">
              <ProductGrid products={related} labels={gridLabels(content)} />
            </div>
          </section>
        ) : null}
      </Container>
    </>
  )
}
