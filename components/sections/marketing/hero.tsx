import React from "react"

import { coverFrame, coverStyle } from "@/lib/cover"
import { picture } from "@/lib/media-sizes"
import type { Backdrop } from "@/lib/share"
import { Container } from "./layout"

/**
 * The two heroes: centred (a page's one big promise, then a picture under
 * it), and split (the words on the left, an illustration on the right, for
 * a page about one offer). The title is the page's <h1>.
 *
 * A hero sets itself once, in reading order (`settle` in app/globals.css):
 * the eyebrow, the title, the lede, then the buttons. Nothing moves for a
 * reader who asked for less motion.
 */

/**
 * A title whose words land one after another: the one line on a page a
 * reader is slowed down for. The words stay ordinary text with ordinary
 * spaces between them, so they wrap, are read out and are copied as the
 * sentence they are. Takes a string, so the slot is read with `plainText`.
 * `className` names the movement (`kinetic-word` lands once as the page
 * opens).
 */
export function KineticWords({ text, className = "kinetic-word" }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <>
      {words.map((word, i) => (
        <React.Fragment key={i}>
          {i ? " " : null}
          <span className={className} style={{ "--word": i } as React.CSSProperties}>
            {word}
          </span>
        </React.Fragment>
      ))}
    </>
  )
}

export function HeroCentered({
  name,
  eyebrow,
  title,
  lede,
  actions,
  note,
  visual,
  backdrop,
  titleId = "hero-title",
}: {
  /** the product's name and its descriptor, a line above everything else
   *  (the home page's: the header shows only the mark) */
  name?: { name: React.ReactNode; descriptor?: React.ReactNode }
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
  note?: React.ReactNode
  visual?: React.ReactNode
  /** a picture the whole width of the window under the words (the home
   *  page's `home.hero.image`): set under a veil as dark in every look, with
   *  the words and buttons light on it (`.on-picture`, app/globals.css) */
  backdrop?: Backdrop
  titleId?: string
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={backdrop ? "on-picture relative isolate overflow-hidden pb-20 pt-20 sm:pb-32 sm:pt-32" : "pb-12 pt-14 sm:pb-20 sm:pt-24"}
    >
      {backdrop ? (
        <div {...coverFrame(backdrop.tint, "absolute inset-0 -z-10")} {...(backdrop.alt ? {} : { "aria-hidden": true })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...picture(backdrop.src, "100vw", { eager: true })} alt={backdrop.alt} className="h-full w-full object-cover" style={coverStyle(backdrop.at)} />
          <div className="picture-veil absolute inset-0" />
        </div>
      ) : null}
      <Container>
        <div className="settle mx-auto max-w-[980px] text-center">
          {name ? (
            // the name in the slab face, larger than the descriptor after it,
            // as Notion's brand rules ask
            <p data-name-line className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span className="title-slab text-head-s leading-none sm:text-head-m">{name.name}</span>
              {name.descriptor ? (
                <>
                  <span aria-hidden="true" className="h-5 w-px bg-line-strong" />
                  <span className="text-ui leading-none text-sub sm:text-lead">{name.descriptor}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {/* under a name the eyebrow is a small label, not a second slab
              line: two lines of the same face a few points apart read as a
              mistake. Alone, it is the eyebrow it always was. */}
          {eyebrow ? <p className={name ? "small-print mb-6" : "eyebrow mb-4 text-lead"}>{eyebrow}</p> : null}
          <h1 id={titleId} className="title-slab title-display text-fluid-hero">
            {title}
          </h1>
          {lede ? <p className="mx-auto mt-6 max-w-[700px] text-lead leading-relaxed text-ink sm:text-head-s">{lede}</p> : null}
          {actions ? <div className="mx-auto mt-8 flex max-w-[760px] justify-center">{actions}</div> : null}
          {note ? <p className="small-print mt-4">{note}</p> : null}
        </div>
        {visual ? <div className="mt-12 sm:mt-16">{visual}</div> : null}
      </Container>
    </section>
  )
}

export function HeroSplit({
  eyebrow,
  title,
  lede,
  actions,
  art,
  titleId = "hero-title",
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lede?: React.ReactNode
  actions?: React.ReactNode
  art?: React.ReactNode
  titleId?: string
}) {
  return (
    <section aria-labelledby={titleId} className="pb-12 pt-12 sm:pb-20 sm:pt-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div className="settle">
            {eyebrow ? <p className="eyebrow mb-4 text-lead">{eyebrow}</p> : null}
            <h1 id={titleId} className="title-slab title-display text-fluid-hero">
              {title}
            </h1>
            {lede ? <p className="mt-6 max-w-[620px] text-lead leading-relaxed text-ink sm:text-head-s">{lede}</p> : null}
            {actions ? <div className="mt-8">{actions}</div> : null}
          </div>
          {art ? <div className="mx-auto w-full max-w-[520px]">{art}</div> : null}
        </div>
      </Container>
    </section>
  )
}
