import type React from "react"

/**
 * How the words travel: the Notion database, then the cache that asks it
 * once a minute, then everything the site makes from it. Real content, so
 * it is a list a screen reader can walk, laid out as a diagram: three steps
 * in a row on a wide screen, stacked on a narrow one, with arrows that are
 * only decoration.
 */
export function Pipeline({
  source,
  middle,
  outputs,
  label,
}: {
  source: { title: React.ReactNode; text: React.ReactNode }
  middle: { title: React.ReactNode; text: React.ReactNode }
  outputs: { key: string; label: React.ReactNode }[]
  label: string
}) {
  // an <li> so the list stays valid HTML; hidden, so it is not counted
  const Arrow = () => (
    <li aria-hidden="true" className="flex items-center justify-center text-head-m text-accent lg:px-2">
      <span className="lg:hidden">↓</span>
      <span className="hidden lg:inline">→</span>
    </li>
  )
  return (
    <ol aria-label={label} className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1.2fr]">
      <li className="rounded-card border border-line bg-card p-5 shadow-card">
        <span className="title-slab block text-head-s">{source.title}</span>
        <span className="mt-1 block text-ui text-sub">{source.text}</span>
      </li>
      <Arrow />
      <li className="rounded-card bg-tint p-5 text-brand">
        <span className="title-slab block text-head-s text-brand">{middle.title}</span>
        <span className="mt-1 block text-ui text-brand">{middle.text}</span>
      </li>
      <Arrow />
      <li className="rounded-card border border-line bg-card p-5 shadow-card">
        <ul className="flex flex-wrap gap-2">
          {outputs.map((output) => (
            <li key={output.key} className="rounded-full bg-panel px-3 py-1 text-small font-medium text-ink">
              {output.label}
            </li>
          ))}
        </ul>
      </li>
    </ol>
  )
}
