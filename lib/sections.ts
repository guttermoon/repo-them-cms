/**
 * The designed pages' sections, and the page and place each takes
 * (docs/sections.md, "Sections from Notion").
 *
 * Every section below the hero of the homepage, /pricing, /about, /team,
 * /security and /questions is named here, with the page it was designed for
 * and its place there. A Section row in Notion (Kind: Section) says where
 * one goes instead: Title names the section, Slug the page it shows on
 * (empty: its own page), Order its place (smallest first), and Published
 * whether it shows at all. Two ticked rows show it twice. A section with no
 * row stays where it was designed, so a database with no Section rows shows
 * the pages as designed, and one row moves only its own section.
 *
 * Fixed where they are: each page's hero, which holds the page's one `<h1>`,
 * and /features, the template's own page, whose jump links, deploy steps and
 * the maker's services hang on its order.
 *
 * Pure: the store hands in the rows (lib/notion/rows.ts reads them ticked
 * or not, as Site Copy is), and components/sections/lineup draws them.
 */

/** The pages whose sections can be turned off, moved and duplicated. */
export const SECTION_PAGES = ["/", "/pricing", "/about", "/team", "/security", "/questions"] as const
export type SectionPage = (typeof SECTION_PAGES)[number]

type SectionDefault = {
  /** the page it was designed for */
  page: SectionPage
  /** its place there, in tens, so a row can go between two */
  order: number
  /** set on the panel's tint (never against another panel: lineup) */
  panel?: boolean
  /** what it is, for the Section rows' Description and the docs */
  about: string
}

export const SECTIONS = {
  "home.statement": { page: "/", order: 10, about: "One word the width of the window, and three promises on a checkout belt" },
  "home.why": { page: "/", order: 20, panel: true, about: "Why generic, in three columns" },
  "home.logos": { page: "/", order: 30, about: "The tools the site goes well with" },
  "home.quote": { page: "/", order: 40, about: "A quotation, large (the first Quote row)" },
  "home.facts": { page: "/", order: 50, about: "The small print in large print, as a nutrition label" },
  "home.plans": { page: "/", order: 60, panel: true, about: "The plans, in brief, and the way to compare them" },
  "home.shelf": { page: "/", order: 70, about: "The shop's shelf: four products, featured first" },
  "home.reviews": { page: "/", order: 80, about: "What people say: the reviews, with their average" },
  "home.posts": { page: "/", order: 90, about: "The three newest posts" },
  "home.template": { page: "/", order: 100, about: "The band saying this is a live demo of the template" },
  "home.service": { page: "/", order: 110, panel: true, about: "The maker's plain facts" },
  "home.final": { page: "/", order: 120, about: "The last word, and its buttons" },
  "pricing.plans": { page: "/pricing", order: 10, about: "The plans with the monthly and yearly switch, and a quotation" },
  "pricing.compare": { page: "/pricing", order: 20, about: "The plans compared, feature by feature" },
  "pricing.promises": { page: "/pricing", order: 30, panel: true, about: "The maker's promises" },
  "pricing.faq": { page: "/pricing", order: 40, about: "Questions about money (Question rows, Category Pricing)" },
  "pricing.final": { page: "/pricing", order: 50, about: "The last word, and its buttons" },
  "about.story": { page: "/about", order: 10, about: "The story so far" },
  "about.numbers": { page: "/about", order: 20, panel: true, about: "By the numbers" },
  "about.team": { page: "/about", order: 30, about: "The first three people, and the way to the team" },
  "about.final": { page: "/about", order: 40, about: "The last word, and its buttons" },
  "team.people": { page: "/team", order: 10, about: "Everybody (Person rows)" },
  "team.final": { page: "/team", order: 20, about: "The last word, and its buttons" },
  "security.facts": { page: "/security", order: 10, about: "What is true of the code" },
  "security.report": { page: "/security", order: 20, about: "How to report a problem" },
  "questions.list": { page: "/questions", order: 10, about: "Every question, under its category" },
  "questions.more": { page: "/questions", order: 20, about: "The last word, and its buttons" },
} as const satisfies Record<string, SectionDefault>

export type SectionKey = keyof typeof SECTIONS

/** A Section row as the store keeps it, ticked or not. */
export type SectionRow = {
  id: string
  /** the row's Title: the section it places */
  key: string
  /** the row's Slug, as written: the page it shows on */
  page?: string
  /** the row's Order: its place on that page */
  order?: number
  /** ticked: shown */
  on: boolean
  created?: string
}

export const isSectionKey = (key: string): key is SectionKey => Object.hasOwn(SECTIONS, key)

/** Whether a section is set on the panel's tint where it stands alone. */
export const isPanel = (key: SectionKey): boolean => (SECTIONS[key] as SectionDefault).panel === true

/** The page a Section row's Slug names: `home` or `/` for the homepage,
 *  `pricing` or `/pricing` for the others, any case. Empty, or a page whose
 *  sections can't be placed, is no page (the section's own is used). */
export function sectionPage(slug: string | undefined): SectionPage | undefined {
  const written = (slug ?? "").trim().toLowerCase()
  if (written === "/") return "/"
  const words = written.replace(/^\/+|\/+$/g, "")
  if (!words) return undefined
  const path = words === "home" ? "/" : `/${words}`
  return (SECTION_PAGES as readonly string[]).includes(path) ? (path as SectionPage) : undefined
}

/**
 * The sections a page shows, in order, a section's key once for every time
 * it shows. A section with no row is where it was designed. One with rows
 * is wherever its ticked rows say, and nowhere if none is ticked; a row
 * naming no page, or a page that has no sections, keeps it on its own page.
 * Order is the row's, else the section's own (on its own page) or after
 * every numbered section (moved). Ties keep the designed order, then the
 * rows' age, so the answer never changes between requests.
 */
export function lineup(rows: readonly SectionRow[] | undefined, page: SectionPage): SectionKey[] {
  const own = new Map<SectionKey, SectionRow[]>()
  for (const row of rows ?? []) {
    if (!isSectionKey(row.key)) continue
    own.set(row.key, [...(own.get(row.key) ?? []), row])
  }
  const placed: { key: SectionKey; order: number; designed: number; age: string }[] = []
  for (const [key, section] of Object.entries(SECTIONS) as [SectionKey, SectionDefault][]) {
    const its = own.get(key)
    if (!its) {
      if (section.page === page) placed.push({ key, order: section.order, designed: section.order, age: "" })
      continue
    }
    for (const row of its) {
      if (!row.on) continue
      const where = sectionPage(row.page) ?? section.page
      if (where !== page) continue
      const order = row.order ?? (where === section.page ? section.order : Number.MAX_SAFE_INTEGER)
      placed.push({ key, order, designed: section.order, age: `${row.created ?? ""}${row.id}` })
    }
  }
  return placed
    .sort((a, b) => a.order - b.order || a.designed - b.designed || a.age.localeCompare(b.age))
    .map((p) => p.key)
}

/** What notion:check says about a Section row the site can't place as
 *  written, or nothing. */
export function sectionProblem(row: SectionRow): string | undefined {
  if (!isSectionKey(row.key)) return `"${row.key}" is not a section: the Title of a Section row names one of ${Object.keys(SECTIONS).join(", ")}`
  if (row.page?.trim() && !sectionPage(row.page)) {
    return `"${row.page}" is not a page whose sections can be placed (${SECTION_PAGES.map((p) => (p === "/" ? "home" : p.slice(1))).join(", ")}): ${row.key} stays on its own page`
  }
  return undefined
}
