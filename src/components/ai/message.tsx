'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type MessageRole = 'user' | 'assistant'

export interface MessageProps {
  role: MessageRole
  children: ReactNode
  className?: string
}

/**
 * Chat message bubble: user (right, primary bg) vs assistant (left, muted).
 * Matches shadcn.io/ai/message pattern.
 */
export function Message({ role, children, className }: MessageProps) {
  return (
    <div
      className={cn(
        'flex w-full',
        role === 'user' ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {children}
      </div>
    </div>
  )
}
