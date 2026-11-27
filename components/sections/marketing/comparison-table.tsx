import type React from "react"

import { LinkedText } from "@/components/system/linked-text"
import { ButtonLink } from "@/components/ui/button"
import type { ComparisonGroup } from "@/lib/pricing"

/**
 * Plans and features, side by side: a real table (column and row headers
 * with their scopes, a caption, a group heading per block of rows), so a
 * screen reader can say "Pages, Pro: Unlimited". On a wide screen the head
 * row sticks under the site's header as the table scrolls past; on a narrow
 * one the table scrolls sideways inside its own labelled region, which the
 * keyboard can reach, with the feature names pinned on the left.
 */
export type ComparisonPlan = { key: string; name: string; price?: React.ReactNode; cta?: { href: string; label: string } }

export function ComparisonTable({
  label,
  caption,
  plans,
  groups,
  labels,
}: {
  /** the scrolling region's own name, unlike the section's ("the table,
   *  scrolls sideways"), so two landmarks are never called the same */
  label: string
  caption: string
  plans: ComparisonPlan[]
  groups: ComparisonGroup[]
  labels: { yes: string; no: string; feature: string }
}) {
  if (!groups.length || !plans.length) return null
  const cols = plans.length + 1
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:overflow-visible">
      <table className="w-full min-w-[640px] border-collapse text-left text-ui">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 top-0 z-20 w-[28%] bg-surface pb-4 align-bottom text-fine font-normal text-sub lg:top-[68px]">
              {labels.feature}
            </th>
            {plans.map((plan) => (
              <th key={plan.key} scope="col" className="bg-surface px-2 pb-4 align-bottom font-normal lg:sticky lg:top-[68px] lg:z-10">
                <span className="title-slab block text-lead">{plan.name}</span>
                {plan.price ? <span className="mt-0.5 block text-fine text-sub">{plan.price}</span> : null}
                {plan.cta ? (
                  <ButtonLink href={plan.cta.href} tone="outline" className="mt-2 min-h-target w-full px-2 py-1.5 text-fine">
                    {plan.cta.label}
                  </ButtonLink>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group, g) => (
          // by place, not by words: two groups or rows can say the same thing
          <tbody key={g}>
            {group.name ? (
              <tr>
                <th scope="colgroup" colSpan={cols} className="sticky left-0 bg-surface pb-2 pt-8 text-fine font-normal text-sub">
                  {group.name}
                </th>
              </tr>
            ) : null}
            {group.rows.map((row, r) => (
              <tr key={r} className="border-t border-line">
                <th scope="row" className="sticky left-0 bg-surface py-3 pr-3 font-medium text-ink">
                  <LinkedText text={row.label} />
                </th>
                {row.cells.map((cell, i) => (
                  <td key={plans[i]?.key ?? i} className="px-2 py-3 text-ink">
                    {cell.kind === "value" ? (
                      cell.text
                    ) : cell.kind === "yes" ? (
                      <>
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 10.5l3.5 3.5L16 5.5" />
                        </svg>
                        <span className="sr-only">{labels.yes}</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="text-sub">
                          —
                        </span>
                        <span className="sr-only">{labels.no}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
