import type React from "react"

import { MARK_R_PATH, MARK_RIM, MARK_VIEWBOX } from "@/lib/brand/mark"
import { picture } from "@/lib/media-sizes"
import type { SiteLogo } from "@/lib/share"

/**
 * The generic label: a white box, a lowercase word in heavy slab type, and
 * the band round the tin (a dark line, a light band, a dark line), the way
 * no-frills groceries were packed at the end of the seventies. The small
 * print says what is in the tin.
 */

/** The mark: the "r" in its rounded square (lib/brand/mark.ts, drawn by
 *  scripts/build-icons.mjs). Decorative wherever the name is beside it.
 *  Coloured by the band's two tokens, so it follows the look: the label's
 *  blues in light (the favicon's, MARK_BRAND and MARK_TINT, which
 *  tests/contrast.test.mjs holds equal), the glow in dark, black on grey in
 *  mono, violet on yellow in rainbow. */
export function Mark({ className = "h-7 w-7", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      className={`mark shrink-0 ${className}`.trim()}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      focusable="false"
    >
      <rect
        x={MARK_RIM.x}
        y={MARK_RIM.y}
        width={MARK_RIM.size}
        height={MARK_RIM.size}
        rx={MARK_RIM.radius}
        className="fill-tint stroke-brand"
        strokeWidth={MARK_RIM.stroke}
      />
      <path d={MARK_R_PATH} className="fill-brand" />
    </svg>
  )
}

/**
 * Where the mark stands, the site's own logo from Notion (`site.logo`,
 * lib/share.ts) when it has one: as tall as the mark, as wide as it is
 * drawn, up to 160px. In the dark look, its `site.logo.dark` if there is
 * one, else the logo inverted, dark ink turned light (the look's tint then
 * takes it, as it takes every picture). The link round it is named in
 * words, so the picture is decoration.
 */
export function SiteMark({ logo, className = "h-9 w-9" }: { logo?: SiteLogo; className?: string }) {
  if (!logo) return <Mark className={className} />
  const shape = "h-9 w-auto max-w-[160px] shrink-0 object-contain"
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...picture(logo.src, 160)} alt="" data-logo className={`${shape} ${logo.dark ? "dark:hidden" : "dark:invert"}`} />
      {logo.dark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img {...picture(logo.dark, 160)} alt="" data-logo className={`${shape} hidden dark:block`} />
      ) : null}
    </>
  )
}

/** The product's name as a word on a box: lowercase slab, in the heading
 *  blue. The text stays as written ("REPO THEM"); only its drawing changes. */
export function Wordmark({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <span className={`title-slab ${className}`.trim()}>{children}</span>
}

/** The band round the tin. Decorative. */
export function Stripe({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClass = size === "sm" ? "stripe-sm" : size === "lg" ? "stripe-lg" : ""
  return <div aria-hidden="true" className={`stripe ${sizeClass} ${className}`.replace(/\s+/g, " ").trim()} />
}

/** A small lowercase slab label over a section or a list: "contents",
 *  "directions". In the ink unless a colour is given. */
export function Label({
  as: Tag = "p",
  className = "",
  id,
  children,
}: {
  as?: "p" | "h2" | "h3" | "span"
  className?: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <Tag id={id} className={`label text-small text-ink ${className}`.trim()}>
      {children}
    </Tag>
  )
}

/**
 * The tin: a white box holding the generic noun in huge lowercase slab, the
 * band, and the net contents underneath. When it is the page's title the
 * whole label is the <h1> (brand + noun), so search reads "REPO THEM
 * WEBSITE"; elsewhere it is a picture of a box and says so.
 */
export function Package({
  brand,
  noun,
  band,
  smallPrint,
  as = "h1",
  className = "",
}: {
  brand: React.ReactNode
  noun: React.ReactNode
  band?: React.ReactNode
  smallPrint?: React.ReactNode
  as?: "h1" | "h2" | "div"
  className?: string
}) {
  const Title = as
  return (
    <div className={`w-full rounded-panel border border-line-strong bg-card shadow-card ${className}`.trim()}>
      <div className="px-5 pb-3 pt-5 sm:px-9 sm:pt-8">
        <Title>
          <span className="eyebrow block text-small sm:text-lead">{brand}</span>
          <span className="title-slab title-display mt-2 block text-fluid-giant">{noun}</span>
        </Title>
      </div>
      <Stripe size="lg" className="mt-3" />
      {band ? (
        <div className="px-5 pt-3 sm:px-9">
          <p className="label text-ui text-heading sm:text-lead">{band}</p>
        </div>
      ) : null}
      {smallPrint ? (
        <div className="px-5 pb-5 pt-2 sm:px-9">
          <p className="small-print text-sub">{smallPrint}</p>
        </div>
      ) : (
        <div className="pb-5" />
      )}
    </div>
  )
}
