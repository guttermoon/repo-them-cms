// A picture at the size it is shown: the widths an <img> asks for
// (lib/media-sizes.ts) and the resize itself (lib/content/media-resize.ts).
import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import sharp from "sharp"

const { ICON_SIZES, MEDIA_WIDTHS, iconMedia, iconSize, mediaWidth, picture, sizedMedia } = await import("../lib/media-sizes.ts")
const { RESIZABLE, resized, sourceAt, squareIcon } = await import("../lib/content/media-resize.ts")

const MEDIA = "/media/abc.def/cover.png"

/** A photograph-like picture: noise, so it does not compress to nothing. */
const photo = async (width, height, format = "png") => {
  return sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } })[format]().toBuffer()
}

// ------------------------------------------------------------ the widths

test("only a fixed set of widths is ever made, and any other is rounded up to one", () => {
  assert.equal(mediaWidth(640), 640)
  assert.equal(mediaWidth(641), 960)
  assert.equal(mediaWidth(1), 64)
  assert.equal(mediaWidth(99_999), 1920)
  for (const none of [0, -5, NaN, Infinity]) assert.equal(mediaWidth(none), undefined, String(none))
  const made = new Set()
  for (let asked = 1; asked <= 5000; asked++) made.add(mediaWidth(asked))
  assert.deepEqual([...made], [...MEDIA_WIDTHS], "5,000 different requests make eight pictures")
})

test("only a media address is given a width", () => {
  assert.equal(sizedMedia(MEDIA, 300), `${MEDIA}?w=384`)
  assert.equal(sizedMedia("/demo/cover.png", 300), "/demo/cover.png", "the site's own file is already the size it is shown")
  assert.equal(sizedMedia(`${MEDIA}?w=64`, 300), `${MEDIA}?w=64`)
  assert.equal(sizedMedia("https://elsewhere.example/a.png", 300), "https://elsewhere.example/a.png")
})

test("a picture of a fixed size offers that size, twice it and three times it", () => {
  const props = picture(MEDIA, 160)
  assert.equal(props.srcSet, `${MEDIA}?w=256 1x, ${MEDIA}?w=384 2x, ${MEDIA}?w=640 3x`)
  assert.equal(props.src, `${MEDIA}?w=384`, "twice the size shown, for a browser that reads no srcset")
  assert.equal(props.sizes, undefined)
  assert.equal(props.loading, "lazy")
  assert.equal(props.decoding, "async")
})

test("a picture that follows the page offers every width, and says how wide it is shown", () => {
  const props = picture(MEDIA, "(min-width: 768px) 50vw, 100vw")
  assert.equal(props.sizes, "(min-width: 768px) 50vw, 100vw")
  assert.deepEqual(
    props.srcSet.split(", "),
    MEDIA_WIDTHS.map((w) => `${MEDIA}?w=${w} ${w}w`),
  )
})

test("the picture a page opens on loads with the page; the site's own files are left as they are", () => {
  assert.equal(picture(MEDIA, "100vw", { eager: true }).loading, "eager")
  assert.equal(picture(MEDIA, "100vw", { eager: true }).fetchPriority, "high", "and before anything else on the page")
  assert.equal(picture(MEDIA, "100vw").fetchPriority, undefined, "a picture further down waits its turn")
  assert.deepEqual(picture("/demo/cover.png", "100vw"), { src: "/demo/cover.png", loading: "lazy", decoding: "async" })
})

// ------------------------------------------------------------ the resize

test("a photograph comes back at the width asked for, as WebP, and far smaller", async () => {
  const original = await photo(2400, 1600)
  const small = await resized(original, 640)
  assert.ok(small, "resized")
  const meta = await sharp(small).metadata()
  assert.equal(meta.format, "webp")
  assert.equal(meta.width, 640)
  assert.equal(meta.height, 427, "its shape is kept")
  assert.ok(small.length < original.length / 10, `${small.length} of ${original.length} bytes`)
})

test("a picture is never made wider than it is", async () => {
  const small = await resized(await photo(300, 200), 1920)
  assert.equal((await sharp(small).metadata()).width, 300)
})

test("a photograph stored on its side is turned upright", async () => {
  const sideways = await sharp(await photo(400, 200, "jpeg")).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const meta = await sharp(await resized(sideways, 128)).metadata()
  assert.ok(meta.height > meta.width, `${meta.width}×${meta.height}`)
})

test("what cannot or should not be resized is left as it was uploaded", async () => {
  assert.equal(await resized(Buffer.from("not a picture at all"), 640), null)
  assert.equal(await resized(Buffer.alloc(0), 640), null)
  const moving = await sharp([await photo(64, 64), await photo(64, 64)], { join: { animated: true } }).webp({ loop: 0, delay: [100, 100] }).toBuffer()
  assert.equal((await sharp(moving).metadata()).pages, 2, "the test's picture does move")
  assert.equal(await resized(moving, 64), null, "a picture that moves keeps moving")
})

test("a drawing its host called a photograph is not drawn here", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><rect width="2000" height="2000" fill="red"/></svg>'.padEnd(200_000, " "))
  assert.equal((await sharp(svg).metadata()).format, "svg", "sharp would read it")
  assert.equal(await resized(svg, 64), null)
})

test("a picture that claims more pixels than any camera makes is not decoded", async () => {
  // 10,000 × 10,000 of one colour: a few kilobytes on disk, 300 MB decoded
  const bomb = await sharp({ create: { width: 10_000, height: 10_000, channels: 3, background: "#fff" } }).png().toBuffer()
  assert.ok(bomb.length < 1_000_000, "small on disk")
  assert.equal(await resized(bomb, 640), null)
})

test("only still pictures are resized: never a GIF, a drawing or a document", () => {
  for (const type of ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"]) assert.ok(RESIZABLE.test(type), type)
  for (const type of ["image/gif", "image/svg+xml", "application/pdf", "video/mp4", "text/html", "image/png+xml"]) assert.ok(!RESIZABLE.test(type), type)
})

test("a host that sizes its own pictures (Notion's Unsplash covers) is asked for the width, not the original", () => {
  const original = "https://images.unsplash.com/photo-1500000000000-abc?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb"
  const asked = new URL(sourceAt(original, 960))
  assert.equal(asked.hostname, "images.unsplash.com")
  assert.equal(asked.searchParams.get("w"), "960")
  assert.equal(asked.searchParams.get("fit"), "max", "never wider than the photograph")
  assert.equal(asked.searchParams.get("ixlib"), "rb-4.0.3", "the rest of the address is kept")
  // with no width, and from any other host, the address is fetched as it is
  assert.equal(sourceAt(original, undefined), original)
  assert.equal(sourceAt("https://prod-files-secure.s3.us-west-2.amazonaws.com/a/photo.jpg?X-Amz-Signature=x", 960), "https://prod-files-secure.s3.us-west-2.amazonaws.com/a/photo.jpg?X-Amz-Signature=x")
  assert.equal(sourceAt("http://images.unsplash.com/photo-1?x=1", 960), "http://images.unsplash.com/photo-1?x=1", "only https")
  assert.equal(sourceAt("not an address", 960), "not an address")
})

// ------------------------------------------------------------ the icons

test("an icon is made at one of a fixed set of sizes, and any other is no icon", () => {
  assert.deepEqual([...ICON_SIZES], [32, 180, 192, 512])
  for (const size of ICON_SIZES) assert.equal(iconSize(size), size)
  for (const none of [0, 31, 100, 1024, NaN, -32]) assert.equal(iconSize(none), undefined, String(none))
  assert.equal(iconMedia(MEDIA, 192), `${MEDIA}?icon=192`)
  assert.equal(iconMedia("/demo/logo.png", 192), "/demo/logo.png", "the site's own files are left as they are")
})

test("an icon is a square PNG of its size, the picture fitted whole inside on a clear ground", async () => {
  const wide = await photo(600, 300, "jpeg")
  const icon = await squareIcon(wide, 192)
  const meta = await sharp(icon).metadata()
  assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ["png", 192, 192, true])
  const { data } = await sharp(icon).raw().toBuffer({ resolveWithObject: true })
  assert.equal(data[3], 0, "the corner above a wide picture is clear")
  assert.equal(data[(96 * 192 + 96) * 4 + 3], 255, "the middle is the picture")
  // a small picture is drawn up to the size, never left small in a corner
  assert.equal((await sharp(await squareIcon(await photo(40, 40), 512)).metadata()).width, 512)
})

test("an iPhone's icon is on white, since iOS fills a clear corner with black", async () => {
  const icon = await squareIcon(await photo(600, 300), 180)
  const { data, info } = await sharp(icon).raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, 180)
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255], "the corner is white")
  assert.ok(info.channels === 3 || data[3] === 255, "and not clear")
})

test("an icon is made only from a still picture: a drawing or a moving one is sent as uploaded", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64"/></svg>')
  assert.equal(await squareIcon(svg, 192), null)
  const gif = await sharp(await photo(8, 8), { animated: false }).gif().toBuffer()
  const moving = await sharp([gif, gif], { join: { animated: true } }).gif().toBuffer().catch(() => null)
  if (moving) assert.equal(await squareIcon(moving, 192), null)
  assert.equal(await squareIcon(Buffer.from("not a picture"), 192), null)
})
