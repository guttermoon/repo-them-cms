import { inlineWords } from "@/lib/inline-text"

/**
 * Renders a JSON-LD block. Server-rendered into the markup so crawlers that
 * do not execute JavaScript still see it.
 *
 * `JSON.stringify` is the sanitiser here: the only injection risk in a
 * <script> body is a literal "</script>" inside a string, which is escaped
 * below rather than left for the parser to trip over.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // every string as its words: a link, a line's formatting, means
        // nothing to a search engine (lib/inline-text.ts)
        __html: JSON.stringify(data, (_key, value: unknown) => (typeof value === "string" ? inlineWords(value) : value)).replace(/</g, "\\u003c"),
      }}
    />
  )
}
