"use client"

import type React from "react"
import { useId, useRef, useState } from "react"

/**
 * Four cards that are also tabs: choosing one changes the picture under
 * them. The WAI-ARIA tabs pattern with automatic activation: the arrow keys
 * move along the cards (and wrap), Home and End jump to the ends, and only
 * the chosen card is in the tab order. Before the script runs, the first
 * card's panel shows.
 */
/** A tab: `title` is its name, so it is words that cannot be blank
 *  (plainText, not <T>); `text` says more and may be hidden. */
export type Tab = { key: string; title: string; text: React.ReactNode; panel: React.ReactNode }

export function FeatureTabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const base = useId()

  const choose = (i: number) => {
    const next = (i + tabs.length) % tabs.length
    setActive(next)
    refs.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, i: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => choose(i + 1),
      ArrowDown: () => choose(i + 1),
      ArrowLeft: () => choose(i - 1),
      ArrowUp: () => choose(i - 1),
      Home: () => choose(0),
      End: () => choose(tabs.length - 1),
    }
    const run = keys[event.key]
    if (run) {
      event.preventDefault()
      run()
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tabs.map((tab, i) => {
          const selected = i === active
          return (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${i}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(event) => onKeyDown(event, i)}
              className={`min-h-[44px] rounded-card border p-5 text-left tone ${
                selected ? "border-line-strong bg-card shadow-card" : "border-transparent bg-panel hover:bg-panel-strong"
              }`}
            >
              <span className="title-slab block text-head-s">{tab.title}</span>
              <span className="mt-1.5 block text-ui leading-snug text-sub">{tab.text}</span>
            </button>
          )
        })}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          tabIndex={0}
          className="mt-4 overflow-hidden rounded-panel border border-line bg-card shadow-card"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  )
}
