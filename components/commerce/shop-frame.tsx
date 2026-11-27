import Link from "next/link"
import type React from "react"

import type { T } from "@/components/system/notion-text"
import { Container } from "@/components/sections/marketing"
import { Icon } from "@/components/ui/icon"

/**
 * The top of every shop page: the eyebrow, the title, a sentence, the
 * example-shop notice when nothing can be bought, and the collections. The
 * collections are a navigation landmark of their own, with the current one
 * marked.
 */
export function ShopFrame({
  T,
  title,
  lede,
  demo,
  collections,
  current,
  navLabel,
  children,
}: {
  T: T
  title: React.ReactNode
  lede?: React.ReactNode
  demo: boolean
  collections: { name: string; slug: string; count: number }[]
  current?: string
  navLabel: string
  children: React.ReactNode
}) {
  const chip = (active: boolean) =>
    `inline-flex min-h-target items-center rounded-full border px-4 text-ui font-medium tone ${
      active ? "border-transparent bg-btn text-btn-ink" : "border-line-strong text-ink hover:bg-wash"
    }`
  return (
    <div className="pb-16 pt-12 sm:pt-16">
      <Container>
        <p className="eyebrow text-lead">
          <T k="shop.eyebrow">shop</T>
        </p>
        <h1 className="title-slab title-display mt-3 text-fluid-hero">{title}</h1>
        {lede ? <p className="mt-4 max-w-[680px] text-lead leading-relaxed text-ink sm:text-head-s">{lede}</p> : null}
        {demo ? (
          <p role="note" className="mt-6 flex max-w-measure items-start gap-3 rounded-card bg-tint px-4 py-3 text-ui leading-relaxed text-brand">
            <Icon name="shopping-cart-simple" className="mt-[0.2em] text-lead" />
            <span>
              <T k="shop.demo">An example shop: nothing here is for sale. Connect a Shopify or Printify shop with COMMERCE_PROVIDER, and its products are sold from here.</T>
            </span>
          </p>
        ) : null}
        {collections.length > 1 ? (
          <nav aria-label={navLabel} className="mt-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link href="/shop" aria-current={!current ? "page" : undefined} className={chip(!current)}>
                  <T k="shop.all">Everything</T>
                </Link>
              </li>
              {collections.map((c) => (
                <li key={c.slug}>
                  <Link href={`/shop/collection/${c.slug}`} aria-current={current === c.slug ? "page" : undefined} className={chip(current === c.slug)}>
                    {c.name}
                    <span className="ml-1.5 text-fine opacity-70">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="mt-10">{children}</div>
      </Container>
    </div>
  )
}
