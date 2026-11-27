import type React from "react"

import type { NotionColor } from "@/lib/notion/schema"
import { Icon } from "./icon"

/**
 * Notion's blocks, for pages designed in code: the same look the renderer
 * gives a page written in Notion (components/notion/blocks.tsx draws with
 * these where it can), so the two kinds of page cannot drift apart.
 */

const bg = (color?: NotionColor) => (color && color !== "default" ? `n-bg-${color}` : "")

/** A callout: an icon (the site's lightbulb unless given one) and words on a
 *  tinted panel. */
export function Callout({
  icon = <Icon name="lightbulb" />,
  color = "gray",
  className = "",
  children,
}: {
  icon?: React.ReactNode
  color?: NotionColor
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`n-callout ${bg(color)} ${className}`.trim()}>
      <span aria-hidden="true" className="n-c-gray flex h-6 w-6 shrink-0 items-center justify-center text-head-s leading-none">
        {icon}
      </span>
      <div className="min-w-0 flex-1 [&>p:first-child]:mt-0 [&>p]:mt-2">{children}</div>
    </div>
  )
}

/** A toggle: the summary, and the rest behind a triangle. */
export function Toggle({
  summary,
  className = "",
  open = false,
  children,
}: {
  summary: React.ReactNode
  className?: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details className={`group py-[3px] ${className}`.trim()} open={open}>
      <summary className="flex min-h-target items-start gap-1 rounded-block px-0.5 py-2.5 hover:bg-wash">
        <span aria-hidden="true" className="n-toggle-mark mt-[3px] h-[18px] w-[18px] shrink-0 items-center justify-center text-micro text-ink">
          ▶
        </span>
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="pl-[22px] pt-1 [&>p:first-child]:mt-0">{children}</div>
    </details>
  )
}

/** A quote block. */
export function Quote({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <blockquote className={`n-quote ${className}`.trim()}>{children}</blockquote>
}

/** A divider. */
export function Divider({ className = "" }: { className?: string }) {
  return <div role="separator" className={`n-divider ${className}`.trim()} />
}

/**
 * A to-do list item: the box, then the words, struck through when done.
 * `label` says the box's state to a screen reader ("Done", from the page's
 * copy); without one the box is only the look of a list, and is hidden.
 */
export function Todo({ done = false, label, children }: { done?: boolean; label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-[3px]">
      <span
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
        className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-text ${done ? "bg-brand" : "border-[1.5px] border-ink"}`}
      >
        {done ? (
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path d="M5.5 12 1.5 8l1.4-1.4 2.6 2.6 5.6-5.6L12.5 5z" fill="#fff" />
          </svg>
        ) : null}
      </span>
      <span className={done ? "text-sub line-through decoration-[rgba(55,53,47,0.4)]" : ""}>{children}</span>
    </div>
  )
}

/** Columns, side by side from `sm`, stacked below it. */
export function Columns({ count = 2, className = "", children }: { count?: 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[count]
  return <div className={`grid grid-cols-1 gap-x-6 gap-y-4 ${cols} ${className}`.trim()}>{children}</div>
}
