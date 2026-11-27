"use client"

import { useEffect, useRef, useState } from "react"

/**
 * A button that puts some text on the clipboard exactly as it is (a code
 * block, a command, a link). It says "Copied" for a moment, or says the
 * clipboard refused, in which case the text is still on the page to select.
 */
export function CopyText({
  text,
  label,
  copied,
  failed,
  className = "",
}: {
  text: string
  /** its words, from the page's copy (`blocks.copy`, `.copied`, `.copyFailed`) */
  label: string
  copied: string
  failed: string
  className?: string
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState("copied")
    } catch {
      setState("failed")
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("idle"), 2500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`inline-flex min-h-target min-w-target items-center justify-center rounded-full px-3 text-fine font-medium text-sub tone hover:bg-line hover:text-ink ${className}`.trim()}
    >
      {state === "copied" ? copied : state === "failed" ? failed : label}
    </button>
  )
}
