import { CodeBlock } from "@/components/notion/code"
import { codeLabels } from "@/components/notion/context"
import { type SiteCopy, type T } from "@/components/system/notion-text"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { outsideLink } from "@/lib/outside"
import { DEPLOY_URL, NOTION_TEMPLATE_URL, REPO_URL, TEMPLATE_URL, VERCEL_IMPORT_URL } from "@/lib/site"

import { MarketingSection, SectionHead } from "../marketing"

/** The two settings a new project needs, with placeholders. */
const SETTINGS = `NOTION_TOKEN=ntn_your_integration_token
NOTION_DATABASE_ID=https://www.notion.so/your-copy-of-the-template`

/** PostHog's three settings, with placeholders (docs/feedback.md). */
const POSTHOG_SETTINGS = `NEXT_PUBLIC_POSTHOG_KEY=your_project_token
NEXT_PUBLIC_POSTHOG_REGION=eu
POSTHOG_PERSONAL_API_KEY=your_personal_api_key`

type Link = { key: string; words: string; href: string }
type Part = { key: string; title: string; text: string; code?: string; link?: Link }
/** A way to do a step, with what it is pressed through. */
type Route = { key: string; title: string; text: string; links: Link[]; deploy?: true }
type Step = Part & { routes?: Route[] }

/**
 * The five steps, each a slot pair under `features.deploy.<key>`, with a
 * link where it starts somewhere else. The third, the code onto Vercel, can
 * be done two ways, offered side by side: one press of the Deploy button
 * (Vercel makes the copy in the reader's GitHub and the project), or from
 * GitHub by hand (Use this template, then Vercel's import). Both end with
 * the same two settings, shown once under them. No step needs a terminal:
 * the README keeps the command-line way.
 */
const STEPS: Step[] = [
  {
    key: "notion",
    title: "Duplicate the Notion template",
    text: "Open the template in Notion and press Duplicate. Your copy has every page, post, plan, product and word of this site, ready to rename.",
    link: { key: "notion.open", words: "Open the Notion template", href: NOTION_TEMPLATE_URL },
  },
  {
    key: "connect",
    title: "Make an integration",
    text: "In Notion's integrations, make an internal one with Read content and nothing else, and copy its token. Then, on your copy of the template, open ⋯ → Connections and add it.",
    link: { key: "connect.open", words: "Notion's integrations", href: "https://www.notion.so/profile/integrations" },
  },
  {
    key: "button",
    title: "Put the code on Vercel, one of two ways",
    text: "Either way ends the same: your own copy of the code in your GitHub, a project on Vercel that builds from it, and these two settings in that project: the token from step 2, and the link to your copy of the template (Share → Copy link; the whole link works).",
    code: SETTINGS,
    routes: [
      {
        key: "oneclick",
        title: "In one press",
        text: "Press Deploy on Vercel and sign in with GitHub. Vercel makes the copy in your GitHub and the project in one go, then asks for the two settings. Press Deploy.",
        links: [],
        deploy: true,
      },
      {
        key: "github",
        title: "From GitHub",
        text: "On the template's GitHub page, press Use this template, then Create a new repository (or Fork it). In Vercel, press Add New → Project, pick your copy and press Import. Add the two settings under Environment Variables, then press Deploy.",
        links: [
          { key: "github.repo", words: "Use this template on GitHub", href: TEMPLATE_URL },
          { key: "github.import", words: "Import a project on Vercel", href: VERCEL_IMPORT_URL },
        ],
      },
    ],
  },
  {
    key: "domain",
    title: "Point your domain, connect your email",
    text: "Add your domain in Vercel and set NEXT_PUBLIC_SITE_URL to it. Then connect an email platform, or the contact form and the mailing list stay examples that send nothing. For rate limits shared across every server, add Upstash (Redis) from Storage → Marketplace and redeploy. A Shopify or Printify shop is a setting or two, when you want one.",
  },
  {
    key: "posthog",
    title: "Switch on PostHog",
    text: "For analytics and the Feedback button. In PostHog, copy the project token (Settings → Project) and set it in Vercel, with the region if your project is in the US cloud. Then make a personal API key (Settings → User → Personal API keys: read on Project and Organization, write on Survey and Feature flag) and set it too. Redeploy: the build makes the Site feedback survey and the flags, and nothing is counted until a reader says yes.",
    code: POSTHOG_SETTINGS,
    // the full guide, in the repository: none without one
    link: { key: "posthog.open", words: "Every PostHog step, the feedback agent included", href: REPO_URL ? `${REPO_URL}/blob/HEAD/docs/feedback.md#set-it-up` : "" },
  },
]

/** What comes after the steps: writing, not a step of deploying, so not
 *  numbered. */
const AFTER = { key: "write", title: "Write in Notion", text: "Tick Published. The site follows within a minute, or within seconds with a webhook." }

/** A step's or a part's words, link and code, under its title. */
function Body({ part, T, labels }: { part: Part; T: T; labels: ReturnType<typeof codeLabels> }) {
  return (
    <>
      <p className="mt-1.5 text-body leading-relaxed text-ink">
        <T k={`features.deploy.${part.key}.text`}>{part.text}</T>
      </p>
      {part.link?.href ? (
        <p className="mt-2 text-body">
          <a href={part.link.href} className="n-link inline-flex min-h-target items-center" {...outsideLink(part.link.href)}>
            <T k={`features.deploy.${part.link.key}`} words>
              {part.link.words}
            </T>
          </a>
        </p>
      ) : null}
      {part.code ? (
        <div className="mt-3">
          <CodeBlock language="bash" labels={labels} code={part.code} />
        </div>
      ) : null}
    </>
  )
}

/**
 * #deploy on /features: the template's directions in five steps, ending on a
 * live site, with nothing to install. The README and docs/ in the repository
 * have the full version, the command line included.
 */
export function DeploySteps({ T, content }: { T: T; content: SiteCopy }) {
  const labels = codeLabels(content)
  return (
    <MarketingSection id="deploy" labelledBy="deploy-title" size="text">
      <SectionHead
        id="deploy-title"
        eyebrow={<T k="features.deploy.label">directions</T>}
        title={<T k="features.deploy.title">deploy on vercel in five steps</T>}
        lede={<T k="features.deploy.steps">About ten minutes, most of it waiting for the first deploy, and nothing to install. A Notion account, a GitHub account and a Vercel account, all free, put it live. The contact form and the mailing list also need an email platform, such as Brevo or Resend.</T>}
      />
      <ol className="arrive-each section-body space-y-8">
        {STEPS.map((step, n) => (
          <li key={step.key} className="grid gap-x-5 gap-y-2 sm:grid-cols-[48px_1fr]">
            <span aria-hidden="true" className="title-slab text-head-l leading-none text-accent">
              {n + 1}
            </span>
            <div className="min-w-0">
              <h3 className="title-slab text-head-s leading-tight">
                <T k={`features.deploy.${step.key}.title`}>{step.title}</T>
              </h3>
              <Body part={step} T={T} labels={labels} />
              {step.routes ? (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {step.routes.map((route) => (
                    <li key={route.key} className="flex flex-col rounded-card border border-line bg-card p-5">
                      <h4 className="text-lead font-semibold leading-snug text-strong">
                        <T k={`features.deploy.${route.key}.title`}>{route.title}</T>
                      </h4>
                      <p className="mt-1.5 text-ui leading-relaxed text-ink">
                        <T k={`features.deploy.${route.key}.text`}>{route.text}</T>
                      </p>
                      {route.deploy && DEPLOY_URL ? (
                        <ButtonRow className="mt-auto pt-4">
                          <ButtonLink href={DEPLOY_URL}>
                            <T k="features.deploy.button.cta">Deploy on Vercel</T>
                          </ButtonLink>
                        </ButtonRow>
                      ) : null}
                      {route.links.filter((link) => link.href).map((link) => (
                        <a key={link.key} href={link.href} className="n-link inline-flex min-h-target items-center text-ui" {...outsideLink(link.href)}>
                          <T k={`features.deploy.${link.key}`} words>
                            {link.words}
                          </T>
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-10 border-t border-line pt-8">
        <h3 className="title-slab text-head-s leading-tight">
          <T k={`features.deploy.${AFTER.key}.title`}>{AFTER.title}</T>
        </h3>
        <p className="mt-1.5 text-body leading-relaxed text-ink">
          <T k={`features.deploy.${AFTER.key}.text`}>{AFTER.text}</T>
        </p>
      </div>
      {REPO_URL ? (
        <ButtonRow className="mt-10">
          <ButtonLink href={`${REPO_URL}#readme`} tone="secondary">
            <T k="features.deploy.docs">The full directions</T>
          </ButtonLink>
        </ButtonRow>
      ) : null}
    </MarketingSection>
  )
}
