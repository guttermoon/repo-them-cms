"use client"

import { useState } from "react"
import { picture } from "@/lib/media-sizes"

/**
 * A product's pictures: one large, and the rest as buttons that show
 * themselves large. Each button says which picture it is ("Picture 2 of
 * 4", and what it shows when the picture has a description), and the
 * chosen one is marked as pressed. The large one is described by its own
 * description (the shop's alt text), or the product's name. They are
 * goods for sale, so the dark look leaves them as uploaded (`data-goods`,
 * app/globals.css).
 */
export function ProductGallery({ images, alts = [], title, labels }: { images: string[]; alts?: string[]; title: string; labels: { picture: string; of: string } }) {
  const [shown, setShown] = useState(0)
  if (!images.length) return <div aria-hidden="true" className="aspect-square rounded-panel bg-panel" />
  return (
    <div data-goods>
      <div className="aspect-square overflow-hidden rounded-panel border border-line bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...picture(images[shown], "(min-width: 768px) 75vw, 150vw", { eager: true })} alt={alts[shown] || title} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((src, i) => (
            // by place: the same picture can be in a gallery twice
            <li key={i}>
              <button
                type="button"
                aria-pressed={i === shown}
                aria-label={`${labels.picture} ${i + 1} ${labels.of} ${images.length}${alts[i] ? `: ${alts[i]}` : ""}`}
                onClick={() => setShown(i)}
                className={`block h-16 w-16 overflow-hidden rounded-block border-2 bg-panel ${i === shown ? "border-brand dark:border-accent" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img {...picture(src, 128)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
