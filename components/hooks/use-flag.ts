"use client"

import { useEffect, useState } from "react"

import { onPostHogFlag } from "@/components/layout/posthog-analytics"
import { FLAGS, type FlagKey } from "@/lib/flags"

/**
 * A feature flag (lib/flags.ts): its fallback on the server and on the first
 * paint, so the page hydrates as it was drawn, then PostHog's answer for a
 * reader who said yes. Use it only for what may appear after the page has
 * loaded (a corner button, a section below the fold), never for what the
 * first paint lays out.
 */
export function useFlag(key: FlagKey): boolean {
  const [on, setOn] = useState<boolean>(FLAGS[key].fallback)
  useEffect(() => onPostHogFlag(key, setOn), [key])
  return on
}
