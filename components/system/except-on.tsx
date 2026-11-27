"use client"

import { usePathname } from "next/navigation"
import type React from "react"

/**
 * Its children on every page but those at `paths`. For what the root layout
 * puts on every page and one page places itself: the service counter, which
 * /features sets above the services in full rather than above the footer.
 * The path is known on the server too, so the page's HTML never holds it
 * twice.
 */
export function ExceptOn({ paths, children }: { paths: string[]; children: React.ReactNode }) {
  const path = usePathname()
  return paths.includes(path) ? null : <>{children}</>
}
