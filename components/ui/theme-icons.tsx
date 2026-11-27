import type React from "react"

import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/lib/icons"
import { THEMES, type Theme } from "@/lib/theme"

/** Each look's icon, for the header's switch. */
export const THEME_ICON_NAMES: Record<Theme, IconName> = { light: "sun", dark: "moon", mono: "circle-half", rainbow: "rainbow" }

/**
 * The switch's icons, drawn on the server and handed to the client component
 * (components/ui/theme-switch.tsx), so their paths never ship to a browser.
 */
export function themeIcons(): Record<Theme, React.ReactNode> {
  return Object.fromEntries(THEMES.map((theme) => [theme, <Icon key={theme} name={THEME_ICON_NAMES[theme]} />])) as Record<Theme, React.ReactNode>
}
