/**
 * Server-side event hooks. Register handlers with on(), they are invoked when
 * events are emitted (e.g. after work item creation or comment creation).
 * Handlers run asynchronously; errors are logged and do not affect the request.
 */

export type WorkItemCreatedPayload = {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  priority: string
  depends_on: string | null
  status: string
  require_approval: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type WorkItemCommentPayload = {
  comment: {
    id: string
    work_item_id: string
    author_type: string
    author_id: string | null
    body: string
    created_at: string
    mentioned_agent_ids?: string[]
  }
  work_item_id: string
  project_id: string
}

/** Emitted when a comment is saved with at least one @-mentioned agent. Queued agents process the work item and comments. */
export type WorkItemCommentedPayload = {
  comment: WorkItemCommentPayload['comment']
  work_item_id: string
  project_id: string
  /** Agent IDs that were @-mentioned in the comment. */
  mentioned_agent_ids: string[]
}

/** Payload when a work item's assigned_to changes. Same shape as updated work item row. */
export type WorkItemAssignmentChangePayload = {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  priority: string
  depends_on: string | null
  status: string
  require_approval: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

/** Payload when a user approves an approval request (inbox item). Triggers the agent to continue. */
export type WorkItemApprovedPayload = {
  work_item_id: string
  project_id: string
  agent_id: string | null
  agent_name: string
  body: string
}

/** Payload when a user cancels active work on a work item. Stops the agent stream for that item. */
export type WorkItemCancelPayload = {
  work_item_id: string
  project_id: string
}

export type HookEvent =
  | 'work_item.created'
  | 'work_item.comment'
  | 'work_item.commented'
  | 'work_item.assignment_change'
  | 'work_item.approved'
  | 'work_item.cancel'

export type HookHandler<T> = (payload: T) => void | Promise<void>

const listeners = new Map<HookEvent, Set<HookHandler<unknown>>>()

function getListeners(event: HookEvent): Set<HookHandler<unknown>> {
  let set = listeners.get(event)
  if (!set) {
    set = new Set()
    listeners.set(event, set)
  }
  return set
}

/**
 * Register a handler for an event. Handlers are called in registration order.
 * Async handlers are awaited; errors are caught and logged per handler.
 */
export function on<K extends HookEvent>(
  event: K,
  handler: K extends 'work_item.created'
    ? HookHandler<WorkItemCreatedPayload>
    : K extends 'work_item.comment'
      ? HookHandler<WorkItemCommentPayload>
      : K extends 'work_item.commented'
        ? HookHandler<WorkItemCommentedPayload>
        : K extends 'work_item.assignment_change'
          ? HookHandler<WorkItemAssignmentChangePayload>
          : K extends 'work_item.approved'
            ? HookHandler<WorkItemApprovedPayload>
            : K extends 'work_item.cancel'
              ? HookHandler<WorkItemCancelPayload>
              : never
): () => void {
  const set = getListeners(event)
  set.add(handler as HookHandler<unknown>)
  return () => set.delete(handler as HookHandler<unknown>)
}

/** Injected by hook-queue; when set, emit enqueues instead of running handlers directly. */
let enqueueFn: ((event: HookEvent, payload: unknown) => void | Promise<void>) | null = null

/**
 * Configure the queue backend. When set, emit() enqueues events for async processing.
 * Call this before any emit() (typically at server startup).
 */
export function setEnqueueFn(fn: (event: HookEvent, payload: unknown) => void | Promise<void>): void {
  enqueueFn = fn
}

/**
 * Run handlers for an event. Used by the queue processor.
 * Do not call directly; use emit() to trigger events.
 */
export async function runHandlers(event: HookEvent, payload: unknown): Promise<void> {
  const set = listeners.get(event)
  if (!set || set.size === 0) return
  await Promise.all(
    Array.from(set, async (fn) => {
      try {
        await Promise.resolve(fn(payload))
      } catch (e) {
        console.error(`[hooks] ${event} handler error:`, e)
        throw e
      }
    })
  )
}

/**
 * Emit an event. When a queue is configured, enqueues for processing.
 * Otherwise runs handlers directly (fire-and-forget).
 * HTTP response is not delayed either way.
 */
export function emit(event: HookEvent, payload: unknown): void {
  const set = listeners.get(event)
  if (!set || set.size === 0) return
  if (enqueueFn) {
    Promise.resolve(enqueueFn(event, payload)).catch((e) =>
      console.error(`[hooks] ${event} enqueue error:`, e)
    )
  } else {
    runHandlers(event, payload).catch((e) => console.error(`[hooks] ${event} emit error:`, e))
  }
}
