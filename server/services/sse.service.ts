/**
 * SSE broadcaster: manages agent stream connections and global stream status.
 * Single responsibility; stateful so we export a factory that returns the broadcaster API.
 * Testable by passing mock Response-like objects.
 */

import type { Response } from 'express'

export type SseBroadcaster = {
  /** Broadcast an event to all clients subscribed to this agent's stream. */
  broadcastToAgent(agentId: string, event: string, data: unknown): void
  /** Register a response for an agent's stream; unregisters on close/error. */
  registerAgentStream(agentId: string, res: Response): void
  /** Register a response for global stream status (stream_start / stream_end). */
  registerStreamStatus(res: Response): void
}

export function createSseBroadcaster(): SseBroadcaster {
  const agentStreamConnections = new Map<string, Set<Response>>()
  const streamStatusConnections = new Set<Response>()

  function broadcastToAgent(agentId: string, event: string, data: unknown): void {
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
    res.on('close', () => streamStatusConnections.delete(res))
    res.on('error', () => streamStatusConnections.delete(res))
  }

  return {
    broadcastToAgent,
    registerAgentStream,
    registerStreamStatus,
  }
}
