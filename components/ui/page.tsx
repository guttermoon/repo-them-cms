import type React from "react"
import Link from "next/link"

import type { NotionColor } from "@/lib/notion/schema"
import { coverFrame, coverStyle } from "@/lib/cover"
import { picture } from "@/lib/media-sizes"

/**
 * The page frame, laid out the way Notion lays out a page: a 708px column
 * (Notion's default width), or the wide one, with an optional cover, an
 * icon and a 40px title above the body.
 */

/** A page's column. `wide` is Notion's full-width option. */
export function Frame({
  wide = false,
  className = "",
  children,
}: {
  wide?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`mx-auto w-full px-5 sm:px-8 ${wide ? "max-w-wide" : "max-w-[772px]"} ${className}`.trim()}>
      {children}
    </div>
  )
}

/**
 * The top of a Notion page: cover (full width), icon (overlapping the cover
 * when there is one), title, then a row of properties.
 */
export function PageHeader({
  title,
  icon,
  cover,
  description,
  properties,
  label,
  wide = false,
}: {
  title: React.ReactNode
  /** an icon (components/ui/icon), or Notion's (components/notion/icon) */
  icon?: React.ReactNode
  /** `at`: where it is cut, from the top (0) to the bottom (100); `tint`
   *  false shows it as uploaded (Cover Tint Off) */
  cover?: { src: string; alt: string; at?: number; tint?: boolean }
  description?: React.ReactNode
  properties?: React.ReactNode
  /** a generic label above the title: "PAGE", "POST" */
  label?: React.ReactNode
  wide?: boolean
}) {
  return (
    <header>
      {cover ? (
        // printed in the look's own ink, unless Cover Tint is Off (lib/cover.ts)
        <div {...coverFrame(cover.tint, "h-[30vh] max-h-[280px] min-h-[160px] w-full overflow-hidden")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...picture(cover.src, "100vw", { eager: true })} alt={cover.alt} style={coverStyle(cover.at)} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <Frame wide={wide} className={cover ? "settle" : "settle pt-12 sm:pt-16"}>
        {icon ? (
          // over the cover, not under it: the cover's tint makes it a layer of
          // its own, which would otherwise be drawn above the icon
          <div className={`n-c-gray relative z-10 flex h-[78px] w-[78px] items-center text-display leading-none ${cover ? "-mt-[39px]" : ""}`}>{icon}</div>
        ) : null}
        {label ? <p className={`eyebrow text-ui ${icon ? "mt-4" : cover ? "mt-8" : ""}`}>{label}</p> : null}
        <h1 className={`title-slab title-display mt-2 text-head-l sm:text-display ${!icon && !label && cover ? "mt-8" : ""}`}>{title}</h1>
        {description ? <p className="mt-3 text-lead leading-relaxed text-ink">{description}</p> : null}
        {properties ? <div className="mt-5 border-b border-line pb-4">{properties}</div> : null}
      </Frame>
    </header>
  )
}

/** One property row, the way Notion lists a page's properties: name, value. */
export function PropertyRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-target items-center gap-2 text-small">
      <span className="w-28 shrink-0 text-sub">{name}</span>
      <span className="min-w-0 text-ink">{children}</span>
    </div>
  )
}

/** A select option, as Notion draws one: a coloured pill. */
export function Tag({ color = "default", children }: { color?: NotionColor; children: React.ReactNode }) {
  return (
    <span className={`n-tag-${color} inline-flex h-5 max-w-full items-center whitespace-nowrap rounded-full px-2 text-small leading-5 text-ink`}>
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * A tag that is a link (a category, a tag, a section of the page). The link
 * is the full 24px tall the tag is drawn inside (WCAG 2.5.8), and it is held
 * to its row's width, so a long tag shortens with an ellipsis rather than
 * running off a phone's screen.
 */
export function TagLink({ href, color, children }: { href: string; color?: NotionColor; children: React.ReactNode }) {
  const className = "inline-flex min-h-target max-w-full items-center rounded-full hover:opacity-80"
  const tag = <Tag color={color}>{children}</Tag>
  // a jump within the page needs no client-side navigation
  return href.startsWith("#") ? (
    <a href={href} className={className}>
      {tag}
    </a>
  ) : (
    <Link href={href} className={className}>
      {tag}
    </Link>
  )
}

/** Vertical rhythm between the parts of a designed page. */
export function Section({
  id,
  className = "",
  children,
  labelledBy,
}: {
  id?: string
  className?: string
  children: React.ReactNode
  labelledBy?: string
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`py-10 sm:py-14 ${className}`.trim()}>
      {children}
    </section>
  )
}

/** A section's title in the label's lettering; `label` sets the eyebrow
 *  above it. `size="display"` is the big, tight setting of a marketing
 *  section ("all your content, in one place"). */
export function Heading({
  id,
  label,
  as: Tag = "h2",
  size = "section",
  className = "",
  children,
}: {
  id?: string
  label?: React.ReactNode
  as?: "h2" | "h3"
  size?: "display" | "section" | "card"
  className?: string
  children: React.ReactNode
}) {
  const SIZES = {
    display: "title-slab title-display text-fluid-title",
    section: "title-slab text-head-m sm:text-head-l",
    card: "title-slab text-head-s",
  }
  return (
    <div className={className}>
      {label ? <p className="eyebrow mb-2 text-ui sm:text-lead">{label}</p> : null}
      <Tag id={id} className={SIZES[size]}>
        {children}
      </Tag>
    </div>
  )
}

/** A paragraph of body copy. */
export function Text({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <p className={`mt-3 text-body leading-[1.6] text-ink ${className}`.trim()}>{children}</p>
}
