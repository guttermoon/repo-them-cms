import type { QuoteView } from "@/components/sections/marketing"
import { LinkedText } from "@/components/system/linked-text"
import { mediaUrl } from "@/lib/content/media"
import type { Entry } from "@/lib/notion/rows"

/**
 * A Quote row as a quotation (`quoteFor`): what was said (Text), who said it
 * (Title), the line under their name (the Author Bio of the Person row it
 * names, `withAuthors`) and their logo (its cover), however large the
 * quotation is set.
 */
export function quoteView(quote: Entry): QuoteView {
  return {
    quote: <LinkedText text={quote.text ?? ""} />,
    name: quote.title,
    role: quote.author?.bio ? <LinkedText text={quote.author.bio} /> : undefined,
    logo: quote.cover ? { src: mediaUrl(quote.cover, "logo"), alt: "" } : undefined,
  }
}
