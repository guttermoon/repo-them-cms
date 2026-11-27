import { blogPosts } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { feedTitle, rssFeed } from "@/lib/feed"
import { pageWords } from "@/lib/page-meta"
import { SITE_LANGUAGE, SITE_URL } from "@/lib/site"
import { siteName } from "@/lib/slots"

// built ahead and refreshed with the content, like the pages
export const revalidate = 60

export async function GET() {
  const data = await getSiteData()
  const xml = rssFeed({
    title: feedTitle(data.copy, siteName(data.copy)),
    description: pageWords("/blog", data.copy).description,
    siteUrl: SITE_URL,
    language: SITE_LANGUAGE,
    posts: blogPosts(data).slice(0, 50),
  })
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } })
}
