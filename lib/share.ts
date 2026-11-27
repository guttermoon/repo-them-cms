/**
 * The pictures the site's owner gives it in Notion: what a shared link
 * shows, and the logo search engines show beside the site's name. Each is a
 * Site Copy row whose Notion cover, or else its Image, is the picture
 * (lib/notion/rows.ts reads it from a ticked row), and whose Text is its
 * words for whoever cannot see it:
 *
 * - `meta.<page>.image`: one designed page's share picture
 *   (`meta.home.image`, `meta.pricing.image`…);
 * - `meta.site.image`: the share picture for every page with none of its
 *   own (a designed page without its row, a post or a page without a cover);
 * - `site.logo`: the site's logo, where the mark stands in the header and
 *   the footer and in the site's structured data (SITE_LOGO without);
 *   `site.logo.dark`, the same logo made for a dark ground, for the dark
 *   look (without, the logo is shown inverted there, dark ink turned light);
 * - `site.icon`: the icon in a browser's tab, on a home screen and in the
 *   manifest, made square by the media route (ICON_SIZES); without, the
 *   logo; without either, the mark's icons in public/;
 * - `home.hero.image`: a picture under the home page's hero, the words
 *   set on it under a veil (HeroCentered). Its row's Cover Tint and Cover
 *   Position work as on any cover, and its Text is its words only if the
 *   picture says something: without, it is decoration (alt="").
 *
 * With no picture, a page's card is drawn with its own title (app/og), as
 * before. The words are read whether there is a picture or not, so `npm run
 * copy` lists every slot and `npm run notion:seed-copy` gives each a row.
 */
import { mediaUrl } from "./content/media"
import { iconMedia } from "./media-sizes"
import { metaKey, pageWords, type IndexedPath } from "./page-meta"
import type { SiteCopy, SitePictures } from "./notion/rows"
import { plainText, siteName } from "./slots"

/** The copy, and the pictures its rows carry. */
export type SiteWords = { copy: SiteCopy; pictures?: SitePictures }

/** A picture at this site's own address (/media/…), and its words. */
export type SharePicture = { url: string; alt: string }

/** The share picture for every page that has none of its own. */
export const SITE_PICTURE = "meta.site.image"

/** The site's logo, as search engines are told it. */
export const LOGO_PICTURE = "site.logo"

/** A picture slot's picture, with the row's Text as its words, or `alt`
 *  when the row has none. Its words are read first, picture or not. */
export function pictureSlot(data: SiteWords, key: string, alt: string): SharePicture | undefined {
  const words = plainText(data.copy, key, alt)
  const ref = data.pictures?.[key]
  return ref ? { url: mediaUrl(ref, "share"), alt: words } : undefined
}

/** A designed page's own share picture (`meta.<page>.image`), named by the
 *  page's title until its row says otherwise. */
export function pagePicture(data: SiteWords, path: IndexedPath): SharePicture | undefined {
  return pictureSlot(data, metaKey(path, "image"), pageWords(path, data.copy).title)
}

/** The site's share picture (`meta.site.image`), for every page with none of its own. */
export function sitePicture(data: SiteWords): SharePicture | undefined {
  return pictureSlot(data, SITE_PICTURE, siteName(data.copy))
}

/** What a page's link shows when it is shared: its own picture, else the
 *  site's; neither leaves the card drawn with its title. */
export function shareImage(data: SiteWords, own?: SharePicture): SharePicture | undefined {
  const site = sitePicture(data)
  return own ?? site
}

/** The site's logo from Notion (`site.logo`), named by the site. */
export function logoPicture(data: SiteWords): SharePicture | undefined {
  return pictureSlot(data, LOGO_PICTURE, siteName(data.copy))
}

/** The site's logo made for a dark ground. */
export const LOGO_DARK_PICTURE = "site.logo.dark"

/** The site's icon: a browser tab's and a home screen's. */
export const ICON_PICTURE = "site.icon"

/** The logo the header and the footer draw where the mark stands, and the
 *  one for the dark look, if there is one. */
export type SiteLogo = { src: string; dark?: string }

/** The site's logo from Notion (`site.logo`, and `site.logo.dark` beside
 *  it), or none: the drawn mark. The link round it is named in words, so
 *  the picture's are read only to list the slot. */
export function siteLogo(data: SiteWords): SiteLogo | undefined {
  const name = siteName(data.copy)
  plainText(data.copy, LOGO_DARK_PICTURE, name)
  const light = data.pictures?.[LOGO_PICTURE]
  if (!light) return undefined
  const dark = data.pictures?.[LOGO_DARK_PICTURE]
  return { src: mediaUrl(light, "logo"), ...(dark ? { dark: mediaUrl(dark, "logo-dark") } : {}) }
}

/** The site's icon (`site.icon`, else `site.logo`): where it is, and
 *  whether it is a drawing (SVG), which goes as it was uploaded. */
export type SiteIcon = { src: string; drawing: boolean }

export function siteIcon(data: SiteWords): SiteIcon | undefined {
  plainText(data.copy, ICON_PICTURE, siteName(data.copy))
  const ref = data.pictures?.[ICON_PICTURE] ?? data.pictures?.[LOGO_PICTURE]
  if (!ref) return undefined
  const src = mediaUrl(ref, "icon")
  return { src, drawing: /\.svgz?$/i.test(src) }
}

/** An icon as a page's head names it. */
export type IconLink = { url: string; sizes?: string; type?: string }

/**
 * The icons a page's head names for the site's own icon: a tab's (32) and a
 * home screen's (192), and an iPhone's (180), each a square PNG the media
 * route makes. A drawing is named once, as it is: a tab draws it at any
 * size, and a home screen that cannot keeps a picture of the page.
 */
export function iconLinks(icon: SiteIcon): { icon: IconLink[]; apple: IconLink[] } {
  if (icon.drawing) return { icon: [{ url: icon.src, type: "image/svg+xml" }], apple: [] }
  return {
    icon: [
      { url: iconMedia(icon.src, 32), sizes: "32x32", type: "image/png" },
      { url: iconMedia(icon.src, 192), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: iconMedia(icon.src, 180), sizes: "180x180", type: "image/png" }],
  }
}

/** The manifest's icons for the site's own icon: 192 and 512, or the
 *  drawing at any size. */
export function manifestIcons(icon: SiteIcon): { src: string; sizes: string; type: string }[] {
  if (icon.drawing) return [{ src: icon.src, sizes: "any", type: "image/svg+xml" }]
  return [
    { src: iconMedia(icon.src, 192), sizes: "192x192", type: "image/png" },
    { src: iconMedia(icon.src, 512), sizes: "512x512", type: "image/png" },
  ]
}

/** The picture under the home page's hero. */
export const HERO_PICTURE = "home.hero.image"

/** A picture under a hero: where it is, its words (none: decoration), and
 *  how it is drawn (printed in the look's ink unless its row says Off; cut
 *  where Cover Position says). */
export type Backdrop = { src: string; alt: string; tint: boolean; at?: number }

/** The home page's hero picture (`home.hero.image`), or none. */
export function heroBackdrop(data: SiteWords): Backdrop | undefined {
  const words = plainText(data.copy, HERO_PICTURE, "")
  const ref = data.pictures?.[HERO_PICTURE]
  return ref ? { src: mediaUrl(ref, "hero"), alt: words, tint: ref.tint !== false, ...(ref.at !== undefined ? { at: ref.at } : {}) } : undefined
}
