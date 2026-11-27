import type React from "react"
import Link from "next/link"
import { outsideLink } from "@/lib/outside"

/**
 * Buttons, the way Notion colours its own: primary is black with white type,
 * and on a dark page white with black type. Accent is the label's blue, for
 * the one thing a section most wants pressed beside a primary elsewhere.
 * Secondary is the pale blue with dark blue type; outline is Notion's quiet
 * bordered button; quiet has no box until it is hovered. Every row of
 * buttons is a `ButtonRow`; nothing else lays one out. All are at least 40px
 * tall, past WCAG 2.2's 24px target size. tests/contrast.test.mjs checks
 * each pair of colours in every look.
 */
export type Tone = "primary" | "accent" | "secondary" | "outline" | "quiet"

const BASE =
  "press inline-flex min-h-target items-center justify-center gap-1.5 rounded-full px-5 py-2 text-ui font-semibold leading-tight disabled:cursor-not-allowed disabled:opacity-60"

const TONES: Record<Tone, string> = {
  primary: "bg-btn text-btn-ink hover:bg-btn-hover",
  accent: "bg-cta text-cta-ink hover:bg-cta-hover",
  secondary: "border border-strong bg-transparent text-strong hover:bg-wash",
  outline: "border border-line-strong bg-page text-ink hover:bg-wash",
  quiet: "text-ink hover:bg-wash",
}

export const buttonClass = (tone: Tone = "primary", extra = "") => `${BASE} ${TONES[tone]} ${extra}`.trim()

/**
 * A link styled as a button. Web addresses, mail, files on this site and API
 * routes are plain `<a>`; pages are `next/link`. Outside links open in a new
 * tab with `noopener noreferrer`.
 */
export function ButtonLink({
  href,
  tone = "primary",
  className = "",
  children,
  ...rest
}: { href: string; tone?: Tone; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "className"
>) {
  const cls = buttonClass(tone, className)
  if (/^(https?:)?\/\//i.test(href) || /^(mailto|tel):/i.test(href) || href.startsWith("/api/") || href.startsWith("/media/")) {
    return (
      <a href={href} className={cls} {...outsideLink(href)} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  )
}

/** A row of buttons: wraps, never stretches them. Buttons only, since
 *  the gap is set for pills: a bare text link beside one looks jammed
 *  against it, and `quiet` is the button that reads as a link
 *  (`checkButtonRows` in tests/dom/support/checks.ts). */
export function ButtonRow({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-buttons="" className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {children}
    </div>
  )
}
