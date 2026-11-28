"use client"

import type React from "react"
import { useEffect, useState } from "react"

import { applyTheme, nextTheme, readThemeChoice, syncThemeColour, THEME_CHOICES, THEME_KEY, THEMES, writeThemeChoice, type Theme, type ThemeChoice } from "@/lib/theme"

/**
 * Keeps the page in step with the system when the choice is "system", and
 * with another tab when the reader changes the look there.
 */
function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system")
  useEffect(() => {
    setChoice(readThemeChoice())
    syncThemeColour()
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSystem = () => {
      if (readThemeChoice() === "system") applyTheme("system")
    }
    const onChoice = (e: Event) => setChoice((e as CustomEvent<ThemeChoice>).detail)
    const onOtherTab = (e: StorageEvent) => {
      if (e.key !== THEME_KEY && e.key !== null) return
      const now = readThemeChoice()
      applyTheme(now)
      setChoice(now)
    }
    media.addEventListener?.("change", onSystem)
    window.addEventListener("site-theme-change", onChoice)
    window.addEventListener("storage", onOtherTab)
    return () => {
      media.removeEventListener?.("change", onSystem)
      window.removeEventListener("site-theme-change", onChoice)
      window.removeEventListener("storage", onOtherTab)
    }
  }, [])
  return [choice, writeThemeChoice]
}

/**
 * The header's switch: each press moves to the next look (light, dark, mono,
 * rainbow, and round again) from whichever is showing. It shows the icon of
 * the look showing; app/globals.css picks it by `data-theme`, so the server's
 * HTML is right before any script runs. Choosing "system" again is the
 * footer's job.
 *
 * The icons are handed in drawn (components/ui/theme-icons.tsx), so their
 * paths never ship to a browser.
 */
export function ThemeToggle({ className = "", label, icons }: { className?: string; label: string; icons: Record<Theme, React.ReactNode> }) {
  const [, set] = useThemeChoice()
  const cycle = () => set(nextTheme(document.documentElement.dataset.theme))
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sub tone hover:bg-wash hover:text-ink ${className}`.trim()}
    >
      {THEMES.map((theme) => (
        <span key={theme} data-theme-icon={theme} className="text-lead">
          {icons[theme]}
        </span>
      ))}
    </button>
  )
}

/**
 * The footer's full choice, as Notion's appearance setting offers it: follow
 * the system, or one of the four looks. Native radio buttons, so the arrow
 * keys move between them. Each name has a small swatch of its look beside
 * it, drawn by app/globals.css (`.theme-swatch`).
 */
export function ThemeSelect({ label, names }: { label: string; names: Record<ThemeChoice, string> }) {
  const [choice, set] = useThemeChoice()
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-fine text-sub">
        {label}
      </span>
      {/* On a phone, five equal columns, each look's mark over its word, in a
          card (its options blocks, the card's corner less its 6px gap): five
          pills in a row are wider than a phone, and wrapped they left one
          alone on a second line. From sm, one row of pills. */}
      <div className="grid w-full grid-cols-5 rounded-card border border-line-strong p-1.5 sm:inline-flex sm:w-auto sm:rounded-full sm:p-0.5">
        {THEME_CHOICES.map((value) => (
          <label key={value} className="relative min-w-0">
            <input type="radio" name="theme" value={value} checked={choice === value} onChange={() => set(value)} className="peer sr-only" />
            <span className="flex min-h-target cursor-pointer flex-col items-center justify-center gap-1 rounded-block px-1 py-1.5 text-center text-fine text-sub tone hover:text-ink peer-checked:bg-wash peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-focus peer-focus-visible:outline-accent sm:flex-row sm:rounded-full sm:px-2 sm:py-0.5">
              <span aria-hidden="true" className="theme-swatch" data-swatch={value} />
              {names[value]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
