import type React from "react"

/**
 * Questions and answers, one open at a time if the reader likes, each a
 * native <details>: it opens with Enter or Space, it is found by the
 * browser's find-in-page even when closed, and it works before any script
 * runs. The question is a heading inside the summary, so the page's outline
 * lists every question. The plus turns into a minus when it opens (no turn
 * under reduced motion).
 */
export type FaqItem = { key: string; question: React.ReactNode; answer: React.ReactNode }

export function Faq({ items, headingLevel = 3 }: { items: FaqItem[]; headingLevel?: 2 | 3 }) {
  if (!items.length) return null
  const Q = headingLevel === 2 ? "h2" : "h3"
  return (
    <div className="border-b border-line">
      {items.map((item) => (
        <details key={item.key} className="faq-item group border-t border-line">
          <summary className="flex min-h-[60px] items-center justify-between gap-6 py-4">
            <Q className="text-lead font-semibold leading-snug text-ink">{item.question}</Q>
            <span aria-hidden="true" className="relative h-5 w-5 shrink-0 text-ink">
              <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 rounded-full bg-current" />
              <span className="faq-plus absolute left-1/2 top-0 h-5 w-[2px] -translate-x-1/2 rounded-full bg-current turn" />
            </span>
          </summary>
          <div className="max-w-[760px] pb-6 text-body leading-relaxed text-sub">{item.answer}</div>
        </details>
      ))}
    </div>
  )
}
