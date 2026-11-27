import { ICONS, type IconName } from "@/lib/icons"

/**
 * One of the site's icons (lib/icons.ts), 1em square so it sits in text like
 * a letter and takes the size and colour of the words around it. Always
 * decorative: whatever it sits in carries the words.
 *
 * Server-only by use: a client component that wants one is handed it as a
 * prop, so the icons' paths never ship to a browser.
 */
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      data-icon={name}
      className={`inline-block h-[1em] w-[1em] shrink-0 ${className}`.trim()}
    >
      {ICONS[name].map((d, n) => (
        <path key={n} d={d} />
      ))}
    </svg>
  )
}
