"use client"

import NextError from "next/error"
import { useEffect } from "react"

import { capturePostHogException } from "@/components/layout/posthog-analytics"

/** Catches root-layout and first-render failures that browser autocapture misses. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    capturePostHogException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  )
}
