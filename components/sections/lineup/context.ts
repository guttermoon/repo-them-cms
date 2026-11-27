import type React from "react"

import type { makeT } from "@/components/system/notion-text"
import type { SiteCopy, SiteData } from "@/lib/notion/rows"

/** What a section is drawn with, wherever its row puts it (lib/sections.ts). */
export type SectionContext = {
  data: SiteData
  content: SiteCopy
  T: ReturnType<typeof makeT>
  /** An id no other element on the page has: the name itself the first
   *  time it is asked for, then name-2, name-3, so a section shown twice,
   *  or beside one using the same name, still names each heading once. */
  id: (name: string) => string
  /** its ground: its own (lib/sections.ts), on the page's when it would
   *  otherwise run on from another panel */
  tone: "page" | "panel"
  /** straight under the page's hero, which already spaces it from above */
  first: boolean
}

/** A section, drawn: nothing when it has nothing to show (no plans, no
 *  reviews, its words published blank). */
export type SectionDraw = (ctx: SectionContext) => React.ReactNode
