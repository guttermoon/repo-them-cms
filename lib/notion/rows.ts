/**
 * Reading rows of the site's Notion database into what the site uses: the
 * copy (a map of slot key → words) and the entries (every Page, Post,
 * Resource and Redirect, as plain data).
 *
 * Nothing here talks to Notion or to Next: it takes the rows a query
 * returned and gives back data, so `npm test` loads it as it is
 * (tests/notion-rows.test.mjs) and the build-time snapshot reads rows the
 * same way the site does.
 */
import { notionIconColor, notionIconUrl, type NotionIconColor } from "../icons"
import { styledText } from "../inline-text"
import type { MenuRow } from "../menus"
import type { SectionRow } from "../sections"
import { COVER_POSITIONS, FORMER_KINDS, FORMER_NAMES, KINDS, PROPS, RESERVED_SEGMENTS, type Kind, type NotionColor } from "./schema"

/** The parts of a Notion rich-text run this site reads. */
export type RichRun = {
  type?: string
  plain_text?: string
  href?: string | null
  annotations?: Partial<Annotations>
  text?: { content?: string; link?: { url?: string } | null }
  mention?: Record<string, unknown> & { type?: string }
  equation?: { expression?: string }
}

export type Annotations = {
  bold: boolean
  italic: boolean
  strikethrough: boolean
  underline: boolean
  code: boolean
  color: string
}

type FileValue = {
  name?: string
  type?: string
  file?: { url?: string }
  external?: { url?: string }
  file_upload?: { id?: string }
}

type Property = {
  type?: string
  title?: RichRun[]
  rich_text?: RichRun[]
  checkbox?: boolean
  select?: { name?: string; color?: string } | null
  multi_select?: { name?: string; color?: string }[]
  status?: { name?: string; color?: string } | null
  date?: { start?: string; end?: string | null; time_zone?: string | null } | null
  number?: number | null
  url?: string | null
  files?: FileValue[]
}

export type IconValue =
  | { type: "emoji"; emoji?: string }
  | { type: "external"; external?: { url?: string } }
  | { type: "file"; file?: { url?: string } }
  | { type: "custom_emoji"; custom_emoji?: { url?: string; name?: string } }
  | { type: "icon"; icon?: { name?: string; color?: string } }
  | { type?: string }

/** A page from a data-source query, as far as this site cares. */
export type NotionRow = {
  id?: string
  object?: string
  created_time?: string
  last_edited_time?: string
  in_trash?: boolean
  archived?: boolean
  icon?: IconValue | null
  cover?: { type?: string; external?: { url?: string }; file?: { url?: string } } | null
  properties?: Record<string, Property | undefined>
}

/** One page of a query's answer. */
export type RowsPage = { results: unknown[]; has_more: boolean; next_cursor: string | null }

/** A tag-like value: a select option, with Notion's colour for it. */
export type Tag = { name: string; color: NotionColor }

/**
 * Where a picture or a file lives in Notion, without its address: Notion's
 * own file addresses expire after an hour, so the site never prints one.
 * `lib/content/media.ts` signs one of these into a /media/ URL on this site,
 * and the media route asks Notion for a fresh address when it is fetched.
 * An outside (external) address is kept, because it does not expire; the
 * route fetches it too, so a reader's browser never contacts the host.
 */
export type MediaRef = {
  /** the page or block that holds the file */
  owner: "page" | "block"
  id: string
  /** which of the owner's files */
  field: "cover" | "icon" | "prop" | "block"
  prop?: string
  index?: number
  /** the owner's last edit: a new upload changes it, and with it the URL */
  v: string
  /** for an external file, its address */
  external?: string
  name?: string
}

/**
 * A page's icon: an emoji, a picture (fetched through /media/), or one of
 * Notion's own icons by name and colour (drawn with the site's icon of that
 * name, else fetched as Notion draws it, through /media/).
 */
export type Icon =
  | { type: "emoji"; emoji: string }
  | { type: "image"; media: MediaRef }
  | { type: "native"; name: string; color: NotionIconColor; media: MediaRef }

export type Author = {
  name: string
  bio: string
  image?: MediaRef
  /** where the portrait is cut, as the Person row's Cover Position says */
  at?: number
  /** their job title: the Person row's Description, when they have one */
  role?: string
}

export type Font = "default" | "serif" | "mono"

/** A Page, Post, Resource or Redirect, as plain data. */
/** A Shopify variant: what the reader picks, and its ID. */
export type Variant = { label: string; id: string }

export type Entry = {
  id: string
  kind: Exclude<Kind, "Site Copy">
  title: string
  /** Pages and posts: the path below their root, without slashes at either
   *  end ("about", "guides/setup"). Redirects: the short link's slug.
   *  Resources: "". */
  slug: string
  /** With its links and formatting (lib/inline-text.ts), like `text` */
  description: string
  created: string
  lastEdited: string
  /** the Published Date's start, as Notion gives it (a date or a datetime) */
  date?: string
  category?: Tag
  tags: Tag[]
  author?: Author
  cover?: MediaRef
  /** where the cover is cut, from the top (0) to the bottom (100): the
   *  Cover Position property, or the middle */
  coverAt?: number
  /** false when Cover Tint is Off: the cover is shown as uploaded, not
   *  printed in the look's ink (lib/cover.ts) */
  coverTint: boolean
  /** a Person: shown on /team and /about (Team Page not Off) */
  team?: boolean
  icon?: Icon
  order?: number
  featured: boolean
  featureBlock?: number
  font: Font
  fullWidth: boolean
  action?: string
  link?: string
  /** Pages: how the body is set */
  layout: "article" | "landing"
  /** Plans, quotes, questions, people and reviews: the Text property, with
   *  its links and formatting (lib/inline-text.ts): print it with
   *  LinkedText, read it as a string with `inlineWords` */
  text?: string
  /** Plans and products */
  price?: number
  yearlyPrice?: number
  currency?: string
  priceNote?: string
  compareAt?: number
  gallery?: MediaRef[]
  stock?: Tag
  /** Products sold through Shopify */
  variants?: Variant[]
  /** Plans: the button's words */
  button?: string
  /** Reviews: the stars given, 1 to 5 */
  rating?: number
}

export type SiteCopy = Record<string, string>

/**
 * A picture a Site Copy row carries: where it is, and how its row says it
 * is drawn where that matters (the hero's: lib/share.ts), as a cover's is:
 * `tint` false for Cover Tint Off, `at` for Cover Position. Neither is in
 * its signed address.
 */
export type SitePicture = MediaRef & { tint?: false; at?: number }

/**
 * The pictures Site Copy rows carry, by slot: a ticked row's Notion cover,
 * else its Image. A share picture (`meta.<page>.image`,
 * `meta.site.image`), the site's logo (`site.logo`) or the picture under
 * the home page's hero (`home.hero.image`); the row's Text is its words for
 * whoever cannot see it (lib/share.ts).
 */
export type SitePictures = Record<string, SitePicture>

/** Everything the site reads from Notion, minus the page bodies. */
export type SiteData = { copy: SiteCopy; entries: Entry[]; pictures?: SitePictures; sections?: SectionRow[]; menus?: MenuRow[] }

export const EMPTY_SITE_DATA: SiteData = { copy: {}, entries: [] }

// ---------------------------------------------------------------- rich text

/** The runs as plain text. */
export function plainText(runs: RichRun[] | undefined): string {
  return (runs ?? []).map((run) => run.plain_text ?? "").join("")
}

// ---------------------------------------------------------------- properties

/** The name a row has a property under: its own, or the one it had before
 *  it was renamed (FORMER_NAMES) when a database made before the rename
 *  still uses that. */
export function propertyName(row: NotionRow, name: string): string {
  const former = FORMER_NAMES[name]
  return row.properties?.[name] === undefined && former && row.properties?.[former] !== undefined ? former : name
}

/** A row's property by its name, or by its former name, so a database made
 *  before a rename reads the same. */
export function rowProperty(row: NotionRow, name: string): Property | undefined {
  return row.properties?.[propertyName(row, name)]
}
const prop = rowProperty

/** A row's title, whatever the title property happens to be called. */
export function rowTitle(row: NotionRow): string {
  const title = Object.values(row.properties ?? {}).find((p) => p?.type === "title")
  return plainText(title?.title).trim()
}

/** A rich-text property as text: its words alone, or, `styled`, with its
 *  links and formatting as lib/inline-text.ts keeps them, for words a page
 *  prints (<T>, LinkedText) and a string reads with `inlineWords`. */
export function rowText(row: NotionRow, name: string = PROPS.text, { styled = false }: { styled?: boolean } = {}): string {
  const runs = prop(row, name)?.rich_text
  return styled ? styledText(runs) : plainText(runs)
}

const COLORS: readonly string[] = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]
const color = (raw: string | undefined): NotionColor => (raw && COLORS.includes(raw) ? (raw as NotionColor) : "default")

export function selectOf(row: NotionRow, name: string): Tag | undefined {
  const p = prop(row, name)
  const value = p?.select ?? p?.status
  const optionName = value?.name?.trim()
  return optionName ? { name: optionName, color: color(value?.color) } : undefined
}

export function multiSelectOf(row: NotionRow, name: string): Tag[] {
  return (prop(row, name)?.multi_select ?? [])
    .filter((o) => o.name?.trim())
    .map((o) => ({ name: (o.name as string).trim(), color: color(o.color) }))
}

export const checkboxOf = (row: NotionRow, name: string): boolean => prop(row, name)?.checkbox === true

/** Stars, whole, 1 to 5: anything else is no rating. */
export function ratingOf(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  const stars = Math.round(value)
  return stars >= 1 && stars <= 5 ? stars : undefined
}

export function numberOf(row: NotionRow, name: string): number | undefined {
  const n = prop(row, name)?.number
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

/**
 * A date property's start as the site keeps it: a date alone stays a date,
 * and a time is one exact moment, with its offset. Notion writes a time
 * picked in its date picker with the offset of the zone picked there; one
 * given with a named zone and no offset (`time_zone`) takes that zone's
 * offset at that moment, summer time and all, so "16:00, Europe/London" is
 * 16:00 in London. A time with neither is UTC. The date part is left as
 * written, so the day printed is the day in Notion.
 */
export function dateOf(row: NotionRow, name: string): string | undefined {
  const date = prop(row, name)?.date
  return date?.start ? zonedTime(date.start, date.time_zone) : undefined
}

/** A Notion date's start, with the offset its zone keeps at that time when
 *  it has a time and no offset of its own (see dateOf). */
export function zonedTime(start: string, zone?: string | null): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) || /(?:Z|[+-]\d{2}:\d{2})$/i.test(start)) return start
  return start + (zone ? offsetIn(zone, start) : "Z")
}

/** The UTC offset ("+01:00") a named zone keeps at a wall-clock time, or "Z"
 *  for a zone nobody knows. The zone's offset is read where that wall time
 *  falls, then read again there, so a change of clocks between the two is
 *  caught. */
export function offsetIn(zone: string, wall: string): string {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return "Z"
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return "Z"
  }
  // how far the zone's clock runs ahead of UTC at a moment
  const ahead = (t: number) => {
    const part = Object.fromEntries(format.formatToParts(new Date(t)).map((p) => [p.type, Number(p.value)]))
    return Date.UTC(part.year, part.month - 1, part.day, part.hour % 24, part.minute, part.second) - t
  }
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  const minutes = Math.round(ahead(asUtc - ahead(asUtc)) / 60000)
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`
}

export function urlOf(row: NotionRow, name: string): string | undefined {
  const p = prop(row, name)
  const raw = p?.url ?? (p?.rich_text ? plainText(p.rich_text) : undefined)
  return raw?.trim() || undefined
}

/**
 * A file's version, for its address on this site (lib/content/media.ts),
 * which browsers and the CDN keep for a year: it changes when the file does,
 * and only then. Notion's address for a file it hosts keeps its path (the
 * workspace, the file's own id, its name) and changes only its signature,
 * hourly; an outside file's address is the file. So the version is a hash
 * of the host and the path, and the row's or block's last edit only where
 * there is no address to read. An edit to a post's words then leaves its
 * pictures' addresses, and every cache of them, as they were.
 */
export function fileVersion(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  let where: string
  try {
    const parsed = new URL(url)
    where = `${parsed.host}${parsed.pathname}`
  } catch {
    return fallback
  }
  // FNV-1a from two starting points: 64 bits, as 16 hex characters
  let a = 0x811c9dc5
  let b = 0x050c5d1f
  for (let i = 0; i < where.length; i++) {
    const c = where.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x01000193) >>> 0
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0")
}

/** The address of the file an icon shows, where Notion gives one. */
export function iconFileUrl(icon: IconValue | null | undefined): string | undefined {
  if (!icon) return undefined
  if (icon.type === "file" && "file" in icon) return icon.file?.url
  if (icon.type === "custom_emoji" && "custom_emoji" in icon) return icon.custom_emoji?.url
  if (icon.type === "external" && "external" in icon) return icon.external?.url
  return undefined
}

/** A files property's files as media references, in order. */
export function filesOf(row: NotionRow, name: string): MediaRef[] {
  // the name the database has it under, which the media route asks Notion for
  const named = propertyName(row, name)
  const files = prop(row, name)?.files ?? []
  return files.flatMap((f, index) => {
    if (!row.id) return []
    const external = f.type === "external" ? f.external?.url?.trim() : undefined
    if (f.type === "external" && !external) return []
    return [
      {
        owner: "page" as const,
        id: row.id,
        field: "prop" as const,
        prop: named,
        index,
        v: fileVersion(external ?? f.file?.url, row.last_edited_time ?? ""),
        ...(external ? { external } : {}),
        ...(f.name ? { name: f.name } : {}),
      },
    ]
  })
}

/** The page's own Notion cover, the one Notion draws above its title. */
function pageCoverOf(row: NotionRow): MediaRef | undefined {
  const cover = row.cover
  if (!cover || !row.id) return undefined
  if (cover.type === "external") {
    const url = cover.external?.url?.trim()
    return url ? { owner: "page", id: row.id, field: "cover", v: fileVersion(url, row.last_edited_time ?? ""), external: url } : undefined
  }
  if (cover.type === "file") return { owner: "page", id: row.id, field: "cover", v: fileVersion(cover.file?.url, row.last_edited_time ?? "") }
  return undefined
}

/**
 * A row's picture. A page or a post is shown as Notion shows it: its own
 * cover above the title (Change, Upload or Unsplash in Notion), and the
 * Image property only when it has none. Everything else (a product, a
 * person, a logo) is its Image, which is the thing itself rather than
 * a banner, and the page's cover only when that is empty.
 */
function coverOf(row: NotionRow, kind: Kind): MediaRef | undefined {
  const fromProperty = filesOf(row, PROPS.cover)[0]
  const fromPage = pageCoverOf(row)
  return kind === "Page" || kind === "Post" ? (fromPage ?? fromProperty) : (fromProperty ?? fromPage)
}

/** Where a cover is cut, from the top (0) to the bottom (100): Cover
 *  Position (COVER_POSITIONS), which Notion's own Reposition cannot be (its
 *  API does not say where a cover was moved to). Unset: the middle. */
function coverAtOf(row: NotionRow): number | undefined {
  const name = selectOf(row, PROPS.coverPosition)?.name
  return name !== undefined && Object.hasOwn(COVER_POSITIONS, name) ? COVER_POSITIONS[name as keyof typeof COVER_POSITIONS] : undefined
}

/** Whether a cover is printed in the look's ink: yes, unless Cover Tint
 *  says Off. Empty, or a choice the site doesn't know, is On, so a row
 *  nobody touched looks as every other. */
function coverTintOf(row: NotionRow): boolean {
  return selectOf(row, PROPS.coverTint)?.name !== "Off"
}

function iconOf(row: NotionRow): Icon | undefined {
  if (!row.id) return undefined
  const id = row.id
  const icon = row.icon as IconValue | null | undefined
  return iconFrom(icon, (external) => ({
    owner: "page",
    id,
    field: "icon",
    v: fileVersion(external ?? iconFileUrl(icon), row.last_edited_time ?? ""),
    ...(external ? { external } : {}),
  }))
}

/**
 * An icon as Notion's API gives it (a page's, or a callout's), as plain data.
 * `ref` names where its picture is fetched from, given the address of one
 * hosted elsewhere.
 */
export function iconFrom(icon: IconValue | null | undefined, ref: (external?: string) => MediaRef): Icon | undefined {
  if (!icon) return undefined
  if (icon.type === "emoji" && "emoji" in icon && icon.emoji) return { type: "emoji", emoji: icon.emoji }
  if (icon.type === "external" && "external" in icon) {
    const url = icon.external?.url?.trim()
    return url ? { type: "image", media: ref(url) } : undefined
  }
  if (icon.type === "icon" && "icon" in icon && icon.icon?.name) {
    const color = notionIconColor(icon.icon.color)
    return { type: "native", name: icon.icon.name, color, media: ref(notionIconUrl(icon.icon.name, color)) }
  }
  // a Notion upload or a workspace's custom emoji: both are files Notion
  // hosts, fetched fresh by the media route
  if (icon.type === "file" || icon.type === "custom_emoji") return { type: "image", media: ref() }
  return undefined
}

// ---------------------------------------------------------------- slugs

/** Lowercase ASCII words joined by hyphens: "Hello, World!" → "hello-world". */
export function slugify(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * A slug for words with no Latin letter in them ("ニュース"), which `slugify`
 * leaves empty: the letters and digits of any script, joined by hyphens.
 * Used only where `slugify` gives nothing, so no address that exists changes.
 */
export function wordSlug(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

/** A page's path from its Slug, or from its title when Slug is empty: each
 *  segment slugified, so "Guides / Set Up" is "guides/set-up". `segments`
 *  1 is for a post, which lives one level under /blog: its
 *  slashes join as hyphens, so "CI/CD basics" is "ci-cd-basics". */
export function pathSlug(slug: string, title: string, segments?: 1): string {
  const source = slug.trim() || title
  return source
    .split("/")
    .map((part) => slugify(part) || wordSlug(part))
    .filter(Boolean)
    .join(segments === 1 ? "-" : "/")
}

/** Short-link slugs are compared lowercased: a QR code is read by machines,
 *  but the URL under it gets typed by people. */
export const normaliseShortSlug = (raw: string): string => raw.trim().toLowerCase().replace(/^\/+|\/+$/g, "")

export const isReservedPath = (slug: string): boolean =>
  (RESERVED_SEGMENTS as readonly string[]).includes(slug.split("/")[0])

// ---------------------------------------------------------------- rows

const FONTS: Record<string, Font> = { default: "default", serif: "serif", mono: "mono" }

/**
 * Checkout ID as Shopify variants: one ID, or one "Label: ID" a line. An ID
 * is digits (Shopify's own, or the end of its gid://shopify/ProductVariant/…
 * form); a line without one is left out rather than guessed at.
 */
export function variantsOf(raw: string): Variant[] {
  const out: Variant[] = []
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim()
    const id = /(\d{5,})\s*$/.exec(text)?.[1]
    if (!id) continue
    // "Small: 401…" is labelled; "gid://shopify/…" is not ("gid" is no label)
    const named = /^([^:]+):\s*(.+)$/.exec(text)
    const label = named && named[1].trim().toLowerCase() !== "gid" && named[1].trim() !== id ? named[1].trim() : ""
    out.push({ label, id })
  }
  return out
}

/** Kinds that have a page of their own, at their own address. */
const ADDRESSED: readonly Kind[] = ["Page", "Post", "Product"]

/** One row as a copy pair (with the picture a ticked one carries) or an
 *  entry, or nothing for a row the site does not use (no Kind, no title,
 *  archived). */
export function readRow(
  row: NotionRow,
): { copy: [string, string]; picture?: SitePicture } | { entry: Entry } | { section: SectionRow } | { menu: MenuRow } | null {
  if (row.in_trash || row.archived) return null
  const named = selectOf(row, PROPS.kind)?.name
  // a Kind under its former name is the Kind it became
  const kindName = named ? (FORMER_KINDS[named] ?? named) : undefined
  if (!kindName || !(KINDS as readonly string[]).includes(kindName)) return null
  const kind = kindName as Kind
  const title = rowTitle(row)
  if (!title) return null

  const published = checkboxOf(row, PROPS.published)
  // A text slot's row is read ticked or not: a ticked row gives its words
  // (left empty, it hides the slot), an unticked one hides the slot. A slot
  // with no row at all shows nothing too once Notion is connected; only the
  // starter site shows the words written into the code (FROM_NOTION).
  if (kind === "Site Copy") {
    // a picture only while ticked, as anything shown on the site
    const file = published ? (pageCoverOf(row) ?? filesOf(row, PROPS.cover)[0]) : undefined
    const at = coverAtOf(row)
    const picture: SitePicture | undefined = file && { ...file, ...(coverTintOf(row) ? {} : { tint: false as const }), ...(at !== undefined ? { at } : {}) }
    return { copy: [title, published ? rowText(row, PROPS.text, { styled: true }) : ""], ...(picture ? { picture } : {}) }
  }
  // A section's row is read ticked or not too: unticked, it takes its
  // section off the page (lib/sections.ts)
  if (kind === "Section") {
    if (!row.id) return null
    const page = rowText(row, PROPS.slug).trim()
    const order = numberOf(row, PROPS.order)
    return { section: { id: row.id, key: title, on: published, ...(page ? { page } : {}), ...(order === undefined ? {} : { order }), ...(row.created_time ? { created: row.created_time } : {}) } }
  }
  // and a menu's link's: unticked, it takes the link off its menu
  // (lib/menus.ts)
  if (kind === "Menu") {
    if (!row.id) return null
    const menu = rowText(row, PROPS.slug).trim()
    const order = numberOf(row, PROPS.order)
    // a Link goes there instead of a page, with the Title as its words
    const link = urlOf(row, PROPS.link)?.trim()
    return {
      menu: {
        id: row.id,
        page: title,
        on: published,
        ...(menu ? { menu } : {}),
        ...(link ? { link } : {}),
        ...(order === undefined ? {} : { order }),
        ...(row.created_time ? { created: row.created_time } : {}),
      },
    }
  }
  // anything else is on the site only while it is ticked
  if (!published || !row.id) return null

  const slugSource = rowText(row, PROPS.slug)
  const slug = kind === "Redirect" ? normaliseShortSlug(title) : ADDRESSED.includes(kind) ? pathSlug(slugSource, title, kind === "Post" ? 1 : undefined) : ""
  if ((ADDRESSED.includes(kind) || kind === "Redirect") && !slug) return null
  // a product's address is one segment under /shop
  if (kind === "Product" && slug.includes("/")) return null

  const authorName = rowText(row, PROPS.author).trim()
  // a quotation names its speaker in Title, and who they are in Author Bio;
  // a person is the author of whatever they write, their Author Bio the line
  // under it (withAuthors). Any other row names its author, and nothing
  // more: a byline is a Person row.
  const authorBio = kind === "Quote" || kind === "Person" ? rowText(row, PROPS.authorBio, { styled: true }).trim() : ""
  const speaker = (kind === "Quote" && authorBio) || kind === "Person" ? title : ""
  const author: Author | undefined =
    authorName || speaker
      ? {
          name: authorName || speaker,
          bio: authorBio,
        }
      : undefined

  const link = urlOf(row, PROPS.link) ?? (kind === "Redirect" ? rowText(row).trim() || undefined : undefined)
  const fontName = selectOf(row, PROPS.font)?.name.toLowerCase() ?? "default"

  const entry: Entry = {
    id: row.id,
    kind,
    title,
    slug,
    description: rowText(row, PROPS.description, { styled: true }).trim(),
    created: row.created_time ?? "",
    lastEdited: row.last_edited_time ?? "",
    date: dateOf(row, PROPS.publishedDate),
    category: selectOf(row, PROPS.category),
    tags: multiSelectOf(row, PROPS.tags),
    author,
    cover: coverOf(row, kind),
    coverAt: coverAtOf(row),
    coverTint: coverTintOf(row),
    ...(kind === "Person" ? { team: selectOf(row, PROPS.teamPage)?.name !== "Off" } : {}),
    icon: iconOf(row),
    order: numberOf(row, PROPS.order),
    featured: checkboxOf(row, PROPS.featured),
    featureBlock: numberOf(row, PROPS.featureBlock),
    font: FONTS[fontName] ?? "default",
    fullWidth: checkboxOf(row, PROPS.fullWidth),
    action: selectOf(row, PROPS.action)?.name,
    link,
    layout: selectOf(row, PROPS.layout)?.name.toLowerCase() === "landing" ? "landing" : "article",
    text: kind === "Plan" || kind === "Quote" || kind === "Question" || kind === "Person" || kind === "Review" ? rowText(row, PROPS.text, { styled: true }).trim() : undefined,
    price: numberOf(row, PROPS.price),
    yearlyPrice: numberOf(row, PROPS.yearlyPrice),
    currency: selectOf(row, PROPS.currency)?.name,
    priceNote: rowText(row, PROPS.priceNote).trim() || undefined,
    compareAt: numberOf(row, PROPS.compareAt),
    gallery: kind === "Product" ? filesOf(row, PROPS.gallery) : undefined,
    stock: selectOf(row, PROPS.stock),
    variants: kind === "Product" ? variantsOf(rowText(row, PROPS.checkoutId)) : undefined,
    button: rowText(row, PROPS.button).trim() || undefined,
    rating: kind === "Review" ? ratingOf(numberOf(row, PROPS.rating)) : undefined,
  }
  // undefined fields are dropped so the cached JSON stays small
  return { entry: JSON.parse(JSON.stringify(entry)) as Entry }
}

/** Every row of a query as the site's data. Of two rows for one slot, a
 *  ticked one beats an unticked one, and otherwise the first wins, as Notion
 *  sorts them, so the answer does not change between requests. */
export function readRows(rows: NotionRow[]): SiteData {
  const copy: SiteCopy = {}
  const pictures: SitePictures = {}
  const fromUnticked = new Set<string>()
  const entries: Entry[] = []
  const sections: SectionRow[] = []
  const menus: MenuRow[] = []
  for (const row of rows) {
    const read = readRow(row)
    if (!read) continue
    if ("section" in read) {
      sections.push(read.section)
    } else if ("menu" in read) {
      menus.push(read.menu)
    } else if ("copy" in read) {
      const [key, value] = read.copy
      const ticked = checkboxOf(row, PROPS.published)
      if (!(key in copy) || (ticked && fromUnticked.has(key))) {
        copy[key] = value
        if (ticked) fromUnticked.delete(key)
        else fromUnticked.add(key)
        // the row whose words win is the row whose picture is shown
        if (read.picture) pictures[key] = read.picture
        else delete pictures[key]
      }
    } else {
      entries.push(read.entry)
    }
  }
  return {
    copy,
    entries: withAuthors(entries),
    ...(Object.keys(pictures).length ? { pictures } : {}),
    ...(sections.length ? { sections } : {}),
    ...(menus.length ? { menus } : {}),
  }
}

/** A person's name as a post's Author is matched to it: any case, any spacing. */
export const personKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase()

/**
 * Every post's author as their Person row has them, so a writer is one entry
 * shared with the team (docs/notion.md, "Authors"): the name as the row
 * writes it, their job title (Description), the line under their posts
 * (Author Bio, else their Text) and their one picture (Image), cut where
 * its Cover Position says. What the team card shows is what
 * every byline shows. A guest is a Person row too, with Team Page Off; a
 * name with no Person row is printed alone. Matched by name, in any case
 * and spacing.
 */
export function withAuthors(entries: Entry[]): Entry[] {
  const people = new Map<string, Entry>()
  for (const entry of entries) if (entry.kind === "Person" && !people.has(personKey(entry.title))) people.set(personKey(entry.title), entry)
  return entries.map((entry) => {
    const own = entry.kind === "Post" ? entry.author : undefined
    const person = own && people.get(personKey(own.name))
    if (!own || !person) return entry
    const author: Author = {
      name: person.title,
      bio: person.author?.bio || person.text || "",
      ...(person.cover ? { image: person.cover } : {}),
      ...(person.cover && person.coverAt !== undefined ? { at: person.coverAt } : {}),
      ...(person.description ? { role: person.description } : {}),
    }
    return { ...entry, author }
  })
}

/** The body of a data-source query for every ticked row, and every text
 *  slot's, section's and menu link's row ticked or not (an unticked one
 *  hides its slot, or takes its section off the page or its link off the
 *  menu), a page at a time. */
export function publishedQuery(cursor?: string) {
  return {
    filter: {
      or: [
        { property: PROPS.published, checkbox: { equals: true } },
        { property: PROPS.kind, select: { equals: "Site Copy" } },
        { property: PROPS.kind, select: { equals: "Section" } },
        { property: PROPS.kind, select: { equals: "Menu" } },
      ],
    },
    ...(cursor ? { start_cursor: cursor } : {}),
    page_size: 100,
  }
}

/**
 * Every Published row, in as many pages as it takes. `query` makes one
 * request and is called once per page, in order, never in parallel: Notion
 * allows about three requests a second across the whole integration.
 */
export async function publishedRows(
  query: (body: ReturnType<typeof publishedQuery>) => Promise<RowsPage>,
): Promise<NotionRow[]> {
  return everyRow(query, publishedQuery)
}

/** Every row a query's pages hold, a hundred to a request: `body` gives the
 *  query for each page's cursor. The rows only: a data source listed among
 *  the results is left out. */
export async function everyRow<B>(query: (body: B) => Promise<RowsPage>, body: (cursor?: string) => B): Promise<NotionRow[]> {
  const rows: NotionRow[] = []
  let cursor: string | undefined
  do {
    const page = await query(body(cursor))
    rows.push(...(page.results as NotionRow[]).filter((r) => (r as { object?: string }).object !== "data_source"))
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
  } while (cursor)
  return rows
}
