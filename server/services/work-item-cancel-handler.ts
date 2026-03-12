/**
 * Handler for work_item.cancel hook: when a user cancels active work on a work item,
 * the route has already called setCancelRequested so the agent stream will stop on
 * the next chunk. This handler updates the work item status to 'canceled' and
 * broadcasts the change to SSE clients so the UI reflects the new status.
 */

import type { Pool } from 'pg'
import type { WorkItemCancelPayload } from '../hooks.js'
import type { SseBroadcaster } from './sse.service.js'

export type WorkItemCancelHandlerDeps = {
  getPool: () => Pool
  updateWorkItem: (
    pool: Pool,
    projectId: string,
    workItemId: string,
    input: { status: string }
  ) => Promise<unknown>
  broadcaster: SseBroadcaster
}

/**
 * Returns a hook handler for 'work_item.cancel' that sets the work item status to
 * 'canceled' and emits the update to stream-status clients so the user sees the change.
 */
export function createWorkItemCancelHandler(
  deps: WorkItemCancelHandlerDeps
): (payload: WorkItemCancelPayload) => Promise<void> {
  const { getPool, updateWorkItem, broadcaster } = deps

  return async (payload: WorkItemCancelPayload) => {
    const pool = getPool()
    const { work_item_id, project_id } = payload
    await updateWorkItem(pool, project_id, work_item_id, { status: 'canceled' })
    broadcaster.broadcastToAgent('system', 'work_item_updated', {
      work_item_id,
      project_id,
      status: 'canceled',
    })
  }
}
