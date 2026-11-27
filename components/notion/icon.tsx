import { Icon } from "@/components/ui/icon"
import { mediaUrl } from "@/lib/content/media"
import { iconForNotion } from "@/lib/icons"
import type { Icon as IconValue } from "@/lib/notion/rows"
import { picture } from "@/lib/media-sizes"

/**
 * An icon from Notion (a page's or a callout's), 1em square in the text
 * around it, as Notion shows it: an emoji; one of Notion's own icons in its
 * colour, drawn with the site's icon of that name so it follows the light
 * and dark themes (one the site has no drawing of comes through /media/ as
 * Notion draws it); or a picture, through /media/.
 */
export function NotionIcon({ icon, className = "" }: { icon: IconValue; className?: string }) {
  if (icon.type === "emoji") {
    return (
      <span aria-hidden="true" className={className}>
        {icon.emoji}
      </span>
    )
  }
  if (icon.type === "native") {
    const own = iconForNotion(icon.name)
    if (own) return <Icon name={own} className={`n-c-${icon.color} ${className}`} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...picture(mediaUrl(icon.media, "icon"), 96)}
      alt=""
      className={`inline-block h-[1em] w-[1em] shrink-0 ${icon.type === "image" ? "rounded-text object-cover" : "object-contain"} ${className}`.trim()}
    />
  )
}
