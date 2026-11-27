"use client"

import Link from "next/link"
import { type ReactNode, useMemo, useState } from "react"

import { SearchField, type SearchLabels, useAddressQuery } from "@/components/system/search-box"
import { SelectLine } from "@/components/system/select-line"
import { inlineWords } from "@/lib/inline-text"
import { formatPrice } from "@/lib/pricing"
import { matches, queryWords } from "@/lib/search"

import type { ProductView } from "./product"
import { LinkedText } from "@/components/system/linked-text"
import { picture } from "@/lib/media-sizes"

/**
 * The shop's shelves: a grid of products, searched and sorted the way the
 * reader chooses (the site's select, which keeps a native one's keyboard).
 * Each card is one link, its name the link's words; a two-line description,
 * the price, an old price struck through, and a stock note sit with it, as
 * on any shop's shelf.
 *
 * A product's name is a heading one level below whatever the grid sits
 * under: h2 straight under a page's title, h3 under a section's.
 */
export type GridLabels = {
  sort: string
  featured: string
  priceLow: string
  priceHigh: string
  newest: string
  soldOut: string
  lowStock: string
  was: string
  empty: string
}

type Sort = "featured" | "price-low" | "price-high" | "newest"

export function ProductGrid({
  products,
  labels,
  heading: Heading = "h3",
  sortable = true,
  search,
}: {
  products: ProductView[]
  labels: GridLabels
  heading?: "h2" | "h3"
  /** the sort control; a short shelf (the homepage's) leaves it out */
  sortable?: boolean
  /** a search field over the shelf, its words and its icon (drawn on the server) */
  search?: { labels: SearchLabels; icon?: ReactNode }
}) {
  const [sort, setSort] = useState<Sort>("featured")
  const [query, setQuery] = useAddressQuery()
  const words = useMemo(() => (search ? queryWords(query) : []), [search, query])
  const sorted = useMemo(() => {
    const list = products.filter((p) => matches(`${p.title} ${inlineWords(p.description ?? "")} ${p.collection?.name ?? ""}`, words))
    const price = (p: ProductView) => p.price ?? Infinity
    if (sort === "price-low") list.sort((a, b) => price(a) - price(b))
    if (sort === "price-high") list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1))
    if (sort === "newest") list.sort((a, b) => b.created.localeCompare(a.created))
    return list
  }, [products, sort, words])

  if (!products.length) return <p className="rounded-card bg-panel p-8 text-center text-lead text-ink">{labels.empty}</p>

  return (
    <div>
      {/* search on the left, sort on the right, one row on a wide screen */}
      <div className={search || sortable ? "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" : ""}>
      {search ? (
        <div className="w-full max-w-[560px]">
          <SearchField query={query} onQuery={setQuery} labels={search.labels} count={words.length ? sorted.length : undefined} icon={search.icon} />
        </div>
      ) : null}
      {sortable ? (
        <div className="flex shrink-0 items-center justify-end gap-3">
          <span aria-hidden="true" className="text-small text-sub">
            {labels.sort}
          </span>
          <SelectLine
            value={sort}
            onChange={(value) => setSort(value as Sort)}
            align="end"
            label={labels.sort}
            className="w-[13rem]"
            options={[
              { value: "featured", label: labels.featured },
              { value: "price-low", label: labels.priceLow },
              { value: "price-high", label: labels.priceHigh },
              { value: "newest", label: labels.newest },
            ]}
          />
        </div>
      ) : null}
      </div>
      <ul className="arrive-each grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {sorted.map((product) => {
          const soldOut = product.stock?.toLowerCase() === "sold out"
          return (
            <li key={product.id} className="shelf-pull group relative">
              <div className="aspect-square overflow-hidden rounded-card border border-line bg-panel">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    data-goods
                    {...picture(product.images[0], "(min-width: 1024px) 38vw, (min-width: 768px) 50vw, 75vw")}
                    alt=""
                    className={`h-full w-full object-cover ${soldOut ? "opacity-60" : ""}`}
                  />
                ) : null}
              </div>
              <Heading className="title-slab mt-3 text-lead sm:text-head-s">
                <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
                  {product.title}
                </Link>
              </Heading>
              {product.description ? (
                <p className="mt-1 line-clamp-2 text-small leading-snug text-sub">
                  {/* the card's link covers it: a link in the words stays words */}
                  <LinkedText text={product.description} words />
                </p>
              ) : null}
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-ui">
                {product.price !== undefined ? <span className="font-semibold text-ink">{formatPrice(product.price, product.currency)}</span> : null}
                {product.compareAt !== undefined ? (
                  <span className="text-sub line-through">
                    <span className="sr-only">{labels.was} </span>
                    {formatPrice(product.compareAt, product.currency)}
                  </span>
                ) : null}
              </p>
              {soldOut ? <p className="mt-1 text-small font-medium text-[color:var(--n-red)]">{labels.soldOut}</p> : null}
              {product.stock?.toLowerCase() === "low stock" ? <p className="mt-1 text-small font-medium text-[color:var(--n-orange)]">{labels.lowStock}</p> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
