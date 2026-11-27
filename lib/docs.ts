/**
 * The generated parts of the documentation (scripts/build-docs.mjs, checked
 * by tests/docs.test.mjs): written from the code, so the docs say what the
 * code does.
 *
 * Imports only the schema, the sections and the menus, so `npm test`
 * loads it.
 */
import { MENU_NAMES, MENUS } from "./menus"
import { SCHEMA } from "./notion/schema"
import { SECTIONS } from "./sections"

const TYPE_NAMES: Record<string, string> = {
  title: "Title",
  rich_text: "Text",
  checkbox: "Checkbox",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  number: "Number",
  files: "Files & media",
  url: "URL",
  status: "Status",
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ")

/** Every property, as Notion names its type, with what it is for. */
export function schemaTable(): string {
  const rows = SCHEMA.map((p) => {
    const options = p.options?.length ? ` Options: ${p.options.map((o) => o.name).join(", ")}.` : ""
    return `| ${p.name} | ${TYPE_NAMES[p.type]} | ${p.required ? "yes" : ""} | ${cell(p.description)}${cell(options)} |`
  })
  return ["| Property | Type | Required | What it is for |", "|---|---|---|---|", ...rows].join("\n")
}

/** Every section a Section row can place: its Title, the page and place it
 *  was designed for (its Slug and Order with no row), and what it is. */
export function sectionsTable(): string {
  const rows = Object.entries(SECTIONS).map(([key, s]) => `| \`${key}\` | ${s.page === "/" ? "home" : s.page.slice(1)} | ${s.order} | ${cell(s.about)}${"panel" in s && s.panel ? " (on the panel)" : ""} |`)
  return ["| Title | Its page | Order | What it is |", "|---|---|---|---|", ...rows].join("\n")
}

/** Every menu a Menu row can name in its Slug: what it is, how many links
 *  it has room for, and the links it was designed with (its rows' Titles,
 *  at Order 10, 20, 30…). */
export function menusTable(): string {
  const rows = MENU_NAMES.map((name) => {
    const m = MENUS[name]
    const links = m.links.map((href) => `\`${href === "/" ? "home" : href.slice(1)}\``).join(", ")
    return `| \`${name}\` | ${cell(m.about)} | ${m.max ?? "any"} | ${links} |`
  })
  return ["| Slug | Where it is | Room | Its links as designed |", "|---|---|---|---|", ...rows].join("\n")
}

/** The text with the block between `<!-- name:start -->` and
 *  `<!-- name:end -->` replaced by `content`. Throws when the markers are
 *  missing, rather than leave a document half generated. */
export function withBlock(text: string, name: string, content: string): string {
  const start = `<!-- ${name}:start -->`
  const end = `<!-- ${name}:end -->`
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from === -1 || to === -1 || to < from) throw new Error(`the ${name} markers are missing`)
  return `${text.slice(0, from + start.length)}\n${content}\n${text.slice(to)}`
}
