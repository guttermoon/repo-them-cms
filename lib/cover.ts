/**
 * The frame a cover of a post, a page or a resource is drawn in: printed in
 * the look's one ink (`.cover-tint`, app/globals.css), or, with Cover Tint
 * Off in Notion, shown as uploaded (`data-untinted`: no look's tint or glow
 * reaches it, though mono still draws it in grey, as the reader chose).
 */
export function coverFrame(tint: boolean | undefined, className: string): { className: string; "data-untinted"?: "" } {
  // only an explicit Off: an entry from before Cover Tint (a snapshot kept
  // when the prebuild could not read Notion) has none, and is On
  return tint === false ? { className, "data-untinted": "" } : { className: `cover-tint ${className}` }
}

/**
 * Where a cropped cover is cut (Cover Position in Notion: lib/notion/
 * schema.ts), as the style that cuts it there: nothing for the middle,
 * which is where a browser cuts anyway.
 */
export function coverStyle(at: number | undefined): { objectPosition: string } | undefined {
  return at === undefined || at === 50 ? undefined : { objectPosition: `50% ${at}%` }
}
