import { LinkedText } from "@/components/system/linked-text"
import { mediaUrl } from "@/lib/content/media"
import type { Entry } from "@/lib/notion/rows"
import { coverStyle } from "@/lib/cover"
import { picture } from "@/lib/media-sizes"
import { safeHref } from "@/lib/inline-links"
import { outsideLink } from "@/lib/outside"

/**
 * One person on /team (and the About page's teaser): the portrait, the
 * name, the role, a line about them and, when their row has a Link, their
 * profile. The name is a heading at whatever level the list sits under.
 */
export function PersonCard({ person, heading: Heading = "h2", profile }: { person: Entry; heading?: "h2" | "h3"; profile: string }) {
  // a row's Link is typed by a person: only an address `safeHref` allows is drawn
  const link = person.link ? safeHref(person.link) : undefined
  return (
    <li className="lit flex flex-col overflow-hidden rounded-card border border-line bg-card">
      <div className="aspect-square bg-panel">
        {person.cover ? (
          // the name beside it says who it is: the picture adds nothing a screen reader needs
          // eslint-disable-next-line @next/next/no-img-element
          <img {...picture(mediaUrl(person.cover, "portrait"), "(min-width: 1024px) 38vw, (min-width: 640px) 75vw, 150vw")} alt="" style={coverStyle(person.coverAt)} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Heading className="title-slab text-head-s leading-tight">{person.title}</Heading>
        {person.description ? (
          <p className="mt-1 text-ui font-semibold text-strong">
            <LinkedText text={person.description} />
          </p>
        ) : null}
        {person.text ? (
          <p className="mt-2 text-ui leading-relaxed text-sub">
            <LinkedText text={person.text} />
          </p>
        ) : null}
        {link ? (
          <a href={link} className="n-link mt-auto inline-flex min-h-[44px] items-end pt-3 text-ui" {...outsideLink(link)}>
            {profile}
            <span className="sr-only">: {person.title}</span>
          </a>
        ) : null}
      </div>
    </li>
  )
}
