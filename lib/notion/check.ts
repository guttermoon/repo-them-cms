/**
 * What `npm run notion:check` reports about a database: whether it has the
 * properties the site reads, and anything in the published rows the site
 * will skip or treat differently from what the editor probably meant.
 * Pure: it takes the schema and the rows, so `npm test` checks it.
 */
import { safeDestination } from "../content/redirects"
import { isLive } from "../content/select"
import { PAGE_META, SEARCH_LIMITS } from "../page-meta"
import { SITE_NAME } from "../site"
import { inlineWords } from "../inline-text"
import { ROWLESS_SLOTS, siteName } from "../slots"
import { nameAlt, splitCaption } from "./alt-text"
import type { NBlock } from "./blocks"
import { personKey, readRow, readRows, rowProperty, rowTitle, type Entry, type NotionRow, type RichRun } from "./rows"
import { menuOverflow, menuProblem, type MenuPage, type MenuRow } from "../menus"
import { sectionProblem } from "../sections"
import { EDITOR_STATUS, FORMER_KINDS, FORMER_NAMES, KINDS, PROPS, RESERVED_SEGMENTS, RETIRED_PROPS, SCHEMA } from "./schema"

export type Finding = { level: "error" | "warning" | "info"; message: string }

/**
 * A designed page's title or description reworded in Notion
 * (`meta.<page>.title`, `.description`), against what a search result prints
 * whole: the numbers the built-in wording is held to (lib/page-meta.ts).
 */
export function checkSearchWords(key: string, text: string, site: string = SITE_NAME): Finding[] {
  const m = /^meta\.(.+)\.(title|description)$/.exec(key)
  const words = text.trim()
  if (!m || !words) return []
  const path = m[1] === "home" ? "/" : `/${m[1].replace(/\./g, "/")}`
  if (!(path in PAGE_META)) return []
  if (m[2] === "title") {
    const full = path === "/" ? `${site} | ${words}` : `${words} | ${site}`
    const most = path === "/" ? SEARCH_LIMITS.fullTitle - site.length - 3 : SEARCH_LIMITS.title
    if (full.length > SEARCH_LIMITS.fullTitle || words.length > most) {
      return [{ level: "warning", message: `"${key}" is ${words.length} characters; a search result prints about ${most} of it whole.` }]
    }
    return []
  }
  const { min, max } = SEARCH_LIMITS.description
  if (words.length < min || words.length > max) {
    return [{ level: "warning", message: `"${key}" is ${words.length} characters; a search result shows ${min} to ${max} best.` }]
  }
  return []
}

/**
 * A page's, post's or product's own title and description, against what a
 * search result prints whole: a title with " | " and the site's name after
 * it, and a description of 140 to 160 characters. A product's description
 * is its shop's (the importer writes it), so only its title is measured; an
 * empty Description is no fault, since the page's first words stand in.
 */
export function checkEntrySearchWords(entry: Pick<Entry, "kind" | "title" | "description">, site: string = SITE_NAME): Finding[] {
  if (entry.kind !== "Page" && entry.kind !== "Post" && entry.kind !== "Product") return []
  const out: Finding[] = []
  const full = `${entry.title} | ${site}`
  if (full.length > SEARCH_LIMITS.fullTitle) {
    out.push({ level: "warning", message: `${entry.kind} "${entry.title}" is ${entry.title.length} characters; a search result prints about ${SEARCH_LIMITS.fullTitle - site.length - 3} of it whole.` })
  }
  const words = inlineWords(entry.description).replace(/\s+/g, " ").trim()
  const { min, max } = SEARCH_LIMITS.description
  if (entry.kind !== "Product" && words && (words.length < min || words.length > max)) {
    out.push({ level: "warning", message: `${entry.kind} "${entry.title}" has a Description of ${words.length} characters; a search result shows ${min} to ${max} best.` })
  }
  return out
}

/** The data source's properties against the contract. */
export function checkSchema(properties: Record<string, { type?: string }>): Finding[] {
  const out: Finding[] = []
  for (const prop of SCHEMA) {
    const former = FORMER_NAMES[prop.name]
    const found = properties[prop.name] ?? (former ? properties[former] : undefined)
    if (found && !properties[prop.name] && former) {
      out.push({ level: "info", message: `"${former}" is now called "${prop.name}". The site reads either; rename it in Notion (the property's menu, Rename) to match the template.` })
    }
    if (!found) {
      out.push({ level: prop.required ? "error" : "warning", message: `Missing property "${prop.name}" (${prop.type}). ${prop.description}` })
    } else if (found.type !== prop.type) {
      out.push({ level: prop.required ? "error" : "warning", message: `Property "${prop.name}" is ${found.type}; the site reads it as ${prop.type}.` })
    }
  }
  for (const [name, what] of Object.entries(RETIRED_PROPS)) {
    if (properties[name]) out.push({ level: "info", message: `"${name}" is no longer read. ${what}` })
  }
  // a Kind under its former name: read as the new one, and worth renaming
  const kinds = ((properties[PROPS.kind] as { select?: { options?: { name?: string }[] } } | undefined)?.select?.options ?? []).map((option) => option.name)
  for (const [former, now] of Object.entries(FORMER_KINDS)) {
    if (kinds.includes(former)) {
      out.push({ level: "info", message: `The Kind "${former}" is now called "${now}". The site reads either; rename the option in Notion (Kind's menu, Edit property) to match the template.` })
    }
  }
  return out
}

/** Whether a row holds anything in a property: words, files, a choice. */
function holds(row: NotionRow, name: string): boolean {
  const p = rowProperty(row, name) as { rich_text?: unknown[]; files?: unknown[]; title?: unknown[] } | undefined
  return Boolean(p?.rich_text?.length || p?.files?.length || p?.title?.length)
}

/** What notion:check says of a published row's own Author Bio, which no
 *  page reads, since a byline is its Person row's alone. */
function unreadFields(row: NotionRow, kind: string, title: string): Finding[] {
  if (kind !== "Post" || !holds(row, PROPS.authorBio)) return []
  return [{ level: "info", message: `Post "${title}" has its own Author Bio, which no page reads: a byline is its author's Person row (its Author Bio and Image). Write it there, and clear the post's.` }]
}

/**
 * The query for every row still holding something in a retired property
 * (RETIRED_PROPS), ticked or not: the notice says to delete the column, and
 * a draft's picture is as much the editor's as a published one's, so every
 * row it would take something from is named first.
 */
export function retiredQuery(name: string, type: string | undefined, cursor?: string) {
  const held = type === "files" ? { files: { is_not_empty: true as const } } : { rich_text: { is_not_empty: true as const } }
  return { filter: { property: name, ...held }, ...(cursor ? { start_cursor: cursor } : {}), page_size: 100 }
}

/**
 * Every row holding something in a retired property the database still
 * has, drafts too, each once however many of those properties it fills.
 * Each property's query finds the row, and `checkRetiredRows` names every
 * retired property a row holds, so a row met twice would be named twice.
 */
export async function retiredRows(
  properties: Record<string, { type?: string }>,
  query: (body: (cursor?: string) => Record<string, unknown>) => Promise<NotionRow[]>,
): Promise<NotionRow[]> {
  const rows = new Map<unknown, NotionRow>()
  for (const name of Object.keys(RETIRED_PROPS).filter((name) => properties[name])) {
    for (const row of await query((cursor) => retiredQuery(name, properties[name].type, cursor))) rows.set(row.id ?? row, row)
  }
  return [...rows.values()]
}

/** A row as notion:check names it, ticked or not: its Kind and its title. */
function rowLabel(row: NotionRow): string {
  const title = Object.values(row.properties ?? {}).find((p) => p?.type === "title")?.title?.map((r) => r.plain_text ?? "").join("") || "(untitled)"
  const kind = (rowProperty(row, PROPS.kind) as { select?: { name?: string } | null } | undefined)?.select?.name ?? "Row"
  return `${kind} "${title}"`
}

/** Whether a row's Published is ticked. */
function ticked(row: NotionRow): boolean {
  return Boolean((rowProperty(row, PROPS.published) as { checkbox?: boolean } | undefined)?.checkbox)
}

/** What notion:check says of each row the retired-property query found:
 *  what it holds there, and whether it is a draft. */
export function checkRetiredRows(rows: NotionRow[]): Finding[] {
  const out: Finding[] = []
  for (const row of rows) {
    const draft = ticked(row) ? "" : ", a draft,"
    for (const [name, what] of Object.entries(RETIRED_PROPS)) {
      if (holds(row, name)) out.push({ level: "warning", message: `${rowLabel(row)}${draft} has something in "${name}", which is no longer read. ${what}` })
    }
  }
  return out
}

type StatusProperty = {
  type?: string
  status?: { options?: { id?: string; name?: string }[]; groups?: { name?: string; option_ids?: string[] }[] }
}

/** The options of the editors' Status (EDITOR_STATUS) that say a row is
 *  live: those in its Complete group, whatever an editor named them. None
 *  when the database has no such status property. */
export function liveStatuses(property: StatusProperty | undefined): string[] {
  if (property?.type !== "status") return []
  const complete = new Set(property.status?.groups?.find((group) => group.name?.toLowerCase() === "complete")?.option_ids ?? [])
  return (property.status?.options ?? []).flatMap((option) => (option.id && option.name && complete.has(option.id) ? [option.name] : []))
}

/**
 * The query for every row whose Status disagrees with Published: ticked
 * with a Status that is not a live one, or unticked with a live one. A
 * filter nests two levels at most in Notion's API, so each live option of
 * an unticked row is a group of its own.
 */
export function statusQuery(live: string[], cursor?: string) {
  const published = (equals: boolean) => ({ property: PROPS.published, checkbox: { equals } })
  const status = (operator: "equals" | "does_not_equal", name: string) => ({ property: EDITOR_STATUS, status: { [operator]: name } })
  return {
    filter: {
      or: [{ and: [published(true), ...live.map((name) => status("does_not_equal", name))] }, ...live.map((name) => ({ and: [published(false), status("equals", name)] }))],
    },
    ...(cursor ? { start_cursor: cursor } : {}),
    page_size: 100,
  }
}

/** How many rows a Status finding names before it counts the rest. */
const NAMED = 10

/**
 * What notion:check says of the rows whose Status disagrees with Published.
 * Ticked under a Status that says otherwise is the one that matters most: a
 * row its editor takes for a draft is on the site. Unticked under a live
 * Status is a row its editor takes for live that nobody can see.
 */
export function checkStatusRows(rows: NotionRow[], live: string[]): Finding[] {
  const liveStatus = new Set(live)
  const shown: string[] = []
  const hidden: string[] = []
  for (const row of rows) {
    const status = (rowProperty(row, EDITOR_STATUS) as { status?: { name?: string } | null } | undefined)?.status?.name
    if (ticked(row) && !(status && liveStatus.has(status))) shown.push(`${rowLabel(row)} (${status || "no Status"})`)
    else if (!ticked(row) && status && liveStatus.has(status)) hidden.push(rowLabel(row))
  }
  const list = (names: string[]) => names.slice(0, NAMED).join(", ") + (names.length > NAMED ? `, and ${names.length - NAMED} more` : "")
  const count = (n: number) => (n === 1 ? "1 row" : `${n} rows`)
  const why = `The site reads Published alone; Status is for editors, kept in step by two automations (docs/notion.md, "Published and Status").`
  const out: Finding[] = []
  if (shown.length) {
    out.push({ level: "warning", message: `${count(shown.length)} on the site, Published ticked, under a Status that says otherwise: ${list(shown)}. Untick Published to take one off, or set its Status. ${why}` })
  }
  if (hidden.length) {
    out.push({ level: "warning", message: `${count(hidden.length)} off the site, Published unticked, under a Status of ${live.join(" or ")}: ${list(hidden)}. Tick Published to show one, or set its Status back. ${why}` })
  }
  return out
}

/** The published rows: what each becomes, and what will be skipped. A
 *  title is measured with the site's name as its rows have it (`site.name`),
 *  which is the name a search result prints after it. */
export function checkRows(rows: NotionRow[], now: Date = new Date()): { counts: Record<string, number>; findings: Finding[] } {
  const counts: Record<string, number> = { ...Object.fromEntries(KINDS.map((kind) => [kind, 0])), skipped: 0 }
  const findings: Finding[] = []
  const seen = new Map<string, string>()
  const entries: Entry[] = []
  const menuRows: MenuRow[] = []
  const site = siteName(readRows(rows).copy)
  for (const row of rows) {
    const read = readRow(row)
    const title = Object.values(row.properties ?? {}).find((p) => p?.type === "title")?.title?.map((r) => r.plain_text ?? "").join("") ?? ""
    if (!read) {
      counts.skipped++
      findings.push({ level: "warning", message: `"${title || "(untitled)"}" is published but has no Kind (or no title), so the site ignores it.` })
      continue
    }
    const kind = (rowProperty(row, PROPS.kind) as { select?: { name?: string } | null } | undefined)?.select?.name ?? "Row"
    findings.push(...unreadFields(row, kind, title))
    if ("copy" in read) {
      counts["Site Copy"]++
      findings.push(...checkSearchWords(...read.copy, site))
      continue
    }
    if ("menu" in read) {
      counts.Menu++
      menuRows.push(read.menu)
      continue
    }
    if ("section" in read) {
      counts.Section++
      const problem = sectionProblem(read.section)
      if (problem) findings.push({ level: "warning", message: `Section "${read.section.key}": ${problem}.` })
      continue
    }
    const entry = read.entry
    entries.push(entry)
    counts[entry.kind]++
    findings.push(...checkEntrySearchWords(entry, site))
    // ticked and dated ahead: when, exactly, so a time zone read wrong shows
    if (entry.date && !isLive(entry, now)) {
      const at = new Date(entry.date.length === 10 ? `${entry.date}T00:00:00Z` : entry.date).toISOString()
      const midnight = entry.date.length === 10 ? " (a date with no time starts at midnight UTC)" : ""
      findings.push({ level: "info", message: `${entry.kind} "${entry.title}" is ticked and waits for its Published Date: it goes live at ${at.slice(0, 10)} ${at.slice(11, 16)} UTC${midnight}, within a minute or two.` })
    }
    if ((entry.kind === "Page" || entry.kind === "Post") && !entry.slug) findings.push({ level: "warning", message: `${entry.kind} "${entry.title}" has no usable address.` })
    if (entry.kind === "Page" && (RESERVED_SEGMENTS as readonly string[]).includes(entry.slug.split("/")[0])) {
      findings.push({ level: "error", message: `Page "${entry.title}" wants /${entry.slug}, which the site already uses; it is skipped. Change its Slug.` })
    }
    if (entry.kind === "Redirect" && !safeDestination(entry.link)) {
      findings.push({ level: "error", message: `Redirect "${entry.slug}" goes to "${entry.link ?? ""}", which is not a web address, a path, an email or a phone number; it is ignored.` })
    }
    if (entry.kind === "Resource" && !entry.link) findings.push({ level: "warning", message: `Resource "${entry.title}" has no Link, so it has no button.` })
    if (entry.kind === "Product" && entry.price === undefined) findings.push({ level: "warning", message: `Product "${entry.title}" has no Price.` })
    if (entry.kind === "Product" && !entry.variants?.length && !entry.link) {
      findings.push({ level: "info", message: `Product "${entry.title}" has no Checkout ID and no Link, so it can only be enquired about.` })
    }
    if ((entry.kind === "Quote" || entry.kind === "Question") && !entry.text) {
      findings.push({ level: "warning", message: `${entry.kind} "${entry.title}" has no Text, so it is not shown.` })
    }
    if (entry.kind === "Proof Logos" && !entry.cover) findings.push({ level: "info", message: `Proof Logos row "${entry.title}" has no Image, so its name is set as a word.` })
    if (entry.kind === "Plan" && !entry.link) findings.push({ level: "info", message: `Plan "${entry.title}" has no Link, so it has no button.` })
    // a page's own cover wins over the property (lib/notion/rows.ts): a file
    // left in Image beside one is never shown, and may be cleared
    const coverFile = rowProperty(row, PROPS.cover)
    if ((entry.kind === "Page" || entry.kind === "Post") && row.cover && coverFile?.type === "files" && (coverFile.files?.length ?? 0) > 0) {
      findings.push({ level: "info", message: `${entry.kind} "${entry.title}" has a Notion cover and an Image; the site shows the Notion cover, so the Image can be cleared.` })
    }
    if (entry.kind === "Page" || entry.kind === "Post" || entry.kind === "Product") {
      const key = `${entry.kind}:${entry.slug}`
      const other = seen.get(key)
      if (other) findings.push({ level: "warning", message: `${entry.kind}s "${other}" and "${entry.title}" share the address ${entry.slug}; the older one is shown.` })
      else seen.set(key, entry.title)
    }
  }
  findings.push(...checkAuthors(entries))
  findings.push(...checkMenus(menuRows, entries))
  return { counts, findings }
}

/** What notion:check says about Menu rows: one it can't place, and a menu
 *  given more links than it has room for (lib/menus.ts). */
function checkMenus(rows: MenuRow[], entries: Entry[]): Finding[] {
  const pages: MenuPage[] = entries.filter((e) => e.kind === "Page" && e.slug).map((e) => ({ href: `/${e.slug}`, title: e.title, order: e.order }))
  const out: Finding[] = []
  for (const row of rows) {
    const problem = menuProblem(row, pages)
    if (problem) out.push({ level: "warning", message: `Menu "${row.page}": ${problem}.` })
  }
  for (const message of menuOverflow(rows, pages)) out.push({ level: "warning", message: `${message}.` })
  return out
}

/** What notion:check says about posts' authors and the people they name
 *  (withAuthors in lib/notion/rows.ts). */
function checkAuthors(entries: Entry[]): Finding[] {
  const out: Finding[] = []
  const key = personKey
  const people = new Map<string, Entry>()
  for (const person of entries.filter((e) => e.kind === "Person")) {
    if (people.has(key(person.title))) out.push({ level: "warning", message: `Two Person rows are called "${person.title}"; posts by that name take the first one's portrait and bio.` })
    else people.set(key(person.title), person)
  }
  const written = new Set<string>()
  for (const post of entries.filter((e) => e.kind === "Post" && e.author)) {
    const name = post.author!.name
    written.add(key(name))
    if (!people.has(key(name))) {
      out.push({ level: "info", message: `Post "${post.title}" is by "${name}", who has no Person row, so the byline is the name alone. Add a Person row of that name for a picture and a line about them; Team Page Off keeps a guest off the team page.` })
    }
  }
  for (const person of people.values()) {
    if (person.team === false && !written.has(key(person.title))) {
      out.push({ level: "info", message: `Person "${person.title}" has Team Page Off and writes no post, so they are shown nowhere.` })
    }
  }
  return out
}

/**
 * A database's Site Copy rows by Title: every one, ticked or not (an
 * unticked row still hides its slot, so it counts as the slot's row), and
 * the ticked ones alone (an unticked row nothing reads is already put away,
 * as the unread-row finding asks).
 */
export function textRowKeys(rows: NotionRow[]): { all: string[]; ticked: string[] } {
  const copy = rows.filter((row) => rowProperty(row, PROPS.kind)?.select?.name === "Site Copy")
  return {
    all: copy.map((row) => rowTitle(row)),
    ticked: copy.filter((row) => rowProperty(row, PROPS.published)?.checkbox === true).map((row) => rowTitle(row)),
  }
}

/**
 * The text rows the site never reads, against the list of every slot the
 * pages read (copy-keys.json, written by `npm run copy`). Given the ticked
 * rows only (`textRowKeys`): an unticked one is already out of the way. A row nobody reads
 * is a trap: an editor changes it and nothing happens. It is left from an
 * older version of the template, or mistyped, or for words that live in rows
 * of their own (a plan's name is in its Plan row). Nothing is deleted here:
 * the row is named, to untick or move to the trash.
 */
export function checkUnreadRows(rowKeys: string[], slots: Iterable<string>): Finding[] {
  const known = new Set(slots)
  return [...new Set(rowKeys)]
    .filter((key) => !known.has(key))
    .sort()
    .map((key) => ({ level: "warning" as const, message: `Text row "${key}" is not read by any page, so editing it changes nothing. Untick it, or move it to the trash.` }))
}

/** How many missing slots a finding names before it counts the rest. */
const SLOTS_NAMED = 12

/**
 * The slots with no row at all. On a connected site a slot shows only a
 * ticked row's words (FROM_NOTION in lib/slots.ts), so each of these shows
 * nothing: a slot a code update added, a row moved to the trash instead of
 * unticked, a Title mistyped. A slot meant to have no row (ROWLESS_SLOTS)
 * is never named.
 */
export function checkMissingSlots(rowKeys: string[], slots: Iterable<string>): Finding[] {
  const have = new Set(rowKeys)
  const missing = [...new Set(slots)].filter((key) => !have.has(key) && !ROWLESS_SLOTS.includes(key)).sort()
  if (!missing.length) return []
  const named = missing.slice(0, SLOTS_NAMED).join(", ")
  const rest = missing.length > SLOTS_NAMED ? ` and ${missing.length - SLOTS_NAMED} more (\`npm run notion:seed-copy -- --dry-run\` lists them all)` : ""
  const count = missing.length === 1 ? "1 text slot has" : `${missing.length} text slots have`
  return [
    {
      level: "warning",
      message: `${count} no row in Notion, so the site shows nothing there: ${named}${rest}. \`npm run notion:seed-copy\` adds a row for each, unticked, holding the words the code suggests: read it, then tick Published.`,
    },
  ]
}

/** Both of the above: the rows nobody reads, then the slots with no row. */
export const checkCopyKeys = (rowKeys: string[], slots: Iterable<string>): Finding[] => [
  ...checkUnreadRows(rowKeys, slots),
  ...checkMissingSlots(rowKeys, slots),
]

/**
 * Pictures in a page's, a post's or a product's body that nobody described:
 * no caption and no "Alt:" line, so a screen reader passes them by as
 * decoration (lib/notion/alt-text.ts). A bare "Alt:" says that is meant.
 */
export function checkPictures(where: string, blocks: NBlock[]): Finding[] {
  let missing = 0
  const walk = (list: NBlock[]) => {
    for (const block of list) {
      if (block.type === "image") {
        const { caption, alt } = splitCaption((block.image as { caption?: RichRun[] } | undefined)?.caption)
        if (alt === null && !caption.length) missing++
      }
      if (block.children) walk(block.children)
    }
  }
  walk(blocks)
  if (!missing) return []
  return [
    {
      level: "warning",
      message: `${where}: ${missing} picture${missing === 1 ? " has" : "s have"} no description, so a screen reader skips ${missing === 1 ? "it" : "them"}. Give ${missing === 1 ? "it" : "each"} a caption, or a caption line starting "Alt:" (a bare "Alt:" marks a picture as decoration).`,
    },
  ]
}

/**
 * Products whose pictures have no description: the shop's alt text, which
 * the import writes as each picture's name in Notion. Without one, the large
 * picture is described by the product's name and the others only by their
 * place ("Picture 2 of 4").
 */
export function checkProductPictures(entries: Entry[]): Finding[] {
  const bare = entries.filter((e) => e.kind === "Product").filter((e) => [e.cover, ...(e.gallery ?? [])].some((m) => m && !nameAlt(m)))
  if (!bare.length) return []
  const names = bare.slice(0, 5).map((e) => `"${e.title}"`).join(", ")
  return [
    {
      level: "info",
      message: `${bare.length} product${bare.length === 1 ? " has" : "s have"} pictures with no description (${names}${bare.length > 5 ? ", …" : ""}). Add alt text to them in the shop and import again, or rename a picture uploaded in Notion to what it shows.`,
    },
  ]
}
