/**
 * SSE broadcaster: manages agent stream connections and global stream status.
 * Tracks active streams (stream_start → stream_end) so new clients can receive
 * a snapshot after refresh and still show working indicators.
 * Single responsibility; stateful so we export a factory that returns the broadcaster API.
 * Testable by passing mock Response-like objects.
 */

import type { Response } from 'express'

export type ActiveStreamEntry = { agentId: string; work_item_id: string }

export type SseBroadcaster = {
  /** Broadcast an event to all clients subscribed to this agent's stream. */
  broadcastToAgent(agentId: string, event: string, data: unknown): void
  /** Register a response for an agent's stream; unregisters on close/error. */
  registerAgentStream(agentId: string, res: Response): void
  /** Register a response for global stream status (stream_start / stream_end). */
  registerStreamStatus(res: Response): void
}

function writeStreamStatusEvent(
  res: Response,
  event: string,
  data: unknown
): void {
  const payload = JSON.stringify({ event, data })
  const sse = `data: ${payload}\n\n`
  try {
    res.write(sse)
    ;(res as { flush?: () => void }).flush?.()
  } catch (err) {
    console.error('[SSE] status write error:', err)
  }
}

export function createSseBroadcaster(): SseBroadcaster {
  const agentStreamConnections = new Map<string, Set<Response>>()
  const streamStatusConnections = new Set<Response>()
  /** Active streams: agentId -> work_item_id. Updated on stream_start / stream_end so new clients get correct indicators after refresh. */
  const activeStreams = new Map<string, string>()

  function broadcastToAgent(agentId: string, event: string, data: unknown): void {
    if (event === 'stream_start') {
      const workItemId =
        data && typeof data === 'object' && 'work_item_id' in data && typeof (data as { work_item_id?: unknown }).work_item_id === 'string'
          ? (data as { work_item_id: string }).work_item_id
          : ''
      if (workItemId) activeStreams.set(agentId, workItemId)
    } else if (event === 'stream_end' || event === 'stream_error') {
      activeStreams.delete(agentId)
    }

    const payload = JSON.stringify({ event, data })
    const sse = `data: ${payload}\n\n`
    const connections = agentStreamConnections.get(agentId)
    if (connections) {
      for (const res of connections) {
        try {
          res.write(sse)
          // Flush so thinking and content chunks are streamed to the client immediately
          ;(res as { flush?: () => void }).flush?.()
        } catch (e) {
          console.error('[SSE] write error:', e)
        }
      }
    }
    if (
      event === 'stream_start' ||
      event === 'stream_end' ||
      event === 'stream_error' ||
      event === 'work_item_updated'
    ) {
      const statusPayload = JSON.stringify({
        event,
        data: { ...(data as object), agentId },
      })
      const statusSse = `data: ${statusPayload}\n\n`
      for (const res of streamStatusConnections) {
        try {
          res.write(statusSse)
          ;(res as { flush?: () => void }).flush?.()
        } catch (err) {
          console.error('[SSE] status write error:', err)
        }
      }
    }
  }

  function registerAgentStream(agentId: string, res: Response): void {
    res.socket?.setNoDelay(true)
    let set = agentStreamConnections.get(agentId)
    if (!set) {
      set = new Set()
      agentStreamConnections.set(agentId, set)
    }
    set.add(res)
    const onClose = () => {
      set?.delete(res)
      if (set?.size === 0) agentStreamConnections.delete(agentId)
    }
    res.on('close', onClose)
    res.on('error', onClose)
  }

  function registerStreamStatus(res: Response): void {
    res.socket?.setNoDelay(true)
    streamStatusConnections.add(res)
    const snapshot: ActiveStreamEntry[] = Array.from(activeStreams.entries()).map(
      ([agentId, work_item_id]) => ({ agentId, work_item_id })
    )
    writeStreamStatusEvent(res, 'active_streams_snapshot', { active_streams: snapshot })
    res.on('close', () => streamStatusConnections.delete(res))
    res.on('error', () => streamStatusConnections.delete(res))
  }

  return {
    broadcastToAgent,
    registerAgentStream,
    registerStreamStatus,
  }
}
