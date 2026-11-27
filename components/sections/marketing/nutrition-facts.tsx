import type React from "react"

export type NutritionFact = { key: string; name: React.ReactNode; value: React.ReactNode }

/**
 * A nutrition label, as on the side of a pack: its title, the serving, a
 * line for each fact (its name and its value, between rules) and a note
 * under them. It turns to face the reader as it comes into view (`depth`).
 * The words are the caller's slots; `className` sets its ground where the
 * section's own would not do.
 */
export function NutritionFacts({
  id,
  title,
  serving,
  facts,
  note,
  className = "",
}: {
  id: string
  title: React.ReactNode
  serving: React.ReactNode
  facts: NutritionFact[]
  note: React.ReactNode
  className?: string
}) {
  return (
    <aside aria-labelledby={id} className={`depth self-start rounded-card border-2 border-ink ${className} p-5`.replace(/\s+/g, " ")}>
      <h3 id={id} className="font-sans text-head-m font-black uppercase leading-none tracking-[-0.01em] text-ink">
        {title}
      </h3>
      <p className="mt-1 border-b-[6px] border-ink pb-1 text-small text-ink">{serving}</p>
      <dl>
        {facts.map((fact) => (
          <div key={fact.key} className="flex items-baseline justify-between gap-3 border-b border-ink/40 py-1.5 text-ui">
            <dt className="text-ink">{fact.name}</dt>
            <dd className="shrink-0 font-black tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-fine leading-relaxed text-sub">{note}</p>
    </aside>
  )
}
