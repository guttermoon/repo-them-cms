/**
 * A picture from Notion at the size it is shown, not the size it was
 * uploaded.
 *
 * An editor drops a 4000-pixel photograph into Notion and the site shows it
 * 56 pixels wide; sent as it is, every reader downloads megabytes to see a
 * thumbnail. So an `<img>` asks the media route for a width
 * (`/media/<token>/<name>?w=640`), the route answers with that many pixels
 * as WebP (lib/content/media-resize.ts), and the browser picks from a
 * `srcset`, twice the pixels on a retina screen, so nothing is stretched.
 *
 * Only these widths are ever made. Each is a resize the server pays for and
 * a copy the CDN keeps, so a caller cannot ask for 641, 642, 643…: any other
 * number is rounded up to the next of these.
 *
 * Imports nothing, so a client component and `npm test` load it as it is
 * (tests/media.test.mjs).
 */
export const MEDIA_WIDTHS = [64, 128, 256, 384, 640, 960, 1280, 1920] as const

const LARGEST = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]

/** The width made for one asked for: the next up, the largest at most, and
 *  undefined for what is not a width at all. */
export function mediaWidth(asked: number): number | undefined {
  if (!Number.isFinite(asked) || asked <= 0) return undefined
  return MEDIA_WIDTHS.find((w) => w >= asked) ?? LARGEST
}

/** Only the media route resizes: the site's own files (public/) are already
 *  the size they are shown at, and an address with a query is left alone. */
const resizable = (src: string) => src.startsWith("/media/") && !src.includes("?")

/** A media address at a width. Any other address comes back as it is. */
export function sizedMedia(src: string, width: number): string {
  const w = mediaWidth(width)
  return resizable(src) && w ? `${src}?w=${w}` : src
}

/**
 * The square icons the media route makes from the site's own icon
 * (`site.icon`, lib/share.ts), each a PNG: a browser's tab (32), an
 * iPhone's home screen (180, on white, as iOS fills a clear corner with
 * black), and a home screen's and an installed site's (192, 512). A fixed
 * set, as the widths are, so a caller can never make the server draw one of
 * every size.
 */
export const ICON_SIZES = [32, 180, 192, 512] as const
export type IconSize = (typeof ICON_SIZES)[number]

/** An icon size asked for, if it is one that is made. */
export function iconSize(asked: number): IconSize | undefined {
  return (ICON_SIZES as readonly number[]).includes(asked) ? (asked as IconSize) : undefined
}

/** A media address as the square PNG icon of that size. Any other address
 *  comes back as it is. */
export function iconMedia(src: string, size: IconSize): string {
  return resizable(src) ? `${src}?icon=${size}` : src
}

export type PictureProps = {
  src: string
  srcSet?: string
  sizes?: string
  loading: "lazy" | "eager"
  decoding: "async"
}

/**
 * What an `<img>` needs to load a picture at the size it is shown: spread it
 * on the element.
 *
 * `shown` is the picture's width on the page. A number is a fixed width in
 * CSS pixels (an avatar, a logo): the `srcset` offers that, twice it and
 * three times it. A string is a `sizes` value for a picture whose width
 * follows the page ("(min-width: 768px) 50vw, 100vw"): the `srcset` offers
 * every width.
 *
 * Pictures load when they come near the screen (`loading="lazy"`) unless
 * `eager`, which is for the one picture a page opens on (a cover): that one
 * is fetched with the page.
 */
export function picture(src: string, shown: number | string, { eager = false }: { eager?: boolean } = {}): PictureProps {
  const how = { loading: eager ? "eager" : "lazy", decoding: "async" } as const
  if (!resizable(src)) return { src, ...how }
  if (typeof shown === "number") {
    const widths = [...new Set([1, 2, 3].map((density) => mediaWidth(shown * density) ?? LARGEST))]
    return {
      // twice the size shown, for a browser that reads no srcset
      src: sizedMedia(src, shown * 2),
      srcSet: widths.map((w, i) => `${src}?w=${w} ${i + 1}x`).join(", "),
      ...how,
    }
  }
  return {
    src: sizedMedia(src, 1280),
    srcSet: MEDIA_WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", "),
    sizes: shown,
    ...how,
  }
}
