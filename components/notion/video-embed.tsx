"use client"

import { useState } from "react"
import { outsideLink } from "@/lib/outside"

/**
 * A YouTube or Vimeo video that loads nothing until it is asked to.
 *
 * Until the button is pressed the reader's browser has contacted nobody: the
 * card is this site's own markup. Pressing it loads the player from
 * youtube-nocookie.com or player.vimeo.com (with Vimeo's do-not-track), the
 * two hosts the Content-Security-Policy allows to be framed. The link under
 * it opens the video on its own site instead.
 *
 * The words arrive with the provider already in them (components/notion/
 * context.ts, `blocks.*` in Site Copy).
 */
export function VideoEmbed({
  embedUrl,
  watchUrl,
  title,
  labels,
}: {
  embedUrl: string
  watchUrl: string
  title: string
  labels: { play: string; note: string; watch: string }
}) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="my-1">
      <div className="relative aspect-video w-full overflow-hidden rounded-block bg-black">
        {playing ? (
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white"
          >
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-head-s text-black">
              ▶
            </span>
            <span className="label text-fine">{labels.play}</span>
            <span className="max-w-md text-fine text-white/80">{labels.note}</span>
          </button>
        )}
      </div>
      <a href={watchUrl} {...outsideLink(watchUrl)} className="n-link mt-1 inline-flex min-h-target items-center text-small text-sub">
        {labels.watch}
      </a>
    </div>
  )
}
