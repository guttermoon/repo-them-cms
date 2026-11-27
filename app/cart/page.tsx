import type { Metadata } from "next"

import { cartLabels } from "@/components/commerce/labels"
import { productView } from "@/components/commerce/product"
import { CartView, type CartProduct } from "@/components/commerce/cart-view"
import { Container } from "@/components/sections/marketing"
import { makeT, plainText, siteName } from "@/components/system/notion-text"
import { commerce } from "@/lib/commerce/config"
import { liveProducts } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { pageMeta } from "@/lib/seo"

/**
 * /cart: what the reader has put in the cart, which lives in their own
 * browser. The page itself is the same for everybody (the products it can
 * show), so it is built ahead like the rest; it is not for search engines.
 */
export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getSiteData()
  return pageMeta({
    site: siteName(copy),
    path: "/cart",
    title: plainText(copy, "meta.cart.title", "Cart"),
    description: plainText(copy, "meta.cart.description", "What is in your cart."),
    noindex: true,
  })
}

export default async function CartPage() {
  const data = await getSiteData()
  const content = data.copy
  const T = makeT(content)
  const products: Record<string, CartProduct> = Object.fromEntries(
    liveProducts(data).map((entry) => {
      const view = productView(entry)
      return [
        view.slug,
        {
          title: view.title,
          href: `/shop/${view.slug}`,
          image: view.images[0],
          price: view.price,
          currency: view.currency,
          variants: view.variants,
          soldOut: view.stock?.toLowerCase() === "sold out",
        },
      ]
    }),
  )
  return (
    <Container className="pb-16 pt-12 sm:pt-16">
      <h1 className="title-slab title-display text-fluid-hero">
        <T k="cart.title">the cart</T>
      </h1>
      <div className="mt-10">
        <CartView products={products} commerce={commerce()} labels={cartLabels(content)} />
      </div>
    </Container>
  )
}
