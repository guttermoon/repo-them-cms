import { useEffect, useLayoutEffect } from "react"

/**
 * An effect run before the browser paints, for a measurement the first
 * frame must already reflect (a word fitted to its line, a menu turned to
 * where it fits). On the server there is nothing to measure and no layout
 * effect runs, so it is a plain effect.
 */
export const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect
