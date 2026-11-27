import type { Metadata } from "next"

import { JsonLd } from "@/components/system/json-ld"
import { makeT, plainText } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { ButtonLink } from "@/components/ui/button"
import { Frame, PageHeader, Tag } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import { safeHref } from "@/lib/inline-links"
import { liveResources, resourcesByCategory } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { metaKey, PAGE_META } from "@/lib/page-meta"
import { mediaUrl } from "@/lib/content/media"
import { hostOf } from "@/lib/content/embeds"
import { pageMetaFor } from "@/lib/seo"
import { pageLd } from "@/lib/structured-data"
import { LinkedText } from "@/components/system/linked-text"
import { coverFrame, coverStyle } from "@/lib/cover"
import { picture } from "@/lib/media-sizes"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/resources", await getSiteData())
}

/** The button on a resource, by its Action: Site Copy `resources.verb.*`. */
const VERBS: Record<string, string> = { read: "Read", watch: "Watch", download: "Download", link: "Open" }

const verb = (action: string | undefined) => {
  const key = (action ?? "").toLowerCase()
  return key in VERBS ? key : "link"
}

export default async function ResourcesPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)
  // every verb read here, so `npm run copy` lists all four whatever is published
  const verbs: Record<string, string> = Object.fromEntries(Object.entries(VERBS).map(([key, words]) => [key, plainText(data.copy, `resources.verb.${key}`, words)]))
  const groups = resourcesByCategory(liveResources(data))

  return (
    <>
      <JsonLd data={pageLd("/resources", data, { type: "CollectionPage" })} />
      <PageHeader
        wide
        icon={<Icon name="books" />}
        label={<T k={metaKey("/resources", "label")}>{PAGE_META["/resources"].label}</T>}
        title={<T k="resources.title">Things worth your time</T>}
        description={<T k="resources.lede">Things worth reading, watching and keeping, gathered in one place.</T>}
      />
      <Frame wide className="pb-6 pt-6">
        {groups.length ? (
          // an id by place: a category is words, and words hold spaces
          groups.map((group, n) => (
            <section key={n} aria-labelledby={`r${n}`} className="mt-8 first:mt-2">
              <h2 id={`r${n}`} className="label text-fine text-sub">
                {group.category || <T k="resources.other">Other</T>}
              </h2>
              <ul className="arrive-each mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const href = item.link ? safeHref(item.link) : undefined
                  return (
                    <li key={item.id} className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-card">
                      {item.cover ? (
                        <div {...coverFrame(item.coverTint, "aspect-[16/9] w-full overflow-hidden border-b border-line")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img {...picture(mediaUrl(item.cover, "cover"), "(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw")} alt="" style={coverStyle(item.coverAt)} className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h3 className="text-body font-semibold leading-snug text-ink">
                          {item.icon?.type === "emoji" ? <span aria-hidden="true" className="mr-1.5">{item.icon.emoji}</span> : null}
                          {item.title}
                        </h3>
                        {item.description ? (
                          <p className="text-small text-sub">
                            <LinkedText text={item.description} />
                          </p>
                        ) : null}
                        <div className="mt-auto flex items-center gap-2 pt-2">
                          {href ? (
                            <ButtonLink href={href} tone="secondary" className="min-h-target px-3 py-1.5">
                              {verbs[verb(item.action)]}
                            </ButtonLink>
                          ) : null}
                          {href && /^https?:/.test(href) ? <span className="truncate text-fine text-sub">{hostOf(href)}</span> : null}
                          {/* with no link to press, the kind of thing it is, in the
                              button's words (a slot), never the option's name */}
                          {item.action && !href ? (
                            <span className="ml-auto">
                              <Tag>{verbs[verb(item.action)]}</Tag>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        ) : (
          <Callout icon={<Icon name="books" />}>
            <T k="resources.empty">Nothing here yet. In Notion, add a row with Kind set to Resource, give it a Link, and tick Published.</T>
          </Callout>
        )}
      </Frame>
    </>
  )
}
