"use client"

import { clearConsent } from "@/lib/consent"

/**
 * Re-opens the cookie question so a reader can change their answer.
 * Withdrawing consent has to be as easy as giving it, so this sits in the
 * footer on every page and on the privacy page, whenever the question is
 * asked, for real or as an example (asksCookies in lib/analytics-config.ts).
 */
export function CookieSettingsLink({ className, label }: { className?: string; label: string }) {
  return (
    <button type="button" onClick={clearConsent} className={className}>
      {label}
    </button>
  )
}
