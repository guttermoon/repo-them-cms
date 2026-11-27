import type React from "react"

import { Icon } from "@/components/ui/icon"
import { picture } from "@/lib/media-sizes"
import { outsideLink } from "@/lib/outside"

/**
 * Reviews, as a review site sets them out: a verdict in a word, the average
 * in star tiles and the count, then a card for each, with who, when, the
 * stars, and the words. Read from Review rows (lib/content/select.ts,
 * liveReviews); the average, the count and which verdict applies are worked
 * out here and printed between slots.
 *
 * Nothing here is marked up for search engines: a site's reviews of itself
 * earn no stars in results, and invented ones must never look like real
 * ones. An invented review is tagged Example in Notion (the starter's four
 * are), and a list of them carries an "example" mark (`example`); the first
 * real review published takes their place.
 */
export type ReviewView = { key: string; name: string; text: React.ReactNode; rating: number; date?: string; when?: string; photo?: string; href?: string }

/** Five star tiles, as a review site draws them: the first `filled` in the
 *  main button's colours, the rest left pale. Decoration: the figure beside
 *  them, or the card's own name for its stars, says the same in words. */
export function Stars({ filled, className = "" }: { filled: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex gap-[0.12em] ${className}`.trim()}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-star={n <= filled ? "on" : "off"} className={`flex h-[1.3em] w-[1.3em] items-center justify-center rounded-text ${n <= filled ? "bg-btn text-btn-ink" : "bg-line-strong text-page"}`}>
          <Icon name="star" className="text-[0.82em]" />
        </span>
      ))}
    </span>
  )
}

/** The initials of a name, for a reviewer with no photograph. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

/** The average of the ratings, to one decimal place. */
export function averageRating(ratings: number[]): number {
  if (!ratings.length) return 0
  return Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
}

export function ReviewCards({
  titleId,
  title,
  reviews,
  words,
  example,
}: {
  titleId: string
  title: React.ReactNode
  reviews: ReviewView[]
  /** the words round the figures and the stars (slots, from the page) */
  words: {
    average: React.ReactNode
    count: React.ReactNode
    rated: (stars: number) => string
    /** the average in a word, by its nearest whole star ("Excellent" for 5) */
    verdict?: (stars: number) => React.ReactNode
    example?: React.ReactNode
    source?: React.ReactNode
    /** the Pause box's name, for the row that passes by */
    pause?: string
  }
  /** the reviews are invented (the starter content): say so */
  example?: boolean
}) {
  if (!reviews.length) return null
  // fewer than three would chase their own tails
  const loop = reviews.length >= 3
  const average = averageRating(reviews.map((r) => r.rating))
  return (
    <div>
      <div data-section-head className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* the mark stands beside the title, not in it: the section keeps
              its name, and a blank title leaves no heading of a mark alone */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id={titleId} className="title-slab text-head-m sm:text-head-l">
              {title}
            </h2>
            {example && words.example ? (
              <p className="rounded-full border border-line-strong px-2.5 py-0.5 font-sans text-fine font-semibold uppercase tracking-[0.06em] text-sub empty:hidden">{words.example}</p>
            ) : null}
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-ink">
            {words.verdict ? <strong className="font-sans text-head-s font-bold leading-none tracking-[-0.01em] sm:text-head-m">{words.verdict(Math.round(average))}</strong> : null}
            <Stars filled={Math.round(average)} className="text-head-s" />
            <span>
              <strong className="font-semibold">{average.toFixed(1)}</strong> {words.average}
            </span>
            <span className="text-sub">
              {reviews.length} {words.count}
            </span>
          </p>
        </div>
        {/* the row's Pause box, in the head beside what it stops */}
        {loop && words.pause ? (
          <label className="marquee-toggle">
            <input type="checkbox" className="marquee-pause" />
            {words.pause}
          </label>
        ) : null}
      </div>
      {/* a grid at rest: stacked on a phone, a row on a wide screen. With
          three or more and motion allowed, the row passes by on a loop
          (`marquee`, app/globals.css): it stops under the pointer and for
          the Pause box, and is the grid again the moment the keyboard is in
          it, so every card is reached (WCAG 2.1.1, 2.2.2). The second run
          of cards is scenery: hidden from a screen reader and from focus.
          The row runs past its column to the window's edges with no fade,
          so the section it is put in clips it (`overflow-x-clip`). */}
      <div className="marquee section-body" {...(loop ? { "data-loop": "" } : {})}>
        <ul className="marquee-track grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.map((review) => (
            <ReviewCard key={review.key} review={review} words={words} />
          ))}
          {/* two more runs, so the row covers the widest window as it turns over */}
          {loop ? [1, 2].flatMap((run) => reviews.map((review) => <ReviewCard key={`run-${run}-${review.key}`} review={review} words={words} clone />)) : null}
        </ul>
      </div>
    </div>
  )
}

/** The second run's cards are scenery: out of a screen reader's way and out
 *  of the Tab order. `inert` is a boolean to React, drawn as the empty
 *  attribute HTML wants; an empty string would be false and draw nothing. */
const CLONE: React.HTMLAttributes<HTMLLIElement> = { "aria-hidden": true, inert: true }

/** One review's card. `clone`: the second run of the row that passes by. */
function ReviewCard({ review, words, clone = false }: { review: ReviewView; words: { rated: (stars: number) => string; source?: React.ReactNode }; clone?: boolean }) {
  return (
    <li {...(clone ? CLONE : {})} className={`${clone ? "marquee-clone " : ""}lit flex-col rounded-card border border-line bg-card p-5 ${clone ? "" : "flex"}`.trim()}>
      <div className="flex items-center gap-3">
        {review.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...picture(review.photo, 96)} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint font-sans text-ui font-semibold text-brand">
            {initials(review.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-sans text-body font-semibold text-ink">{review.name}</p>
          {review.date && review.when ? (
            <time dateTime={review.date} className="text-small text-sub">
              {review.when}
            </time>
          ) : null}
        </div>
      </div>
      <p className="mt-4 flex text-lead" role="img" aria-label={words.rated(review.rating)}>
        <Stars filled={review.rating} />
      </p>
      <p className="mt-3 text-ui leading-relaxed text-ink">{review.text}</p>
      {review.href && words.source ? (
        <a href={review.href} {...outsideLink(review.href)} className="n-link mt-auto inline-flex min-h-target items-center pt-3 text-small font-semibold">
          {words.source}
        </a>
      ) : null}
    </li>
  )
}
