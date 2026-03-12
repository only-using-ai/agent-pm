'use client'

import * as DialogPrimitive from '@base-ui/react/dialog'

import { cn } from '@/lib/utils'

const DialogRoot = DialogPrimitive.Dialog.Root
const DialogPortal = DialogPrimitive.Dialog.Portal
const DialogClose = DialogPrimitive.Dialog.Close
const DialogTitle = DialogPrimitive.Dialog.Title
const DialogDescription = DialogPrimitive.Dialog.Description

function DialogBackdrop({ className, ...props }: DialogPrimitive.Dialog.Backdrop.Props) {
  return (
    <DialogPrimitive.Dialog.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        'fixed inset-0 z-50 bg-black/65 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0',
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className
      )}
      {...props}
    />
  )
}

function DialogPopup({ className, ...props }: DialogPrimitive.Dialog.Popup.Props) {
  return (
    <DialogPrimitive.Dialog.Popup
      data-slot="dialog-popup"
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
        'rounded-lg border-2 border-border bg-background p-6 shadow-xl ring-2 ring-foreground/10',
        'duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:translate-x-[-50%] data-ending-style:translate-y-[-50%] data-ending-style:scale-95',
        'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-left-1/2 data-open:slide-in-from-top-[48%]',
        'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:slide-out-to-left-1/2 data-closed:slide-out-to-top-[48%]',
        className
      )}
      {...props}
    />
  )
}

export {
  DialogRoot,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
