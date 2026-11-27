import type { Metadata } from "next"

import { filedMetadata, filedPage, filedSlugs, PostFilterPage } from "@/components/notion/post-filter-page"

export const revalidate = 60
export const dynamicParams = true

type Props = { params: Promise<{ tag: string }> }

export async function generateStaticParams() {
  return (await filedSlugs("Tag")).map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return filedMetadata("Tag", (await params).tag)
}

export default async function TagPage({ params }: Props) {
  return <PostFilterPage {...await filedPage("Tag", (await params).tag)} />
}
