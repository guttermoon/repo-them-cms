import type { MetadataRoute } from "next"

import { notionConfigured } from "@/lib/config"
import { SITE_URL } from "@/lib/site"

/**
 * The assistants' crawlers, named, with the same access as everybody else:
 * a site that wants to be found wants to be found by the assistants people
 * ask. Both kinds are listed: the ones that fetch a page to answer a
 * question, and the ones that read for training. Moving the second kind into
 * a `disallow: "/"` group is the site owner's decision; it keeps the site out
 * of what those models learn, not out of search.
 *
 * A crawler named in a group of its own reads only that group, so each group
 * repeats the whole rule.
 */
const AI_CRAWLERS = [
  // OpenAI: search, a user's own fetch, training
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  // Anthropic: search, a user's own fetch, training
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  // Perplexity: search, a user's own fetch
  "PerplexityBot",
  "Perplexity-User",
  // Google's AI products (a token, not a crawler: Googlebot reads for them)
  // and its agents' crawler
  "Google-Extended",
  "Google-CloudVertexBot",
  // Apple Intelligence (a token too: Applebot reads for it)
  "Applebot-Extended",
  // DuckDuckGo's answers, Mistral's Le Chat, Meta AI's own fetch and its
  // training, Amazon's, and Common Crawl, which many models are trained on
  "DuckAssistBot",
  "MistralAI-User",
  "meta-externalfetcher",
  "meta-externalagent",
  "Amazonbot",
  "CCBot",
]

export default function robots(): MetadataRoute.Robots {
  // The route handlers and the analytics proxies are not pages. /media/ and
  // /og/ are left open: pictures are found through them.
  //
  // /subscribed is not blocked even though it stays out of results: a
  // disallowed URL is never crawled, so its noindex would never be read.
  //
  // With no Notion connected the site shows the starter content, which is
  // the same on every copy of the template: nothing is crawled at all.
  const rule = notionConfigured() ? { allow: ["/"], disallow: ["/api/", "/ingest/", "/ga/"] } : { disallow: ["/"] }
  return {
    rules: [
      { userAgent: "*", ...rule },
      { userAgent: AI_CRAWLERS, ...rule },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
