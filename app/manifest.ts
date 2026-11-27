import type { MetadataRoute } from "next"

import { getSiteData } from "@/lib/content/store"
import { MARK_BRAND } from "@/lib/brand/mark"
import { pageWords } from "@/lib/page-meta"
import { manifestIcons, siteIcon } from "@/lib/share"
import { siteName } from "@/lib/slots"

/** Built ahead and refreshed with the content, like the pages. */
export const revalidate = 60

/**
 * /manifest.webmanifest: what a browser calls the site when it is added to
 * a home screen, so its name is the site's own (`site.name`), as a copy has
 * renamed it in Notion, and its description the homepage's. The icons are
 * the site's own from Notion (`site.icon`, else its logo, lib/share.ts),
 * made square by the media route, or else the mark `npm run icons` draws.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const data = await getSiteData()
  const copy = data.copy
  const name = siteName(copy)
  const icon = siteIcon(data)
  return {
    name,
    short_name: name,
    description: pageWords("/", copy).description,
    start_url: "/",
    // a site's own icon is not made to be cut to a circle, so it has no
    // maskable one: the home screen sets it on its own ground instead
    icons: icon
      ? manifestIcons(icon)
      : [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    theme_color: MARK_BRAND,
    background_color: "#ffffff",
    display: "browser",
  }
}
