'use client'

import { useEffect, useRef, useState } from 'react'
import { Brain } from 'lucide-react'
import { Streamdown } from 'streamdown'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface ReasoningProps {
  /** Reasoning/thinking text (streaming or final). */
  content: string
  /** True while the model is still streaming thinking tokens. */
  isStreaming?: boolean
  className?: string
}

/**
 * Collapsible reasoning block: brain icon, duration when done, shimmer while streaming.
 * Auto-opens when thinking starts and auto-collapses when streaming ends.
 */
export function Reasoning({
  content,
  isStreaming = false,
  className,
}: ReasoningProps) {
  const [open, setOpen] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const prevStreamingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Start timer when we get first content while streaming; defer setOpen to avoid synchronous setState in effect
  useEffect(() => {
    if (content && isStreaming && startTimeRef.current === null) {
      startTimeRef.current = Date.now()
      queueMicrotask(() => setOpen(true))
    }
  }, [content, isStreaming])

  // Auto-scroll thinking box to bottom when content updates
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [content])

  // When streaming ends, compute duration and collapse
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = isStreaming
    if (wasStreaming && !isStreaming && startTimeRef.current !== null) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      setDurationSeconds(Math.round(elapsed))
      setOpen(false)
      startTimeRef.current = null
    }
  }, [isStreaming])

  const triggerLabel = isStreaming
    ? 'Thinking...'
    : durationSeconds !== null
      ? `Thought for ${durationSeconds}s`
      : 'Model thinking'

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('mb-3', className)}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md font-medium text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Brain className="size-4 shrink-0" aria-hidden />
        <span>{triggerLabel}</span>
        {isStreaming && (
          <span className="inline-block size-2 animate-pulse rounded-full bg-primary" aria-hidden />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scrollContainerRef}
          className="relative mt-2 max-h-[400px] overflow-y-auto overflow-x-hidden rounded-md border bg-muted/50 p-3"
        >
          {isStreaming && (
            <div
              className="pointer-events-none absolute inset-0 z-10 opacity-30"
              aria-hidden
            >
              <div
                className="h-full w-full bg-[linear-gradient(90deg,transparent_0%,var(--muted)_50%,transparent_100%)] bg-[length:200%_100%]"
                style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
              />
            </div>
          )}
          <div className="relative z-0 text-xs text-muted-foreground [&_.streamdown]:text-xs [&_.streamdown]:text-muted-foreground">
            <Streamdown isAnimating={isStreaming} animated>
              {`${content}${isStreaming ? '▌' : ''}`}
            </Streamdown>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
