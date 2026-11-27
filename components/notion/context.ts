import type { SiteCopy } from "@/lib/notion/rows"
import { plainText } from "@/lib/slots"
import type { NBlock } from "@/lib/notion/blocks"
import { collectHeadings, type HeadingRef, type HeadingTag } from "@/lib/notion/headings"

/**
 * The words the block renderer adds around what a page's author wrote: a
 * file's verb, a video's button, the copy button on code. Site Copy rows
 * (`blocks.<name>`) reword them; `{provider}` stands for YouTube or Vimeo.
 */
export const DEFAULT_BLOCK_LABELS = {
  contents: "Contents",
  table: "Table (scrolls sideways on a small screen)",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Select and copy",
  openPdf: "Open PDF",
  download: "Download",
  pdf: "PDF",
  file: "File",
  downloadVideo: "Download the video",
  downloadAudio: "Download the audio",
  video: "{provider} video",
  play: "Play video",
  playNote: "Plays from {provider}. Nothing loads from {provider} until you press play.",
  watchOn: "Watch on {provider}",
  done: "Done",
  notDone: "Not done",
}

export type BlockLabels = typeof DEFAULT_BLOCK_LABELS

/** The labels as the site's copy has them. */
export function blockLabels(content: SiteCopy): BlockLabels {
  const out = { ...DEFAULT_BLOCK_LABELS }
  for (const key of Object.keys(out) as (keyof BlockLabels)[]) out[key] = plainText(content, `blocks.${key}`, DEFAULT_BLOCK_LABELS[key])
  return out
}

/** A code block's copy button's words, for a page that draws one itself. */
export function codeLabels(content: SiteCopy): { copy: string; copied: string; failed: string } {
  const labels = blockLabels(content)
  return { copy: labels.copy, copied: labels.copied, failed: labels.copyFailed }
}

/** What a block needs to know about the rest of the site to draw itself. */
export type RenderContext = {
  /** The site address of a Notion page, when it is a live page or post here. */
  pageUrl: (notionId: string) => string | undefined
  /** Each heading's anchor, by block ID, unique within the page. */
  anchors: Map<string, string>
  /** The page's headings in order, for a table of contents block. */
  headings: HeadingRef[]
  /** Each heading's element, by block ID (see collectHeadings). */
  tags: Map<string, HeadingTag>
  /** The renderer's own words */
  labels: BlockLabels
}

export type { HeadingRef, HeadingTag } from "@/lib/notion/headings"
export { collectHeadings } from "@/lib/notion/headings"

/** `under` is the level of the heading the body sits under: 1 for a page's
 *  own body, 2 for one inside a titled section (a product's details). */
export function makeContext(
  blocks: NBlock[],
  pageUrl: RenderContext["pageUrl"],
  labels: BlockLabels = DEFAULT_BLOCK_LABELS,
  under: 1 | 2 = 1,
): RenderContext {
  const headings = collectHeadings(blocks, under)
  return {
    pageUrl,
    headings,
    anchors: new Map(headings.map((h) => [h.id, h.anchor])),
    tags: new Map(headings.map((h) => [h.id, h.tag])),
    labels,
  }
}

/** A Notion page ID out of a link Notion wrote (lib/notion/links.ts). */
export { notionPageIdFromHref } from "@/lib/notion/links"
