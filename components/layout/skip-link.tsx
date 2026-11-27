import { plainText, type SiteCopy } from "@/components/system/notion-text"

/** The first thing a keyboard reaches: a way past the header to the page.
 *  Hidden until it has focus. Its words fall back rather than go blank:
 *  an empty link is no way past anything. */
export function SkipLink({ content }: { content: SiteCopy }) {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-page focus:px-4 focus:py-2 focus:shadow-pop"
    >
      {plainText(content, "nav.skip", "Skip to content")}
    </a>
  )
}
