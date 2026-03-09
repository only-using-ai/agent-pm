'use client'

import { useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ConversationProps {
  children: ReactNode
  /** Empty state when there are no messages. */
  empty?: ReactNode
  className?: string
}

/**
 * Chat conversation container: scrollable area that sticks to bottom while
 * new content streams. Matches shadcn.io/ai/conversation pattern.
 */
export function Conversation({
  children,
  empty,
  className,
}: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const isUserScrolledRef = useRef(false)

  useEffect(() => {
    if (!scrollRef.current || !endRef.current) return
    if (isUserScrolledRef.current) return
    endRef.current.scrollIntoView({ behavior: 'smooth' })
  })

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const threshold = 50
    isUserScrolledRef.current = scrollHeight - scrollTop - clientHeight > threshold
  }

  const hasContent = !!children

  return (
    <div className={cn('flex flex-1 flex-col overflow-hidden', className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {hasContent ? (
          <div className="flex flex-col gap-4 py-2">
            {children}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-muted-foreground">
            {empty}
          </div>
        )}
      </div>
    </div>
  )
}
