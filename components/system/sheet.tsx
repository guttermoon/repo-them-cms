"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"

/**
 * The phone menu's drawer (components/layout/site-header.tsx): a Radix dialog
 * that slides in from the right.
 */
const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

/** The right-hand drawer, with the menu's own width, rule and ground. */
const SHEET =
  "fixed inset-y-0 right-0 z-50 h-full w-[86vw] max-w-sm gap-4 overflow-y-auto bg-card p-6 text-ink shadow-pop transition ease-in-out sm:max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:animate-none motion-reduce:transition-none"

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  Omit<React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>, "className"> & { closeLabel?: string }
>(({ children, closeLabel = "Close", ...props }, ref) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
    {/* No description: the drawer is a list of links, which describe
        themselves. Saying so explicitly is what stops Radix warning. */}
    <SheetPrimitive.Content ref={ref} aria-describedby={undefined} className={SHEET} {...props}>
      {children}
      <SheetPrimitive.Close className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink tone hover:bg-wash">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-4 w-4"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        <span className="sr-only">{closeLabel}</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

/** The dialog's name for a screen reader. Without one the drawer was
 *  announced as an unnamed dialog (its aria-labelledby pointed at nothing). */
const SheetTitle = SheetPrimitive.Title

export { Sheet, SheetContent, SheetTitle, SheetTrigger }
