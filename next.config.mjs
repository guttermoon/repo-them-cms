// Only `next dev` loosens the policy: a build under any other NODE_ENV
// ("test", "staging") ships the production one.
const dev = process.env.NODE_ENV === "development"

/**
 * The Content-Security-Policy. The rule it enforces is the site's own: a
 * reader's browser talks to this site and nobody else.
 *
 * - Fonts, stylesheets, scripts, pictures, media and requests from this site
 *   only. next/font serves the faces from /_next/static, the media route
 *   serves Notion's files, and analytics goes through /ingest and /ga.
 * - The one exception is frames: a YouTube or Vimeo player, loaded only when
 *   a reader presses play (components/notion/video-embed.tsx).
 * - Inline scripts are allowed because Next's hydration and the theme
 *   script use them; `unsafe-eval` only in development, for React's refresh.
 * - Nothing may frame this site, and no plugin may run.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

/**
 * The site's address, for the browser as well as the server.
 *
 * With NEXT_PUBLIC_SITE_URL unset on Vercel, lib/site.ts falls back to
 * Vercel's own variables, which only the server can read: a client component
 * would then work the address out as localhost, and a link to the site's own
 * address would be drawn one way on the server and another in the browser.
 * So the address the server would use is handed to both, here, at build.
 */
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? (host.startsWith("http") ? host : `https://${host}`) : "")

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(siteUrl ? { env: { NEXT_PUBLIC_SITE_URL: siteUrl } } : {}),
  // Neither `eslint.ignoreDuringBuilds` nor `typescript.ignoreBuildErrors` is
  // set: a lint or type error fails the build rather than ships.
  //
  // Next's image optimiser is off: nothing uses next/image (pictures are
  // plain <img> elements, resized by the media route), so /_next/image
  // answers 404. No remote host is let through it: allowing '**' would make
  // it an open image proxy on your bandwidth, and even off-site pictures
  // aside, it decodes whatever a stranger points it at on this site.
  images: { unoptimized: true },
  // the share cards' font is read from disk at request time
  outputFileTracingIncludes: { "/og/[[...path]]": ["./assets/fonts/**"] },
  // PostHog's endpoints end in a slash (/e/, /s/, /flags/) and arrive through
  // /ingest, so Next's own trailing-slash redirect is off and the first
  // redirect below does its job for every other path.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // the origin to other sites, the full address to this one, so a
          // query string never leaks to a third party in a Referer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Every address but /media/, which sends a stricter policy of its own
        // (a file opened on its own runs nothing: app/media). Sent together,
        // two policies hold only where the host keeps both, so the file's is
        // the one it has.
        source: "/:path((?!media/).*)",
        headers: [{ key: "Content-Security-Policy", value: CSP }],
      },
      {
        // the icons keep their addresses, so a new mark arrives by revalidation
        source: "/:icon(favicon.ico|favicon.svg|apple-touch-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ]
  },
  // A page written in Notion as Markdown at its own address with .md added
  // (/blog/hello.md, /colophon.md), served by app/markdown. A rewrite, so
  // the address stays the one a reader asked for; checked before the
  // dynamic routes, which would otherwise read "hello.md" as a slug.
  async rewrites() {
    return [{ source: "/:path((?!markdown/|api/|media/|_next/).+)\\.md", destination: "/markdown/:path" }]
  },
  async redirects() {
    return [
      // one address per page: /blog/ → /blog, everywhere but /ingest
      { source: "/:path((?!ingest(?:/|$)).+)/", destination: "/:path", permanent: true },
      // the template's directions and services live on /features
      { source: "/setup", destination: "/features#deploy", permanent: true },
      { source: "/services", destination: "/features#services", permanent: true },
      // common guesses at pages that live under another name
      { source: "/docs", destination: "/features#deploy", permanent: false },
      { source: "/team-members", destination: "/team", permanent: false },
      { source: "/faq", destination: "/questions", permanent: false },
      { source: "/rss.xml", destination: "/blog/rss.xml", permanent: false },
      // RFC 9116 names /.well-known/security.txt; older scanners ask at the root
      { source: "/security.txt", destination: "/.well-known/security.txt", permanent: true },
      { source: "/feed", destination: "/blog/rss.xml", permanent: false },
    ]
  },
}

export default nextConfig
