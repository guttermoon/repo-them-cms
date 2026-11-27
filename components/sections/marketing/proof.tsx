import type React from "react"

import { TOOL_MARKS } from "@/lib/brand-marks"
import { plainText, slotHidden } from "@/lib/slots"
import type { SiteCopy } from "@/lib/notion/rows"
import { picture } from "@/lib/media-sizes"
import { safeHref } from "@/lib/inline-links"
import { outsideLink } from "@/lib/outside"

/**
 * The proof: a strip of logos (or of names, where there are no logos), a
 * row of figures, and quotations. Nothing here may claim what is not so:
 * the figures are facts or are worked out, a logo is somebody who said
 * yes (or a tool the site works with, under a "works with" label), and a
 * quotation is somebody's real words (docs/brand.md).
 */

/** A logo: a picture (a Logo row's), a one-colour mark drawn here (a path
 *  in a 24 box, lib/brand-marks.ts) beside the name, or the name alone. */
export type LogoItem = { key: string; name: string; src?: string; mark?: string; href?: string }

/** The strip's items: the database's Logo rows, or with none, the marks of
 *  the tools the site works with (lib/brand-marks.ts). Each tool's name is a
 *  slot, `logos.<tool>`: a copy that does not use a tool publishes its row
 *  blank, and the mark goes. A row's Link is typed by a person, so it is
 *  drawn only when `safeHref` allows it. */
export function logoItems(rows: { id: string; title: string; cover?: string; link?: string }[], content: SiteCopy): LogoItem[] {
  if (rows.length) return rows.map((row) => ({ key: row.id, name: row.title, src: row.cover, href: row.link ? safeHref(row.link) : undefined }))
  return TOOL_MARKS.filter((tool) => !slotHidden(content, `logos.${tool.key}`)).map((tool) => ({
    key: tool.key,
    name: plainText(content, `logos.${tool.key}`, tool.name),
    mark: tool.path,
  }))
}

/** A label, then a row of logos. A mark is drawn in the colour of the words
 *  (black on light, white on dark); without a picture or a mark the name is
 *  set as a word, which is how a "works with" list stays honest. */
export function LogoStrip({ label, items, align = "center" }: { label?: React.ReactNode; items: LogoItem[]; /** as the heading it stands under is set */ align?: "left" | "center" }) {
  if (!items.length) return null
  const centred = align === "center"
  return (
    <div className={centred ? "text-center" : ""}>
      {label ? <p className="text-ui text-sub">{label}</p> : null}
      <ul className={`appear-each mt-5 flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-5 lg:gap-x-10 ${centred ? "mx-auto justify-center" : ""}`.trim()}>
        {items.map((item) => {
          const face = item.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...picture(item.src, 160)} alt={item.name} className="h-8 w-auto max-w-[160px] object-contain opacity-80 grayscale tone hover:opacity-100 hover:grayscale-0 dark:invert" />
          ) : item.mark ? (
            <span className="inline-flex items-center gap-2 text-ink">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-[22px] w-[22px] shrink-0" fill="currentColor">
                <path d={item.mark} />
              </svg>
              <span className="text-lead font-semibold tracking-[-0.01em]">{item.name}</span>
            </span>
          ) : (
            <span className="title-slab title-solid text-head-s text-sub sm:text-head-m">{item.name}</span>
          )
          return (
            <li key={item.key} className="flex min-h-target items-center">
              {item.href ? (
                <a href={item.href} {...outsideLink(item.href)} className="inline-flex min-h-target items-center rounded-text">
                  {face}
                </a>
              ) : (
                face
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export type Stat = { key: string; value: React.ReactNode; label: React.ReactNode }

/**
 * Three big figures: on pale cards, or, on a section that is a panel
 * already (`band`), as a centred row with no box, since a card the colour
 * of its ground is invisible and leaves only its padding, an indent that
 * looks like a mistake.
 */
export function StatCards({ items, band = false }: { items: Stat[]; band?: boolean }) {
  return (
    <ul className={band ? "arrive-each grid gap-12 text-center sm:grid-cols-3 sm:gap-10" : "arrive-each grid gap-4 sm:grid-cols-3"}>
      {items.map((stat) => (
        <li key={stat.key} className={band ? undefined : "rounded-card bg-panel p-6 sm:p-8"}>
          <p className="title-slab title-display text-fluid-title">{stat.value}</p>
          <p className={`max-w-[260px] text-lead text-ink ${band ? "mx-auto mt-4 leading-relaxed" : "mt-3 leading-snug"}`}>{stat.label}</p>
        </li>
      ))}
    </ul>
  )
}

export type QuoteView = { quote: React.ReactNode; name: React.ReactNode; role?: React.ReactNode; logo?: { src: string; alt: string }; photo?: { src: string; alt: string } }

/** What was said, in the serif at `size`, between quotation marks a screen
 *  reader leaves out (the blockquote says it is a quotation already). */
function QuoteWords({ size, children }: { size: string; children: React.ReactNode }) {
  return (
    <blockquote className={`font-serif ${size} leading-normal text-ink`}>
      <p>
        <span aria-hidden="true">“</span>
        {children}
        <span aria-hidden="true">”</span>
      </p>
    </blockquote>
  )
}

/** A quotation set large and centred, in the serif. */
export function Quote({ quote, name, role, logo, photo }: QuoteView) {
  return (
    <figure className="arrive mx-auto max-w-[900px] text-center">
      <QuoteWords size="text-fluid-section">{quote}</QuoteWords>
      <figcaption className="mt-8 flex flex-col items-center gap-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...picture(logo.src, 160)} alt={logo.alt} className="h-9 w-auto" />
        ) : null}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...picture(photo.src, 96)} alt={photo.alt} className="h-12 w-12 rounded-full object-cover" />
        ) : null}
        <span className="text-lead font-semibold text-ink">{name}</span>
        {role ? <span className="text-body text-sub">{role}</span> : null}
      </figcaption>
    </figure>
  )
}

/** The small one, beside the plans on a pricing page. */
export function QuoteCard({ quote, name, role, logo }: QuoteView) {
  return (
    <figure className="max-w-[460px]">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...picture(logo.src, 160)} alt={logo.alt} className="mb-4 h-7 w-auto" />
      ) : null}
      <QuoteWords size="text-head-s">{quote}</QuoteWords>
      <figcaption className="mt-4 text-small">
        <span className="block font-semibold text-ink">{name}</span>
        {role ? <span className="block text-sub">{role}</span> : null}
      </figcaption>
    </figure>
  )
}
