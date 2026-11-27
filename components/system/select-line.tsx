"use client"

import { useEffect, useId, useRef, useState } from "react"

import { useBeforePaint } from "@/components/hooks/use-before-paint"

/**
 * The site's select: a pill that opens a menu, drawn in the site's own type
 * and colours (a native `<select>` opens a list drawn by the operating
 * system that no CSS reaches). The keyboard behaviour a select gives for
 * free is written out: arrows move, Home and End jump, Enter and Space
 * choose, Escape closes and returns focus, Tab closes and moves on, a click
 * elsewhere closes it, and typing letters jumps to the first match.
 * `role="listbox"`/`"option"` and `aria-expanded` tell a screen reader it is
 * the same control.
 *
 * Its shape follows the site's (docs/design.md, "Shape"): the button is a
 * field (`.field`, a pill), the menu a card, and each option a block, the
 * card's corner less the menu's padding. The chosen option carries a tick;
 * the one under the pointer or the keys is washed. The menu opens below,
 * or above when the screen has no room below, and lines up with the
 * button's start or, for a select at the end of a row, its end.
 *
 * Used by the contact form, the shop's sort and a product's variants.
 */
export type SelectOption = {
  value: string
  /** what the list shows */
  label: string
  /** what the closed button shows, when that should be shorter than the label */
  short?: string
}

/** A pause this long between keys starts the typeahead afresh, as a native
 *  select does. */
const TYPEAHEAD_RESET_MS = 1000

/** The gap between the button and its menu, in px (`mt-2`/`mb-2`). */
const MENU_GAP = 8

export function SelectLine({
  value,
  onChange,
  options,
  label,
  className = "",
  align = "start",
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** the accessible name — a legend or a field label does not name a button */
  label: string
  className?: string
  /** which edge of the button the menu lines up with: "end" for a select
   *  at the end of a row (the shop's sort), so the menu stays on screen */
  align?: "start" | "end"
  /** What the button says while nothing is chosen, for a field that starts
   *  empty (the contact form's "What is it about?"). Without one, an empty
   *  value shows the first option, as a native select does. */
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  /** the menu opens upward when the screen has no room for it below */
  const [up, setUp] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  /** what has been typed in the last second, for the typeahead */
  const typed = useRef({ text: "", at: 0 })

  const chosen = options.findIndex((o) => o.value === value)
  const current = chosen === -1 && placeholder !== undefined ? undefined : (options[chosen] ?? options[0])

  const show = () => {
    setActive(chosen === -1 ? 0 : chosen)
    setUp(false)
    setOpen(true)
  }
  const hide = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const choose = (i: number) => {
    onChange(options[i].value)
    hide()
  }

  // a click anywhere outside closes it — but not one on the button, which
  // would close and reopen in the same gesture
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", away)
    return () => document.removeEventListener("mousedown", away)
  }, [open])

  // below if it fits; above if it does not and there is more room there
  useBeforePaint(() => {
    const menu = list.current
    const button = trigger.current
    if (!open || !menu || !button) return
    const height = menu.offsetHeight
    const { top, bottom } = button.getBoundingClientRect()
    setUp(bottom + height + MENU_GAP > window.innerHeight && top - height - MENU_GAP > 0)
  }, [open])

  // focus follows the active option, which is what makes the arrows work for a
  // screen reader as well as for the eye, and what scrolls a long list
  useEffect(() => {
    if (!open) return
    const els = list.current?.querySelectorAll<HTMLElement>('[role="option"]')
    els?.[active]?.focus()
  }, [open, active])

  const keys = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        hide()
        return
      case "Tab":
        // as the native one: the list closes and focus goes where Tab takes it
        hide(false)
        return
      case "ArrowDown":
        e.preventDefault()
        setActive((i) => Math.min(options.length - 1, i + 1))
        return
      case "ArrowUp":
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        return
      case "Home":
        e.preventDefault()
        setActive(0)
        return
      case "End":
        e.preventDefault()
        setActive(options.length - 1)
        return
      case "Enter":
      case " ":
        e.preventDefault()
        choose(active)
        return
    }
    // Typeahead. A single printable character, and repeats of the same one step
    // through the options beginning with it — which is how a native select
    // behaves, and the only way anybody finds Zimbabwe in a list of 240.
    if (e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return
    const now = Date.now()
    const text = now - typed.current.at > TYPEAHEAD_RESET_MS ? e.key : typed.current.text + e.key
    typed.current = { text, at: now }
    const needle = text.toLowerCase()
    const from = text.length === 1 ? active + 1 : active
    for (let n = 0; n < options.length; n++) {
      const i = (from + n) % options.length
      if (options[i].label.toLowerCase().startsWith(needle)) {
        e.preventDefault()
        setActive(i)
        return
      }
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      {/* The button is named by its label and then by what it shows, as a
          native select is ("What is it about? Choose one"): a name that left
          out the words on the button would fail WCAG 2.5.3, label in name. */}
      <span id={`${id}-label`} hidden>
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? hide(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            show()
          }
        }}
        data-open={open ? "" : undefined}
        className="field field-choice flex items-center justify-between gap-3 text-left"
      >
        {current ? (
          <span id={`${id}-value`} className="truncate">
            {current.short ?? current.label}
          </span>
        ) : (
          <span id={`${id}-value`} className="truncate text-sub">
            {placeholder}
          </span>
        )}
        {/* the chevron, drawn rather than loaded — one path, and it turns over
            when the menu is open so the button says which way it goes */}
        <svg
          aria-hidden="true"
          width="11"
          height="7"
          viewBox="0 0 11 7"
          className={`shrink-0 text-sub turn ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4.5 4.5L10 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          ref={list}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={keys}
          data-menu={up ? "up" : "down"}
          className={`absolute z-30 max-h-[min(320px,60vh)] w-max min-w-full max-w-[min(22rem,calc(100vw-32px))] overflow-y-auto rounded-card border border-line bg-card p-1.5 shadow-pop ${
            up ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "end" ? "right-0" : "left-0"}`}
        >
          {options.map((option, i) => {
            const isChosen = option.value === value
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isChosen}
                tabIndex={-1}
                onClick={() => choose(i)}
                onMouseMove={() => i !== active && setActive(i)}
                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-block py-2 pl-2 pr-3 text-ui leading-snug text-ink outline-none focus:bg-wash focus:outline focus:outline-focus focus:outline-accent focus:outline-offset-[calc(var(--focus-ring)*-1)] ${
                  isChosen ? "font-semibold" : ""
                }`}
              >
                {/* the tick on the chosen one; the column is kept for every
                    option, so the words line up */}
                <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-accent ${isChosen ? "" : "invisible"}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
                {option.label}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
