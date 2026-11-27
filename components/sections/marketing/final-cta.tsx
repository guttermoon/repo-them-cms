import type React from "react"

import { Container } from "./layout"

/** The last word on a page: a big line, a sentence, and the way in. Padded
 *  as every section is (MarketingSection's), so it stands as far from what
 *  is above it as from what is below. */
export function FinalCta({
  titleId = "final-title",
  title,
  lede,
  actions,
}: {
  titleId?: string
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section aria-labelledby={titleId} className="py-16 sm:py-24">
      <Container className="arrive text-center">
        <h2 id={titleId} className="title-slab title-display mx-auto max-w-[980px] text-fluid-hero">
          {title}
        </h2>
        {lede ? <p className="mx-auto mt-5 max-w-[640px] text-lead leading-relaxed text-ink sm:text-head-s">{lede}</p> : null}
        {actions ? <div className="mx-auto mt-8 flex max-w-[760px] justify-center">{actions}</div> : null}
      </Container>
    </section>
  )
}
