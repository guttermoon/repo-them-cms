import type React from "react"

import { Icon } from "@/components/ui/icon"
import { Mark } from "@/components/ui/label"
import { PROPS } from "@/lib/notion/schema"

/**
 * Small pictures of the template's own parts, for cards and tabs: a
 * database, a page, a price list, a sign-up form, a lock, a contrast
 * figure, a row's value travelling, a calendar, a browser window. Built from the site's own pieces in plain HTML and CSS
 * (not screenshots, and not Notion's app: Notion's brand rules ask that its
 * interface is not imitated), so they follow the theme and cost no request.
 * Every one is decorative: the card around it says what it shows.
 */

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`select-none rounded-card border border-line bg-card p-4 text-fine text-ink shadow-card ${className}`.trim()}>
      {children}
    </div>
  )
}

const Line = ({ w, className = "" }: { w: string; className?: string }) => <span className={`block h-2 rounded-full bg-line-strong ${className}`} style={{ width: w }} />

const KIND: Record<string, string> = { Page: "n-tag-brown", Post: "n-tag-green", "Site Copy": "n-tag-gray", Product: "n-tag-orange", Plan: "n-tag-blue" }

/** A database: rows with their Kind and Published. */
export function MiniTable({ rows }: { rows: { kind: string; title: string; on: boolean }[] }) {
  return (
    <Frame className="p-0">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-line px-4 py-2 text-fine text-sub">
        {/* the database's own property names */}
        <span>{PROPS.title}</span>
        <span>{PROPS.kind}</span>
        <span>{PROPS.published}</span>
      </div>
      {rows.map((row, i) => (
        // by place: two rows can say the same thing
        <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-line px-4 py-2 last:border-b-0">
          <span className="truncate font-medium">{row.title}</span>
          <span className={`${KIND[row.kind] ?? "n-tag-default"} rounded-full px-1.5 text-fine`}>{row.kind}</span>
          <span className={`flex h-4 w-4 items-center justify-center justify-self-center rounded-text ${row.on ? "bg-brand text-white" : "border-[1.5px] border-line-strong"}`}>
            {row.on ? (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            ) : null}
          </span>
        </div>
      ))}
    </Frame>
  )
}

/** Two little price cards. */
export function MiniPricing({ plans }: { plans: { name: string; price: string; on?: boolean }[] }) {
  return (
    <div aria-hidden="true" className="grid select-none grid-cols-2 gap-3">
      {plans.map((plan, i) => (
        <div key={i} className={`rounded-block border bg-card p-3 shadow-card ${plan.on ? "border-2 border-brand dark:border-accent" : "border-line"}`}>
          <span className="title-slab block text-body">{plan.name}</span>
          <span className="title-slab mt-1 block text-head-s">{plan.price}</span>
          <span className={`mt-2 block h-6 rounded-full ${plan.on ? "bg-btn" : "border border-line-strong"}`} />
          <div className="mt-3 space-y-1.5">
            <Line w="80%" />
            <Line w="66%" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A sign-up form, filled in. */
export function MiniForm({ address, button, note }: { address: string; button: string; note: string }) {
  return (
    <Frame>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-full border border-line-strong px-3 py-1.5 text-sub">{address}</span>
        <span className="rounded-full bg-btn px-3 py-1.5 font-semibold text-btn-ink">{button}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-fine text-sub">
        <span className="h-2 w-2 rounded-full bg-[color:var(--n-green)]" />
        <span>{note}</span>
      </div>
    </Frame>
  )
}

/** A padlock, a figure and what it counts: the figure is the caller's (a
 *  slot), since it is a claim, not a sum. */
export function MiniShield({ value, caption }: { value: string; caption: string }) {
  return (
    <Frame className="flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      </span>
      <span>
        <span className="title-slab block text-head-l leading-none">{value}</span>
        <span className="mt-1 block text-fine text-sub">{caption}</span>
      </span>
    </Frame>
  )
}

/** One fact written once and every place that prints it: a row's value,
 *  and the same value in each place, so a change in one row is a change in
 *  all of them. Every word is the caller's (slots). */
export function MiniFanout({ source, value, places }: { source: string; value: string; places: string[] }) {
  return (
    <Frame className="flex flex-col gap-3">
      <span className="flex items-center justify-between gap-3 self-start rounded-block border border-line-strong px-3 py-2">
        <span className="text-ui font-medium">{source}</span>
        <span className="title-slab text-lead text-brand">{value}</span>
      </span>
      <span className="flex items-start gap-2">
        <span className="text-lead leading-none text-sub">↳</span>
        <span className="flex flex-wrap gap-1.5">
          {places.map((place, i) => (
            // by place: the words are slots, and two may be blank alike
            <span key={i} className="rounded-full bg-tint px-2.5 py-1 text-fine text-brand">
              {place} <span className="font-semibold">{value}</span>
            </span>
          ))}
        </span>
      </span>
    </Frame>
  )
}

/** The contrast every word is held to, and what else a reader may lean on
 *  (a keyboard, a screen reader, stillness): a figure, with a tick for each.
 *  Every word is the caller's (slots). */
export function MiniAccess({ value, caption, checks }: { value: string; caption: string; checks: string[] }) {
  return (
    <Frame className="flex flex-col gap-3">
      <span className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tint text-head-m text-brand">
          <Icon name="circle-half" />
        </span>
        <span>
          <span className="title-slab block text-head-l leading-none">{value}</span>
          <span className="mt-1 block text-fine text-sub">{caption}</span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {checks.map((check, i) => (
          <span key={i} className="rounded-full bg-tint px-2.5 py-1 text-fine text-brand">
            ✓ {check}
          </span>
        ))}
      </span>
    </Frame>
  )
}

/** A week with posts dropped into it. */
export function MiniCalendar({ days }: { days: { day: string; post?: string }[] }) {
  return (
    <Frame>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div key={i} className="min-h-[64px] rounded-block border border-line p-1.5">
            <span className="block text-micro text-sub">{d.day}</span>
            {d.post ? <span className="mt-1 block truncate rounded-full bg-tint px-1.5 text-micro font-medium text-brand">{d.post}</span> : null}
          </div>
        ))}
      </div>
    </Frame>
  )
}

/** A browser window round a little site: the page's own words in it
 *  (`name`, `headline`), or whatever is passed as children. */
export function MiniBrowser({ host, name, headline, children }: { host: string; name?: string; headline?: string; children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="select-none overflow-hidden rounded-card border border-line bg-card shadow-card">
      <div className="flex items-center gap-1.5 border-b border-line bg-wash px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 truncate rounded-full bg-card px-2.5 py-0.5 text-micro text-sub">{host}</span>
      </div>
      <div className="p-4">
        {children ?? (
          <>
            <div className="flex items-center gap-2">
              <Mark className="h-5 w-5" />
              <span className="title-slab text-ui">{name}</span>
            </div>
            <span className="title-slab title-display mt-4 block text-head-l">{headline}</span>
            <div className="mt-3 space-y-2">
              <Line w="70%" />
              <Line w="52%" />
            </div>
            <div className="stripe stripe-sm mt-4" />
          </>
        )}
      </div>
    </div>
  )
}
