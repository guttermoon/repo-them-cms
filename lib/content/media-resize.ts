/**
 * A picture made smaller for the media route (app/media/[...parts]/route.ts):
 * the width asked for, as WebP.
 *
 * Why WebP and nothing negotiated: every browser in use reads it, it is a
 * third the size of the JPEG or PNG an editor uploaded, and one format per
 * address means the CDN keeps one copy and never has to look at `Accept`.
 *
 * What is left as it was uploaded (null here, and the route sends the
 * original): a picture that moves (an animated GIF, WebP or PNG), a drawing
 * (SVG, which is sharp at any size already), anything `sharp` cannot read,
 * and a result that came out no smaller than the original.
 *
 * `sharp` is loaded when the first picture is asked for, and a host without
 * it serves originals: slower, never broken.
 *
 * An icon (`?icon=`, ICON_SIZES in lib/media-sizes.ts) is the one shape
 * made as PNG: a home screen and an installed site want PNG, and a square
 * one, so the picture is fitted whole inside the square.
 *
 * Tested in tests/media-resize.test.mjs.
 */

/** Hosts that make a picture at any width themselves (Unsplash's, which is
 *  where Notion's own Unsplash covers come from): asked for the width, they
 *  send a few hundred kilobytes rather than the photographer's original,
 *  often ten megabytes or more. */
const SIZING_HOSTS = new Set(["images.unsplash.com", "plus.unsplash.com"])

/**
 * Where to fetch a picture wanted at `width`: from a host that sizes its
 * own pictures, the address with that width asked for (never wider than the
 * original); from anywhere else, the address as it is, since only this
 * server can make it smaller.
 */
export function sourceAt(url: string, width: number | undefined): string {
  if (!width) return url
  let address: URL
  try {
    address = new URL(url)
  } catch {
    return url
  }
  if (address.protocol !== "https:" || !SIZING_HOSTS.has(address.hostname)) return url
  address.searchParams.set("w", String(width))
  address.searchParams.set("fit", "max")
  address.searchParams.set("q", "85")
  address.searchParams.set("fm", "jpg")
  return address.toString()
}

/** The picture types that are resized. Not GIF (it moves) and not SVG. */
export const RESIZABLE = /^image\/(png|jpe?g|webp|avif|tiff)$/i

/** The most a picture is read into memory to be resized. Larger ones are
 *  streamed on as they are. */
export const MAX_RESIZE_BYTES = 40 * 1024 * 1024

/**
 * The most pixels a picture may hold and still be decoded: 50 megapixels, a
 * large camera's worth. A file can claim far more in a few kilobytes (a
 * "decompression bomb"), and decoding one would take the instance's memory
 * with it; `sharp` refuses before it allocates.
 */
const MAX_PIXELS = 50_000_000

const QUALITY = 80

/** The formats that are decoded, as `sharp` names them: RESIZABLE's. */
const FORMATS = new Set(["png", "jpeg", "webp", "avif", "heif", "tiff"])

type Sharp = typeof import("sharp").default
let loading: Promise<Sharp | null> | undefined

const sharp = () =>
  (loading ??= import("sharp").then(
    // CommonJS: the function is the module, or its default, by who loaded it
    (module) => (module as { default?: Sharp }).default ?? (module as unknown as Sharp),
    () => null,
  ))

/**
 * `input`, opened to be drawn again, or null when it goes as it was sent:
 * without `sharp`, as a type that is not decoded (what the file is, whatever
 * its host called it: a drawing sent as "image/png" is not drawn here), or
 * with more than one frame, since it moves. Throws on a file `sharp` cannot
 * read, or one that holds more than MAX_PIXELS.
 */
async function still(input: Buffer) {
  const make = await sharp()
  if (!make) return null
  const image = make(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
  const meta = await image.metadata()
  if (!meta.format || !FORMATS.has(meta.format) || (meta.pages ?? 1) > 1) return null
  return image
}

/** The picture at `width` pixels wide (never wider than it is) as WebP, or
 *  null when the original should be sent instead. */
export async function resized(input: Buffer, width: number): Promise<Buffer | null> {
  try {
    const image = await still(input)
    if (!image) return null
    const output = await image
      // a phone's photograph is stored on its side with a note saying so
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer()
    return output.length < input.length ? output : null
  } catch {
    return null
  }
}

/** The square icon at `size` pixels, as PNG: the picture fitted whole inside
 *  the square, on a clear ground, or on white for an iPhone's home screen
 *  (180), which fills a clear one with black. Null when the original should
 *  be sent instead (a drawing, a picture that moves, anything unreadable). */
export async function squareIcon(input: Buffer, size: number): Promise<Buffer | null> {
  try {
    const image = await still(input)
    if (!image) return null
    const ground = size === APPLE_ICON ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 }
    return await image
      .rotate()
      .resize({ width: size, height: size, fit: "contain", background: ground })
      .flatten(size === APPLE_ICON ? { background: ground } : false)
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

/** The icon an iPhone puts on its home screen. */
const APPLE_ICON = 180
