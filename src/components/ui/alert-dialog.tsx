'use client'

import * as React from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

function AlertDialogRoot({
  open,
  onOpenChange,
  ...props
}: AlertDialogPrimitive.Root.Props) {
  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      data-slot="alert-dialog"
      {...props}
    />
  )
}

function AlertDialogPortal(props: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogBackdrop({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-backdrop"
      className={cn(
        'fixed inset-0 z-50 bg-black/60 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0',
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogPopup({ className, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Popup
      data-slot="alert-dialog-popup"
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

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('mt-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function AlertDialogClose(
  { className, ...props }: AlertDialogPrimitive.Close.Props
) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-close"
      className={cn(className)}
      {...props}
    />
  )
}

type ConfirmAlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: 'default' | 'destructive'
}

function ConfirmAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'default',
}: ConfirmAlertDialogProps) {
  const [loading, setLoading] = React.useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await Promise.resolve(onConfirm())
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialogRoot open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogBackdrop />
        <AlertDialogPopup>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogClose
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
              )}
              disabled={loading}
            >
              {cancelLabel}
            </AlertDialogClose>
            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Please wait…' : confirmLabel}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialogRoot>
  )
}

export {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogBackdrop,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  ConfirmAlertDialog,
}
