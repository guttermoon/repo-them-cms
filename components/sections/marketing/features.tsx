import type React from "react"

import { MoreLink } from "./layout"

/**
 * The feature layouts: short columns, a bento of cards with pictures, a
 * split of words and a picture, a hub with what connects to it, and a grid
 * of plain facts. Headings inside them are h3s under the section's h2.
 */

export type Feature = { key: string; title: React.ReactNode; text: React.ReactNode }

/** Three (or four) short columns: a small title and a few lines each.
 *  Centred under a centred heading, so the section reads one way (`align`). */
export function FeatureColumns({ items, columns = 3, align = "left" }: { items: Feature[]; columns?: 2 | 3 | 4; align?: "left" | "center" }) {
  const grid = columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
  return (
    <ul className={`grid gap-x-10 gap-y-10 ${grid} ${align === "center" ? "text-center" : ""}`.trim()}>
      {items.map((item) => (
        <li key={item.key}>
          <h3 className="title-slab text-head-s">{item.title}</h3>
          <p className="mt-3 text-body leading-relaxed text-sub">{item.text}</p>
        </li>
      ))}
    </ul>
  )
}

export type BentoItem = Feature & { art?: React.ReactNode; href?: string; more?: React.ReactNode }

/** Cards two by two, each with a small picture of the thing it describes. */
export function Bento({ items }: { items: BentoItem[] }) {
  return (
    <ul className="arrive-each grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.key} className="lit flex flex-col overflow-hidden rounded-card bg-panel">
          <div className="p-6 sm:p-8">
            <h3 className="title-slab text-head-s sm:text-head-m">{item.title}</h3>
            {/* a div, not a p: a card's words may be whole paragraphs (a Notion column) */}
            <div className="mt-2 max-w-[460px] text-body leading-relaxed text-sub sm:text-lead">{item.text}</div>
            {item.href && item.more ? <MoreLink href={item.href} className="mt-3 text-body">{item.more}</MoreLink> : null}
          </div>
          {item.art ? <div className="mt-auto px-6 pb-6 sm:px-8 sm:pb-8">{item.art}</div> : null}
        </li>
      ))}
    </ul>
  )
}

/** Words beside a picture, the picture on either side. Its title is an
 *  h3 under a section's heading, or an h2 where it heads a section itself. */
export function SplitFeature({
  id,
  eyebrow,
  title,
  text,
  more,
  media,
  reverse = false,
  heading: Heading = "h3",
}: {
  id: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  text: React.ReactNode
  more?: { href: string; label: React.ReactNode }
  media: React.ReactNode
  reverse?: boolean
  heading?: "h2" | "h3"
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={`arrive ${reverse ? "lg:order-2" : ""}`.trim()}>
        {eyebrow ? <p className="eyebrow mb-3 text-body sm:text-lead">{eyebrow}</p> : null}
        <Heading id={id} className="title-slab title-display text-fluid-title">
          {title}
        </Heading>
        <p className="mt-5 max-w-[540px] text-lead leading-relaxed text-ink sm:text-head-s">{text}</p>
        {more ? <MoreLink href={more.href} className="mt-5">{more.label}</MoreLink> : null}
      </div>
      {/* the picture hangs and turns to face the words beside it */}
      <div className={`depth ${reverse ? "lg:order-1" : ""}`.trim()} style={{ "--yaw": reverse ? "14deg" : "-14deg" } as React.CSSProperties}>
        {media}
      </div>
    </div>
  )
}

/** Plain facts with a tick: security, privacy, what is promised. */
export function TrustFacts({ items }: { items: Feature[] }) {
  return (
    <ul className="arrive-each grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.key} className="flex gap-4">
          <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div>
            <h3 className="title-slab text-head-s">{item.title}</h3>
            <p className="mt-1.5 text-body leading-relaxed text-sub">{item.text}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
