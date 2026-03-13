/**
 * Persistent hook queue. When hook events are emitted, they are enqueued here.
 * A processor loop runs continuously, pulling pending items and invoking handlers.
 * Survives restarts: on startup, any stuck 'processing' items are reset to 'pending'
 * and the queue is processed.
 */

import type { Pool } from 'pg'
import type { HookEvent } from './hooks.js'

export type HookQueueItem = {
  id: string
  event: string
  payload: unknown
  status: string
  created_at: string
  retry_count: number
}

const POLL_INTERVAL_MS = 500
const MAX_RETRIES = 3

/**
 * Enqueue a hook event for processing. Non-blocking.
 */
export async function enqueue(pool: Pool, event: HookEvent, payload: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO hook_queue (event, payload) VALUES ($1, $2)`,
    [event, JSON.stringify(payload)]
  )
}

/**
 * Reset any items stuck in 'processing' (e.g. from a crash) back to 'pending'.
 */
export async function reclaimStuckItems(pool: Pool): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE hook_queue SET status = 'pending' WHERE status = 'processing'`
  )
  return rowCount ?? 0
}

/**
 * Claim the next pending item. Returns null if queue is empty.
 */
async function claimNext(
  pool: Pool
): Promise<{ id: string; event: string; payload: unknown; retry_count: number } | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<HookQueueItem>(
      `SELECT id, event, payload, retry_count FROM hook_queue
       WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
    )
    if (rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }
    const row = rows[0]
    await client.query(`UPDATE hook_queue SET status = 'processing' WHERE id = $1`, [row.id])
    await client.query('COMMIT')
    return {
      id: row.id,
      event: row.event,
      payload: row.payload as unknown,
      retry_count: row.retry_count,
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/**
 * Mark an item as completed.
 */
async function markCompleted(pool: Pool, id: string): Promise<void> {
  await pool.query(
    `UPDATE hook_queue SET status = 'completed', processed_at = now() WHERE id = $1`,
    [id]
  )
}

/**
 * Cancel pending hook queue items for a work item (e.g. after archive).
 * Marks them as completed so they are not processed.
 */
export async function cancelPendingItemsForWorkItem(
  pool: Pool,
  projectId: string,
  workItemId: string
): Promise<number> {
  const result = await pool.query(
    `UPDATE hook_queue SET status = 'completed', processed_at = now()
     WHERE status = 'pending' AND (
       (event = 'work_item.created' AND (payload->>'id') = $1 AND (payload->>'project_id') = $2) OR
       (event = 'work_item.commented' AND (payload->>'work_item_id') = $1 AND (payload->>'project_id') = $2) OR
       (event = 'work_item.assignment_change' AND (payload->>'id') = $1 AND (payload->>'project_id') = $2) OR
       (event = 'work_item.approved' AND (payload->>'work_item_id') = $1 AND (payload->>'project_id') = $2)
     )`,
    [workItemId, projectId]
  )
  return (result as { rowCount?: number })?.rowCount ?? 0
}

/**
 * Cancel pending hook queue items for an agent (e.g. "empty queue" from agent page).
 * Marks them as completed so they are not processed.
 */
export async function cancelPendingItemsForAgent(pool: Pool, agentId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE hook_queue SET status = 'completed', processed_at = now()
     WHERE status = 'pending' AND (
       (event = 'work_item.created' AND (payload->>'assigned_to') = $1) OR
       (event = 'work_item.commented' AND (payload->'mentioned_agent_ids') @> to_jsonb($1::text)) OR
       (event = 'work_item.assignment_change' AND (payload->>'assigned_to') = $1) OR
       (event = 'work_item.approved' AND (payload->>'agent_id') = $1)
     )`,
    [agentId]
  )
  return (result as { rowCount?: number })?.rowCount ?? 0
}

/**
 * Mark an item as failed. If retry_count < MAX_RETRIES, set back to pending.
 */
async function markFailed(
  pool: Pool,
  id: string,
  errorMessage: string,
  retryCount: number
): Promise<void> {
  if (retryCount < MAX_RETRIES) {
    await pool.query(
      `UPDATE hook_queue SET status = 'pending', retry_count = $1, error_message = $2 WHERE id = $3`,
      [retryCount + 1, errorMessage, id]
    )
  } else {
    await pool.query(
      `UPDATE hook_queue SET status = 'failed', processed_at = now(), error_message = $1 WHERE id = $2`,
      [errorMessage, id]
    )
  }
}

export type RunHandlersFn = (event: HookEvent, payload: unknown) => Promise<void>

/**
 * Start the queue processor. Runs until process exit.
 * runHandlers is called for each dequeued item (from hooks.ts).
 */
export function startProcessor(
  getPool: () => Pool,
  runHandlers: RunHandlersFn
): { stop: () => void } {
  let stopped = false

  const processOne = async (): Promise<{ hadWork: boolean }> => {
    if (stopped) return { hadWork: false }
    const pool = getPool()
    const item = await claimNext(pool)
    if (!item) return { hadWork: false }
    try {
      await runHandlers(item.event as HookEvent, item.payload)
      await markCompleted(pool, item.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[hook-queue] ${item.event} handler error:`, e)
      await markFailed(pool, item.id, msg, item.retry_count)
    }
    return { hadWork: true }
  }

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const { hadWork } = await processOne()
        if (stopped) break
        if (!hadWork) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        }
      } catch (e) {
        console.error('[hook-queue] processor error:', e)
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
    }
  }

  const run = async (): Promise<void> => {
    const pool = getPool()
    const reclaimed = await reclaimStuckItems(pool)
    if (reclaimed > 0) {
      console.log(`[hook-queue] Reclaimed ${reclaimed} stuck item(s) from previous run`)
    }
    console.log('[hook-queue] Processor started')
    await loop()
  }

  run().catch((e) => {
    console.error('[hook-queue] Fatal:', e)
    process.exit(1)
  })

  return {
    stop: () => {
      stopped = true
    },
  }
}
