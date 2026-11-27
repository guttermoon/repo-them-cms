// The rules every page and every part of one is held to (docs/accessibility.md
// and docs/brand.md), as checks on a rendered piece of the site: a page
// (tests/dom/pages.test.tsx), the frame round every page
// (tests/dom/layout.test.tsx), or one section (tests/dom/sections.test.tsx).
// Each takes a root element and fails with the offending markup.
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { expect } from "vitest"
import { NOT_FOUND_LINKS } from "@/lib/nav"
import { SITE_URL } from "@/lib/site"

// vitest runs from the project root
export const ROOT = process.cwd()
const APP = join(ROOT, "app")

/** Every app route that renders a page, with its module. */
export function pageRoutes(dir = APP, base = ""): { route: string; file: string }[] {
  const out: { route: string; file: string }[] = []
  if (existsSync(join(dir, "page.tsx"))) out.push({ route: base || "/", file: join(dir, "page.tsx") })
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory() || entry === "api" || entry.startsWith("[") || entry.startsWith("_")) continue
    out.push(...pageRoutes(full, `${base}/${entry}`))
  }
  return out
}

/** Every app route whose address has a parameter ("/blog/[slug]"), with
 *  its module: the pages whose addresses come from Notion's rows. */
export function dynamicPageRoutes(dir = APP, base = ""): { template: string; file: string }[] {
  const out: { template: string; file: string }[] = []
  if (base.includes("[") && existsSync(join(dir, "page.tsx"))) out.push({ template: base, file: join(dir, "page.tsx") })
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory() || entry === "api" || entry.startsWith("_")) continue
    out.push(...dynamicPageRoutes(full, `${base}/${entry}`))
  }
  return out
}

/** A route template filled in with a page's params: "/blog/[slug]" and
 *  { slug: "hello" } is "/blog/hello"; "[...slug]" takes a list. */
export function fillRoute(template: string, params: Record<string, string | string[]>): string {
  return template.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, name: string) => [params[name]].flat().join("/"))
}

/** Addresses answered by a route rather than a page: feeds, files, the
 *  short links, pictures served from Notion, share cards. */
const ROUTES = ["/blog/rss.xml", "/llms.txt", "/llms-full.txt", "/sitemap.xml", "/robots.txt", "/indexnow.txt"]
const DYNAMIC = [/^\/go\/[\w-]+$/, /^\/media\/[\w.-]+\/[^/]+$/, /^\/og(\/.*)?$/, /^\/blog\/(category\/|tag\/)?[\w-]+$/, /^\/shop\/(collection\/)?[\w-]+$/]

// a link to the 404 on purpose (lib/nav.ts) is one the checker knows
const KNOWN = new Set([...pageRoutes().map((r) => r.route), ...ROUTES, ...Object.values(NOT_FOUND_LINKS)])

const snippet = (el: Element) => el.outerHTML.slice(0, 160)
const hidden = (el: Element) => Boolean(el.closest('[aria-hidden="true"], [hidden]'))

/** Text a reader sees or hears: the text, and the attributes that are shown
 *  or read out (alt, aria-label, title, placeholder). */
export function readerText(root: Element): string {
  const clone = root.cloneNode(true) as Element
  clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove())
  const attrs = [...clone.querySelectorAll("[alt], [aria-label], [title], [placeholder]")].flatMap((el) =>
    ["alt", "aria-label", "title", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
  )
  return [clone.textContent ?? "", ...attrs].join("\n")
}

/** What a screen reader would call a control, roughly: enough to tell a
 *  named one from an unnamed one. */
export function accessibleName(el: Element): string {
  // looked up in the element's own tree, which may be a detached copy
  const root = el.getRootNode() as ParentNode
  const byId = el
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => root.querySelector(`[id="${id}"]`)?.textContent ?? "")
    .join(" ")
  const forLabel = el.id ? root.querySelector(`label[for="${el.id}"]`)?.textContent : ""
  return [
    el.getAttribute("aria-label"),
    byId,
    forLabel,
    el.closest("label")?.textContent,
    el.getAttribute("title"),
    el.tagName === "BUTTON" || el.tagName === "A" ? el.textContent : "",
    el.tagName === "A" ? el.querySelector("img")?.getAttribute("alt") : "",
    el.getAttribute("placeholder"),
  ]
    .filter(Boolean)
    .join(" ")
    .trim()
}

export function checkPictures(root: Element) {
  // alt="" is how HTML marks a picture as decoration; no alt at all is the fault
  for (const img of root.querySelectorAll("img")) {
    expect(img.getAttribute("alt"), snippet(img)).not.toBeNull()
    // a picture from Notion is asked for at the size it is shown (lib/media-sizes.ts)
    if (img.getAttribute("src")?.startsWith("/media/")) {
      expect(img.getAttribute("src"), `a media picture with no width: ${snippet(img)}`).toMatch(/\?w=\d+$/)
      expect(img.getAttribute("srcset"), `a media picture with no srcset: ${snippet(img)}`).toMatch(/\?w=\d+ \d+[wx]/)
      expect(img.getAttribute("loading"), snippet(img)).toMatch(/^(lazy|eager)$/)
    }
  }
  for (const svg of root.querySelectorAll("svg")) {
    const named = svg.getAttribute("aria-label") || svg.querySelector("title") || svg.getAttribute("role") === "img"
    if (!named) expect(hidden(svg), snippet(svg)).toBe(true)
  }
}

/** No placeholder or broken text reaches a reader: no lorem ipsum, no TODO,
 *  and nothing a template literal left behind. */
export function checkWords(root: Element) {
  const text = readerText(root)
  expect(text).not.toMatch(/lorem ipsum|\bTODO\b|\bTBD\b|\bFIXME\b|\bundefined\b|\bNaN\b|\[object Object\]/i)
}

/** Every link to this site goes to a page, a route, a public file or one
 *  of the given extra paths (the Notion pages a test's content holds). */
export function checkInternalLinks(root: Element, where: string, extra: Iterable<string> = []) {
  const known = new Set([...KNOWN, ...extra])
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href")!
    if (!href.startsWith("/") || href.startsWith("//")) continue
    const path = href.split(/[?#]/)[0] || "/"
    const ok = known.has(path) || DYNAMIC.some((re) => re.test(path)) || existsSync(join(ROOT, "public", path))
    expect(ok, `${where} links to ${href}`).toBe(true)
    // a link to the 404 on purpose tells a search engine not to follow it
    if ((Object.values(NOT_FOUND_LINKS) as string[]).includes(path)) expect(a.getAttribute("rel") ?? "", `${where}: ${href} without rel="nofollow"`).toMatch(/nofollow/)
  }
}

export function checkOutboundLinks(root: Element, where: string) {
  // a link to another site opens in a new tab, so the reader keeps their
  // place here; one to this site's own address stays in the tab
  const own = new URL(SITE_URL).host
  for (const a of root.querySelectorAll("a[href^='https:'], a[href^='//']")) {
    const href = a.getAttribute("href") ?? ""
    if (new URL(href, SITE_URL).host === own) continue
    expect(a.getAttribute("target"), `${where}: ${snippet(a)} goes to another site in the same tab`).toBe("_blank")
  }
  for (const a of root.querySelectorAll('a[target="_blank"]')) {
    // noreferrer implies noopener in every current browser
    expect(a.getAttribute("rel") ?? "", snippet(a)).toMatch(/noopener|noreferrer/)
  }
  const insecure = [...root.querySelectorAll("a[href^='http:']")].map((a) => a.getAttribute("href"))
  expect(insecure, `${where}: insecure links`).toEqual([])
}

export function checkNames(root: Element) {
  for (const el of root.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=tab], [role=region]")) {
    if (hidden(el)) continue
    expect(accessibleName(el), snippet(el)).not.toBe("")
  }
}

/** Headings go down one level at a time: no h2 straight to an h4. */
export function checkHeadingOrder(root: Element) {
  let last = 0
  for (const h of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    if (hidden(h)) continue
    const level = Number(h.tagName[1])
    if (last) expect(level - last <= 1, `${h.tagName} after h${last}: ${snippet(h)}`).toBe(true)
    last = level
  }
}

/** One <h1> on a page, and every id unique (aria-labelledby and anchors
 *  depend on it). */
export function checkPageShape(root: Element) {
  expect(root.querySelectorAll("h1").length, "a page has one h1").toBe(1)
  const ids = [...root.querySelectorAll("[id]")].map((el) => el.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  expect(dupes, "duplicate ids").toEqual([])
}

/**
 * A title takes no full stop, at its end or between two halves of it ("pick
 * a plan, change it any time"): a heading, anything set in the title face,
 * and anything whose id says it is one (the cookie notice's `cookie-title`).
 * A title in a picture is seen if not heard, so only one not shown at all is
 * let off. A question keeps its question mark; a price keeps its decimal
 * point; the sentence under a title keeps its full stop.
 */
export function checkTitles(root: Element, where: string) {
  const stopped = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6, .title-slab, [id$="-title"]')]
    .filter((el) => !el.closest("[hidden]"))
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((text) => FULL_STOP.test(text))
  expect(stopped, `${where}: titles with a full stop`).toEqual([])
}

/** A full stop: one that ends a sentence, so followed by a space or nothing. */
export const FULL_STOP = /\.(\s|$)/

/** All of the above that applies to any piece of a page. */
/**
 * One rhythm inside every section: whatever follows a section's heading
 * (`data-section-head`, or the row it shares with a link beside it) stands
 * the one gap below it, `.section-body` (app/globals.css), or in a page of
 * groups the tighter `.group-body`. Allowed instead: the heading's own
 * buttons, a paragraph that goes on from it (text, not content), and a
 * block marked `data-follows-head` with its reason.
 */
export function checkRhythm(root: Element, where: string) {
  for (const head of root.querySelectorAll("[data-section-head]")) {
    // a heading sharing a row with a link ("Shop everything") counts as the row
    const parent = head.parentElement
    const row = parent && parent.children.length > 1 && [...parent.children].every((child) => child === head || child.matches("a, button"))
    const after = (row ? parent : head).nextElementSibling
    if (!after) continue
    const buttons = after.children.length > 0 && [...after.querySelectorAll(":scope > *")].every((child) => child.matches("a, button"))
    const prose = after.matches("p") || (after.children.length > 0 && [...after.children].every((child) => child.matches("p")))
    if (after.classList.contains("section-body") || after.classList.contains("group-body") || buttons || prose || after.hasAttribute("data-follows-head")) continue
    throw new Error(`${where}: "${head.textContent?.trim().slice(0, 40)}" is followed by "${after.className}" rather than .section-body, the one gap under a section's heading`)
  }
}

/** What a control holds that makes it a card or a block rather than a pill:
 *  lines of their own, or a picture. */
const HOLDS = "p, div, ul, ol, h1, h2, h3, h4, h5, h6, span.block, img, picture, video, svg[role='img'], svg.mark"

/**
 * One shape for each kind of thing (docs/design.md, "Shape"). A control
 * that hugs its words is a pill; one that holds lines or a picture, or
 * spans its column as a row, takes a container's corner; every place a
 * reader types is the site's field (`.field`); and the site draws its own
 * select, so there is no native one to fall out of step.
 */
export function checkShapes(root: Element, where: string) {
  const select = root.querySelector("select")
  if (select) throw new Error(`${where}: a native <select> ("${select.id || select.className}"); the site's is SelectLine`)
  for (const field of root.querySelectorAll<HTMLElement>("input, textarea")) {
    const type = field.getAttribute("type") ?? "text"
    // the honeypot nobody is shown, and radios and boxes drawn by their label
    if (["checkbox", "radio", "hidden"].includes(type) || field.closest("[aria-hidden='true']") || field.tabIndex === -1) continue
    if (!field.closest(".field")) throw new Error(`${where}: a ${field.tagName.toLowerCase()} (${field.id || field.getAttribute("name") || type}) is not the site's field`)
  }
  for (const control of root.querySelectorAll<HTMLElement>("a, button")) {
    const corner = /(?:^|\s)rounded-(text|block|card|panel|full)(?=\s|$)/.exec(control.className)?.[1]
    if (!corner || corner === "full" || control.classList.contains("field")) continue
    const row = /(?:^|\s)(flex|block|grid)(?=\s|$)/.test(control.className)
    if (row || control.querySelector(HOLDS) || control.getAttribute("role") === "tab") continue
    throw new Error(`${where}: "${control.textContent?.trim().slice(0, 40)}" hugs its words, so it is a pill, not rounded-${corner}`)
  }
}

/** A row of buttons holds buttons: its gap is set for pills, and a bare
 *  text link beside one reads as jammed against it (ButtonRow). */
export function checkButtonRows(root: Element, where: string) {
  for (const row of root.querySelectorAll("[data-buttons]")) {
    for (const child of row.children) {
      const control = child.matches("a, button") ? child : child.querySelector("a, button")
      if (control && !control.classList.contains("press")) {
        throw new Error(`${where}: "${control.textContent?.trim().slice(0, 40)}" sits in a row of buttons but is not one; make it a ButtonLink (tone="quiet" reads as a link)`)
      }
    }
  }
}

export function checkEverything(root: Element, where: string, extraPaths: Iterable<string> = []) {
  checkButtonRows(root, where)
  checkShapes(root, where)
  checkRhythm(root, where)
  checkPictures(root)
  checkWords(root)
  checkTitles(root, where)
  checkInternalLinks(root, where, extraPaths)
  checkOutboundLinks(root, where)
  checkNames(root)
  checkHeadingOrder(root)
}
