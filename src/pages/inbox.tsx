import { useCallback, useEffect, useState } from 'react'
import { listInbox, approveInboxItem, rejectInboxItem } from '@/lib/api'
import { useInbox } from '@/contexts/inbox-context'
import {
  Check,
  ChevronRight,
  Clock,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

export type InboxItemType = 'approval' | 'info_request'

export interface InboxItem {
  id: string
  type: InboxItemType
  subject: string
  from: string
  fromAgentId: string | null
  preview: string
  body: string
  receivedAt: string
  read: boolean
  context?: { projectId?: string; workItemId?: string; task?: string }
}

function formatInboxDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getUTCDate() === now.getUTCDate() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCFullYear() === now.getUTCFullYear()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    d.getUTCDate() === yesterday.getUTCDate() &&
    d.getUTCMonth() === yesterday.getUTCMonth() &&
    d.getUTCFullYear() === yesterday.getUTCFullYear()
  ) {
    return 'Yesterday'
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function rowToInboxItem(row: Awaited<ReturnType<typeof listInbox>>[number]): InboxItem {
  const firstLine = row.body.split('\n')[0]?.trim() || row.body.slice(0, 60)
  const subject = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine
  return {
    id: row.id,
    type: (row as { type?: 'approval' | 'info_request' }).type ?? 'approval',
    subject,
    from: row.agent_name,
    fromAgentId: row.agent_id ?? null,
    preview: row.body.slice(0, 120) + (row.body.length > 120 ? '…' : ''),
    body: row.body,
    receivedAt: row.created_at,
    read: false,
    context: { projectId: row.project_id, workItemId: row.work_item_id },
  }
}

export function InboxPage() {
  const { refetch: refetchInbox } = useInbox()
  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listInbox()
      setItems(rows.map(rowToInboxItem))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  const selected = items.find((i) => i.id === selectedId)

  const markRead = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, read: true } : i))
    )
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    markRead(id)
    setReplyText('')
  }

  const handleApprove = async (id: string) => {
    try {
      await approveInboxItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (selectedId === id) setSelectedId(null)
      await refetchInbox()
    } catch {
      // keep item on failure
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectInboxItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (selectedId === id) setSelectedId(null)
      await refetchInbox()
    } catch {
      // keep item on failure
    }
  }

  const handleSendReply = (id: string) => {
    if (!replyText.trim()) return
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (selectedId === id) setSelectedId(null)
    setReplyText('')
  }

  const unreadCount = items.filter((i) => !i.read).length

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[420px] flex-col lg:flex-row">
      <div className="flex flex-col border-b border-border lg:w-[380px] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Inbox</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
                <p className="text-sm">Loading…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
                <MessageSquare className="size-10 opacity-50" />
                <p className="text-sm">No messages</p>
                <p className="text-xs">
                  Approvals and agent requests will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors',
                    'hover:bg-muted/60',
                    selectedId === item.id && 'bg-muted/80',
                    !item.read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm',
                        !item.read && 'font-semibold text-foreground'
                      )}
                    >
                      {item.subject}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatInboxDate(item.receivedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        item.type === 'approval' &&
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                        item.type === 'info_request' &&
                          'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      )}
                    >
                      {item.type === 'approval' ? (
                        <>
                          <ThumbsUp className="size-3" />
                          Approval
                        </>
                      ) : (
                        <>
                          <MessageSquare className="size-3" />
                          Info request
                        </>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.from}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.preview}
                  </p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-muted/30">
        {selected ? (
          <>
            <div className="flex flex-col gap-2 border-b border-border bg-card px-4 py-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-tight">
                  {selected.subject}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>From: {selected.from}</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {new Date(selected.receivedAt).toLocaleString()}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                    selected.type === 'approval' &&
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                    selected.type === 'info_request' &&
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  )}
                >
                  {selected.type === 'approval' ? 'Approval' : 'Info request'}
                </span>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed">
                {selected.body}
              </div>
            </ScrollArea>
            <div className="border-t border-border bg-card p-4">
              {selected.type === 'approval' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selected.id)}
                    className="gap-1.5"
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(selected.id)}
                    className="gap-1.5"
                  >
                    <ThumbsDown className="size-4" />
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your reply or provide the requested information…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSendReply(selected.id)}
                    disabled={!replyText.trim()}
                    className="gap-1.5"
                  >
                    <Send className="size-4" />
                    Send reply
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-4">
              <ChevronRight className="size-8 opacity-60" />
            </div>
            <p className="text-sm font-medium">Select a message</p>
            <p className="max-w-xs text-xs">
              Choose an item from the list to view details and respond to
              approvals or agent requests.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
