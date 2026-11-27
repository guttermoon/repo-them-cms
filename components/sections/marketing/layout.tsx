import type React from "react"
import { outsideLink } from "@/lib/outside"

/**
 * The marketing sections' frame: one container width, one rhythm, one way
 * to set a section's head. Every section in components/sections/marketing
 * sits in these, so a page assembled from them cannot drift into a second
 * spacing or a third heading size.
 *
 * Words are never written here: a page hands each section its words as
 * nodes (usually a `<T k="…">default</T>`), so every string stays a Notion
 * slot owned by the page that prints it.
 */

const WIDTHS = { site: "max-w-site", wide: "max-w-wide", text: "max-w-[860px]" } as const

/** The page's side margins and a maximum width. */
export function Container({
  size = "site",
  className = "",
  children,
}: {
  size?: keyof typeof WIDTHS
  className?: string
  children: React.ReactNode
}) {
  return <div className={`mx-auto w-full px-5 sm:px-8 ${WIDTHS[size]} ${className}`.trim()}>{children}</div>
}

/** A section of a marketing page: its own landmark when it has a title,
 *  white or on the pale blue panel, which opens to the window's width
 *  as it comes in (`open` in app/globals.css). */
export function MarketingSection({
  id,
  labelledBy,
  tone = "page",
  size = "site",
  className = "",
  children,
}: {
  id?: string
  labelledBy?: string
  tone?: "page" | "panel"
  size?: keyof typeof WIDTHS
  className?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`py-16 sm:py-24 ${tone === "panel" ? "open bg-panel" : ""} ${className}`.trim()}>
      <Container size={size}>{children}</Container>
    </section>
  )
}

/** A section's eyebrow, title and lede, left-aligned or centred. It rises
 *  as it enters the page (`arrive` in app/globals.css): the mark of a new
 *  section starting. */
export function SectionHead({
  id,
  eyebrow,
  title,
  lede,
  align = "left",
  as: Tag = "h2",
  size = "display",
  className = "",
}: {
  id?: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  align?: "left" | "center"
  as?: "h1" | "h2" | "h3"
  size?: "display" | "section"
  className?: string
}) {
  const centred = align === "center"
  return (
    <div data-section-head className={`arrive ${centred ? "mx-auto text-center" : ""} max-w-[900px] ${className}`.replace(/\s+/g, " ").trim()}>
      {eyebrow ? <p className="eyebrow mb-3 text-body sm:text-lead">{eyebrow}</p> : null}
      <Tag
        id={id}
        className={size === "display" ? "title-slab title-display text-fluid-title" : "title-slab text-fluid-section"}
      >
        {title}
      </Tag>
      {lede ? <p className={`mt-4 text-lead leading-relaxed text-ink sm:text-head-s ${centred ? "mx-auto max-w-[680px]" : "max-w-[680px]"}`}>{lede}</p> : null}
    </div>
  )
}

/** "learn more →": a link that reads as a sentence, never a bare arrow. */
export function MoreLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex min-h-target items-center gap-1 text-lead font-medium text-strong underline-offset-4 hover:underline ${className}`.trim()}
      {...outsideLink(href)}
    >
      {children}
      <span aria-hidden="true" className="turn group-hover:translate-x-0.5">
        →
      </span>
    </a>
  )
}
