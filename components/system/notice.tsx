"use client"

import type React from "react"
import { useLayoutEffect, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"

import { buttonClass } from "@/components/ui/button"
import { MAKER } from "@/lib/site"

/**
 * A small centred dialog that says one thing and is dismissed: a Radix
 * dialog, so focus moves into it, stays there, and Escape closes it. It is
 * opened by code rather than by a Radix trigger, so it remembers where focus
 * was (the button that opened it) and puts it back there on closing.
 * Named by its title and described by its body.
 */
export function Notice({
  open,
  onOpenChange,
  title,
  children,
  closeLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  children: React.ReactNode
  closeLabel: string
}) {
  const returnTo = useRef<HTMLElement | null>(null)
  // before the dialog takes focus: where it was is where it goes back to
  useLayoutEffect(() => {
    if (open) returnTo.current = document.activeElement as HTMLElement | null
  }, [open])
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnTo.current?.focus()
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel bg-card p-6 text-ink shadow-pop">
          <Dialog.Title className="title-slab text-head-s leading-tight">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-3 text-body leading-relaxed text-ink">{children}</div>
          </Dialog.Description>
          <div className="mt-6 flex justify-end">
            <Dialog.Close className={buttonClass("primary")}>{closeLabel}</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * What an example form opens instead of sending (the mailing list, the
 * contact form and the feedback form, until the site has the platform each
 * needs): its words (`children`, a slot that ends before the address), then
 * where to write instead, the maker's address.
 */
export function ExampleNotice({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  closeLabel: string
  children: React.ReactNode
}) {
  return (
    <Notice open={open} onOpenChange={onOpenChange} title={title} closeLabel={closeLabel}>
      <p>
        {children}{" "}
        <a href={`mailto:${MAKER.email}`} className="n-link font-semibold">
          {MAKER.email}
        </a>
        .
      </p>
    </Notice>
  )
}
