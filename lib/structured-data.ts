/**
 * Structured data (schema.org JSON-LD), so search engines and assistants
 * read the site the way a person does. Nothing here claims what the site
 * does not have: no rating, no review, no price.
 *
 * - `siteLd(copy)`, on every page from the root layout: the WebSite, the
 *   Organization that publishes it (the site's own name and mark), the
 *   person who made it (as its creator and author), and the template itself
 *   as SoftwareSourceCode once its repository is public.
 * - `pageLd()`, on each designed page: a WebPage (an FAQPage too where the
 *   page prints questions), with a breadcrumb below the top level.
 * - `postLd()` / `notionPageLd()` / `blogLd()`: the blog and the pages
 *   written in Notion, with their real dates; `collectionLd()` and
 *   `productLd()`: the shop's.
 *
 * Every name a page goes by is the one its reader sees: a designed page's
 * own words (`pageWords()`), the navigation's names for the blog and the
 * shop (`navName()`), both of them editable in Notion.
 */
import { safeHref } from "./inline-links"
import { inlineWords } from "./inline-text"
import type { Entry, SiteCopy } from "./notion/rows"
import { navName } from "./nav"
import { PAGE_META, pageWords, type IndexedPath } from "./page-meta"
import { absoluteUrl, ogImagePath, OG_SIZE } from "./seo"
import { MAKER, REPO_URL, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_LOGO, SITE_URL, TEMPLATE_NAME } from "./site"
import { logoPicture, pagePicture, sitePicture, type SharePicture, type SiteWords } from "./share"
import { siteName } from "./slots"
import { isRelease } from "./content/select"

const WEBSITE_ID = `${SITE_URL}/#website`
/** The site as the one who publishes it: what a post's publisher and the
 *  website's point at, so the name and the mark are said once. */
/**
 * A row's Link as structured data may name it: what its page would link to
 * (`safeHref`), as a whole address. A `javascript:` Link the page drops is
 * dropped here too, since what machines are told is what the page says.
 */
function webAddress(link: string | undefined): string | undefined {
  const href = link ? safeHref(link) : undefined
  if (!href) return undefined
  if (/^https?:/i.test(href)) return href
  return href.startsWith("/") ? absoluteUrl(href) : undefined
}

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
/** The maker's own `@id`, so this graph joins theirs if their site uses it. */
export const PERSON_ID = `${MAKER.url}/#person`

export const pageUrl = (path: string) => (path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`)

const person = () => ({
  "@type": "Person",
  "@id": PERSON_ID,
  name: MAKER.name,
  url: MAKER.url,
  email: `mailto:${MAKER.email}`,
  knowsAbout: ["Notion", "Next.js", "Websites built on Notion"],
})

/**
 * The site as a whole: on every page, from the root layout. The website is
 * published by the Organization of the same name, whose logo is the one
 * given in Notion (`site.logo`, lib/share.ts) or else the site's mark
 * (SITE_LOGO), so a search engine shows it beside the name; it was made by
 * the template's maker.
 */
export function siteLd(data: SiteWords) {
  const copy = data.copy
  const name = siteName(copy)
  const given = logoPicture(data)
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${SITE_URL}/`,
      name,
      description: pageWords("/", copy).description,
      inLanguage: SITE_LANGUAGE,
      publisher: { "@id": ORGANIZATION_ID },
      creator: { "@id": PERSON_ID },
      author: { "@id": PERSON_ID },
    },
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name,
      url: `${SITE_URL}/`,
      logo: given
        ? { "@type": "ImageObject", "@id": `${SITE_URL}/#logo`, url: absoluteUrl(given.url), contentUrl: absoluteUrl(given.url), caption: given.alt }
        : {
            "@type": "ImageObject",
            "@id": `${SITE_URL}/#logo`,
            url: absoluteUrl(SITE_LOGO.src),
            contentUrl: absoluteUrl(SITE_LOGO.src),
            width: SITE_LOGO.width,
            height: SITE_LOGO.height,
            caption: name,
          },
      image: { "@id": `${SITE_URL}/#logo` },
    },
    person(),
  ]
  if (REPO_URL) {
    graph.push({
      "@type": "SoftwareSourceCode",
      "@id": `${SITE_URL}/#template`,
      name: TEMPLATE_NAME,
      description: SITE_DESCRIPTION,
      codeRepository: REPO_URL,
      programmingLanguage: "TypeScript",
      runtimePlatform: "Next.js",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": PERSON_ID },
      isAccessibleForFree: true,
    })
  }
  return { "@context": "https://schema.org", "@graph": graph }
}

/** One question as the page prints it: its slot, its answer's paragraphs,
 *  and the prefix both are read under. */
export type Answered = { name: string; text: string }

/** Question rows from Notion as the reader sees them: the answer's links
 *  read as their words. */
export function answeredRows(rows: { title: string; text?: string }[]): Answered[] {
  return rows.flatMap((row) => {
    const text = inlineWords(row.text ?? "").trim()
    return row.title && text ? [{ name: row.title, text }] : []
  })
}

type Crumb = { name: string; path: string }

function breadcrumbLd(url: string, trail: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: pageUrl(crumb.path),
    })),
  }
}

/** A page's picture: the one given in Notion (lib/share.ts), or the card
 *  drawn with its title, at its known size. */
const image = (path: string, alt: string, picture?: SharePicture) =>
  picture
    ? { "@type": "ImageObject", url: absoluteUrl(picture.url), caption: picture.alt }
    : {
        "@type": "ImageObject",
        url: absoluteUrl(ogImagePath(path)),
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        caption: alt,
      }

/** The pages a path stands under, nearest last: "/resources/ingredients"
 *  stands under "/resources". */
const ancestors = (path: string): string[] => {
  const parts = path.split("/").filter(Boolean)
  return parts.slice(0, -1).map((_, i) => `/${parts.slice(0, i + 1).join("/")}`)
}

/**
 * A designed page's own structured data, beside the site's graph: a
 * WebPage (an FAQPage too where the page prints questions), and below the
 * top level a breadcrumb trail through the pages it stands under, each named
 * as the link back to it is (its label).
 */
export function pageLd(path: IndexedPath, data: SiteWords, options: { questions?: Answered[]; type?: string } = {}) {
  const copy = data.copy
  const url = pageUrl(path)
  const { title, description } = pageWords(path, copy)
  const questions = options.questions?.length ? options.questions : undefined
  const base = options.type ?? "WebPage"
  const page: Record<string, unknown> = {
    "@type": questions ? [base, "FAQPage"] : base,
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: SITE_LANGUAGE,
    // the picture its link shows when shared (lib/share.ts)
    image: image(path, title, pagePicture(data, path) ?? sitePicture(data)),
  }
  // the template itself is described on /features alone
  if (path === "/features" && REPO_URL) page.about = { "@id": `${SITE_URL}/#template` }
  if (questions) {
    page.mainEntity = questions.map(({ name, text }) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text },
    }))
  }
  const above = ancestors(path).filter((p): p is IndexedPath => p in PAGE_META)
  if (!above.length) return { "@context": "https://schema.org", "@graph": [page] }
  page.breadcrumb = { "@id": `${url}#breadcrumb` }
  const trail = [{ name: siteName(copy), path: "/" }, ...above.map((p) => ({ name: pageWords(p, copy).label, path: p })), { name: title, path }]
  return { "@context": "https://schema.org", "@graph": [page, breadcrumbLd(url, trail)] }
}

/** The maker's services, on /features#services: what they are and who
 *  provides them. No price: the services are quoted per job, and an Offer
 *  without a price would claim one. */
export function serviceLd(services: { name: string; description: string }[]) {
  const url = `${pageUrl("/features")}#services`
  return {
    "@context": "https://schema.org",
    "@graph": services.map((service, i) => ({
      "@type": "Service",
      "@id": `${url}#service-${i + 1}`,
      name: service.name,
      description: service.description,
      serviceType: "Website setup and development",
      provider: { "@id": PERSON_ID },
      url,
    })),
  }
}

/** The team on /team: each person's name, role and a line about them, and
 *  their portrait and profile when their row has them. */
export function teamLd(people: { title: string; description?: string; text?: string; image?: string; link?: string }[]) {
  const url = pageUrl("/team")
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": `${url}#team`,
        itemListElement: people.map((person, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Person",
            name: person.title,
            ...(person.description ? { jobTitle: inlineWords(person.description) } : {}),
            ...(person.text ? { description: inlineWords(person.text) } : {}),
            ...(person.image ? { image: absoluteUrl(person.image) } : {}),
            ...(webAddress(person.link) ? { url: webAddress(person.link) } : {}),
            worksFor: { "@id": WEBSITE_ID },
          },
        })),
      },
    ],
  }
}

/**
 * A product in a live shop: its name, pictures and one Offer with its real
 * price and stock. Never for the example shop (lib/commerce/config.ts):
 * fictional goods are not marked up as things for sale.
 */
export function productLd(
  product: {
    slug: string
    title: string
    description: string
    images: string[]
    price?: number
    currency: string
    stock?: string
  },
  copy: SiteCopy,
) {
  const url = pageUrl(`/shop/${product.slug}`)
  const availability: Record<string, string> = {
    "in stock": "https://schema.org/InStock",
    "low stock": "https://schema.org/LimitedAvailability",
    "sold out": "https://schema.org/OutOfStock",
    "pre-order": "https://schema.org/PreOrder",
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.title,
        ...(product.description ? { description: inlineWords(product.description) } : {}),
        ...(product.images.length ? { image: product.images.map((src) => absoluteUrl(src)) } : {}),
        url,
        ...(product.price !== undefined
          ? {
              offers: {
                "@type": "Offer",
                price: product.price.toFixed(2),
                priceCurrency: product.currency,
                availability: availability[product.stock?.toLowerCase() ?? "in stock"] ?? "https://schema.org/InStock",
                url,
              },
            }
          : {}),
      },
      breadcrumbLd(url, [
        { name: siteName(copy), path: "/" },
        { name: navName(copy, "/shop"), path: "/shop" },
        { name: product.title, path: `/shop/${product.slug}` },
      ]),
    ],
  }
}

/**
 * A page that lists posts: a CollectionPage (a kind of WebPage). On /blog
 * its main entity is the Blog itself, with its posts; on the changelog and
 * a category or tag page it is the list of posts shown. A category or tag
 * page has a trail back through the blog; the changelog, a section of its
 * own (its releases are not the blog's), stands under the home page alone.
 */
export function blogLd(posts: Entry[], copy: SiteCopy, page?: { path: string; name: string; description: string }) {
  const { path, name, description } = page ?? { path: "/blog", name: pageWords("/blog", copy).title, description: pageWords("/blog", copy).description }
  const url = pageUrl(path)
  const postings = posts.slice(0, 50).map((post) => ({
    "@type": "BlogPosting",
    headline: post.title,
    url: pageUrl(`/blog/${post.slug}`),
    ...(post.date ? { datePublished: post.date } : {}),
  }))
  const blog = path === "/blog"
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: SITE_LANGUAGE,
        mainEntity: blog
          ? { "@type": "Blog", "@id": `${url}#blog`, name, url, blogPost: postings }
          : {
              "@type": "ItemList",
              itemListElement: postings.map((posting, i) => ({ "@type": "ListItem", position: i + 1, url: posting.url, name: posting.headline })),
            },
      },
      ...(blog
        ? []
        : [
            breadcrumbLd(url, [
              { name: siteName(copy), path: "/" },
              ...(path === "/changelog" ? [] : [{ name: navName(copy, "/blog"), path: "/blog" }]),
              { name, path },
            ]),
          ]),
    ],
  }
}

/**
 * A collection in the shop: a CollectionPage listing its products, with a
 * trail back to the shop. The products are named, never offered: an Offer
 * belongs on a product's own page, and only in a live shop.
 */
export function collectionLd(products: { slug: string; title: string }[], copy: SiteCopy, page: { path: string; name: string; description: string }) {
  const url = pageUrl(page.path)
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: page.name,
        description: page.description,
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: SITE_LANGUAGE,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: products.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: pageUrl(`/shop/${p.slug}`), name: p.title })),
        },
      },
      breadcrumbLd(url, [{ name: siteName(copy), path: "/" }, { name: navName(copy, "/shop"), path: "/shop" }, { name: page.name, path: page.path }]),
    ],
  }
}

/** One post: a BlogPosting with its real dates, its author as the page
 *  shows them (name, the line about them, their portrait), and the site as
 *  its publisher. */
export function postLd(post: Entry, copy: SiteCopy, imageUrl?: string, authorImageUrl?: string) {
  const path = `/blog/${post.slug}`
  const section = isRelease(post) ? "/changelog" : "/blog"
  const url = pageUrl(path)
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: post.title,
        ...(post.description ? { description: inlineWords(post.description) } : {}),
        datePublished: post.date ?? post.created,
        dateModified: post.lastEdited || post.date || post.created,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": WEBSITE_ID },
        image: imageUrl ? absoluteUrl(imageUrl) : absoluteUrl(ogImagePath(path)),
        ...(post.author
          ? {
              author: {
                "@type": "Person",
                name: post.author.name,
                ...(post.author.role ? { jobTitle: post.author.role } : {}),
                ...(inlineWords(post.author.bio ?? "").trim() ? { description: inlineWords(post.author.bio ?? "").trim() } : {}),
                ...(authorImageUrl ? { image: absoluteUrl(authorImageUrl) } : {}),
              },
            }
          : {}),
        publisher: { "@id": ORGANIZATION_ID },
        ...(post.category ? { articleSection: post.category.name } : {}),
        ...(post.tags.length ? { keywords: post.tags.map((t) => t.name).join(", ") } : {}),
      },
      // a release stands under the changelog, a blog post under the blog
      breadcrumbLd(url, [
        { name: siteName(copy), path: "/" },
        { name: navName(copy, section), path: section },
        { name: post.title, path },
      ]),
    ],
  }
}

/**
 * A page written in Notion: a WebPage with its last edit and the picture
 * its link shows (`picture`: its cover, or the site's), and, when it stands
 * under another ("guides/setup"), a trail through every live page above it
 * (`pages`, the live pages) to the homepage.
 */
export function notionPageLd(page: Entry, copy: SiteCopy, pages: Pick<Entry, "slug" | "title">[] = [], picture?: SharePicture) {
  const path = `/${page.slug}`
  const url = pageUrl(path)
  const above = ancestors(path).flatMap((p) => pages.filter((other) => `/${other.slug}` === p).slice(0, 1).map((other) => ({ name: other.title, path: p })))
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        ...(page.description ? { description: inlineWords(page.description) } : {}),
        isPartOf: { "@id": WEBSITE_ID },
        inLanguage: SITE_LANGUAGE,
        dateModified: page.lastEdited || page.created,
        image: image(path, page.title, picture),
        ...(ancestors(path).length ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
      },
      ...(ancestors(path).length ? [breadcrumbLd(url, [{ name: siteName(copy), path: "/" }, ...above, { name: page.title, path }])] : []),
    ],
  }
}
