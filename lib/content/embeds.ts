/**
 * Recognising a YouTube or Vimeo address, so a Notion video or embed block
 * can become a click-to-load player (components/notion/video-embed.tsx)
 * rather than an iframe that contacts the host on page load.
 *
 * Imports nothing, so `npm test` loads it.
 */
export type Video = { provider: "YouTube" | "Vimeo"; id: string; embedUrl: string; watchUrl: string }

export function videoFor(raw: string | undefined): Video | undefined {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, "")
  let youtube: string | undefined
  if (host === "youtu.be") youtube = url.pathname.slice(1).split("/")[0]
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtube =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ??
      undefined
  }
  if (youtube && /^[\w-]{6,20}$/.test(youtube)) {
    return {
      provider: "YouTube",
      id: youtube,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${youtube}`,
    }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(?:^|\/)(\d{5,})(?:\/|$)/)?.[1]
    if (id) {
      return {
        provider: "Vimeo",
        id,
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`,
        watchUrl: `https://vimeo.com/${id}`,
      }
    }
  }
  return undefined
}

/** "https://www.example.com/a/b" → "example.com", for a link card. */
export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "")
  } catch {
    return raw
  }
}
