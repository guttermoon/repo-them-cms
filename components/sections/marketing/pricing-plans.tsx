"use client"

import type React from "react"
import { useId, useState } from "react"

import { LinkedText } from "@/components/system/linked-text"
import { ButtonLink } from "@/components/ui/button"
import { formatPrice, hasYearly, priceFor, yearlySaving, type Billing, type FeatureLine } from "@/lib/pricing"

/**
 * The plans, as a SaaS pricing page sets them: grouped in boxes, the
 * recommended one marked, each with its price, its one button and what it
 * includes. A monthly/yearly switch appears only when some plan has a yearly
 * price, and the saving it advertises is worked out from the prices
 * (lib/pricing.ts), never typed. A plan with no price says the page's own
 * words for custom pricing.
 *
 * The switch is a pair of radio buttons in a fieldset: the native control,
 * so the keyboard and screen readers already know it.
 *
 * It goes under an h2: plan names are h3s (h4s inside a named group).
 */
export type PlanView = {
  key: string
  name: string
  description?: string
  price?: number
  yearlyPrice?: number
  currency: string
  priceNote?: string
  features: FeatureLine[]
  recommended: boolean
  group?: string
  cta?: { href: string; label: string }
}

export type PricingLabels = {
  billing: string
  monthly: React.ReactNode
  yearly: React.ReactNode
  /** "save up to" … "with yearly", the figure between them worked out */
  saveBefore: React.ReactNode
  saveAfter: React.ReactNode
  recommended: React.ReactNode
  custom: React.ReactNode
  includes: React.ReactNode
}

function groupsOf(plans: PlanView[]): { name: string; plans: PlanView[] }[] {
  const out: { name: string; plans: PlanView[] }[] = []
  for (const plan of plans) {
    const name = plan.group ?? ""
    const found = out.find((g) => g.name === name)
    if (found) found.plans.push(plan)
    else out.push({ name, plans: [plan] })
  }
  return out
}

function Tick() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-[3px] h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5l3.5 3.5L16 5.5" />
    </svg>
  )
}

function PlanCard({ plan, billing, labels, Heading }: { plan: PlanView; billing: Billing; labels: PricingLabels; Heading: "h3" | "h4" }) {
  const amount = priceFor(plan, billing)
  return (
    <li className={`lit flex flex-col rounded-card border bg-card p-6 ${plan.recommended ? "border-2 border-brand dark:border-accent" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Heading className="title-slab text-head-s">{plan.name}</Heading>
        {plan.recommended ? <span className="rounded-full bg-btn px-2.5 py-0.5 text-fine font-semibold text-btn-ink">{labels.recommended}</span> : null}
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        {amount === undefined ? (
          <span className="title-slab text-head-m">{labels.custom}</span>
        ) : (
          <>
            <span className="title-slab text-head-l tracking-[-0.02em]">{formatPrice(amount, plan.currency)}</span>
            {plan.priceNote ? <span className="text-small text-sub">{plan.priceNote}</span> : null}
          </>
        )}
      </p>
      {plan.description ? (
        <p className="mt-2 text-ui leading-relaxed text-sub">
          <LinkedText text={plan.description} />
        </p>
      ) : null}
      {plan.cta ? (
        <ButtonLink href={plan.cta.href} tone={plan.recommended ? "primary" : "outline"} className="mt-5 w-full">
          {plan.cta.label}
        </ButtonLink>
      ) : null}
      {plan.features.length ? (
        <div className="mt-6">
          <p className="label text-small text-ink">{labels.includes}</p>
          <ul className="mt-3 space-y-2 text-ui leading-snug text-ink">
            {plan.features.map((line, i) =>
              line.kind === "group" ? (
                <li key={i} className="label pt-2 text-fine text-sub">
                  {line.label}
                </li>
              ) : (
                <li key={i} className="flex gap-2">
                  <Tick />
                  <span>
                    <LinkedText text={line.label} />
                    {line.kind === "value" ? <span className="text-sub">: {line.value}</span> : null}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

export function PricingPlans({ plans, labels, footnote }: { plans: PlanView[]; labels: PricingLabels; footnote?: React.ReactNode }) {
  const [billing, setBilling] = useState<Billing>("monthly")
  const name = useId()
  const groups = groupsOf(plans)
  const grouped = groups.length > 1 || Boolean(groups[0]?.name)
  const saving = yearlySaving(plans)

  return (
    <div>
      {hasYearly(plans) ? (
        <fieldset className="mb-8 flex flex-wrap items-center gap-3">
          <legend className="sr-only">{labels.billing}</legend>
          <div className="inline-flex rounded-full bg-wash p-1">
            {(["monthly", "yearly"] as const).map((option) => (
              <label key={option} className="relative">
                <input type="radio" name={name} value={option} checked={billing === option} onChange={() => setBilling(option)} className="peer sr-only" />
                <span className="flex min-h-target cursor-pointer items-center rounded-full px-4 text-small font-medium text-sub peer-checked:bg-card peer-checked:text-ink peer-checked:shadow-card peer-focus-visible:outline peer-focus-visible:outline-focus peer-focus-visible:outline-accent">
                  {option === "monthly" ? labels.monthly : labels.yearly}
                </span>
              </label>
            ))}
          </div>
          {saving > 0 ? (
            <p className="text-small text-sub">
              {labels.saveBefore} {saving}% {labels.saveAfter}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className={grouped && groups.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}>
        {groups.map((group, g) => (
          <div key={g} className={grouped ? `rounded-panel p-4 sm:p-6 ${g % 2 ? "bg-panel" : "border border-line"}` : ""}>
            {grouped && group.name ? <h3 className="title-slab mb-5 text-head-m">{group.name}</h3> : null}
            <ul className={`arrive-each grid gap-4 ${group.plans.length > 1 ? "sm:grid-cols-2" : ""} ${!grouped && group.plans.length > 2 ? "lg:grid-cols-4" : ""}`}>
              {group.plans.map((plan) => (
                <PlanCard key={plan.key} plan={plan} billing={billing} labels={labels} Heading={grouped && group.name ? "h4" : "h3"} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {footnote ? <p className="mt-4 text-right text-fine text-sub">{footnote}</p> : null}
    </div>
  )
}
