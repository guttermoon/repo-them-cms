/**
 * A product as the shop prints it: the Product row with its pictures as
 * this site's own /media/ addresses (so a reader's browser never fetches
 * them from Notion's file host) and nothing the page does not use. Plain
 * data, so client components (the grid, the gallery) can be handed it.
 */
import { mediaUrl } from "@/lib/content/media"
import { tagSlug } from "@/lib/content/select"
import { nameAlt } from "@/lib/notion/alt-text"
import type { Entry } from "@/lib/notion/rows"
import { currencyOf } from "@/lib/pricing"

export type ProductView = {
  id: string
  slug: string
  title: string
  description: string
  price?: number
  compareAt?: number
  currency: string
  images: string[]
  /** each picture's description (its name in Notion, the shop's alt text),
   *  "" where it has none */
  alts: string[]
  stock?: string
  collection?: { name: string; slug: string }
  variants: { label: string; id: string }[]
  link?: string
  featured: boolean
  order?: number
  created: string
}

export function productView(entry: Entry): ProductView {
  const media = [entry.cover, ...(entry.gallery ?? [])].filter((m): m is NonNullable<typeof m> => Boolean(m))
  const images = media.map((m, i) => mediaUrl(m, i ? `picture-${i + 1}` : "picture"))
  return {
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    price: entry.price,
    compareAt: entry.compareAt !== undefined && entry.price !== undefined && entry.compareAt > entry.price ? entry.compareAt : undefined,
    currency: currencyOf(entry.currency),
    images,
    alts: media.map(nameAlt),
    stock: entry.stock?.name,
    collection: entry.category ? { name: entry.category.name, slug: tagSlug(entry.category.name) } : undefined,
    variants: entry.variants ?? [],
    link: entry.link,
    featured: entry.featured,
    order: entry.order,
    created: entry.created,
  }
}
