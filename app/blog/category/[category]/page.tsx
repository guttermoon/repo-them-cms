import type { Metadata } from "next"

import { filedMetadata, filedPage, filedSlugs, PostFilterPage } from "@/components/notion/post-filter-page"

export const revalidate = 60
export const dynamicParams = true

type Props = { params: Promise<{ category: string }> }

export async function generateStaticParams() {
  return (await filedSlugs("Category")).map((category) => ({ category }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filedMetadata("Category", (await params).category)
}

export default async function CategoryPage({ params }: Props) {
  return <PostFilterPage {...await filedPage("Category", (await params).category)} />
}
