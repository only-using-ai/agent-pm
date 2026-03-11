import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSseBroadcaster } from '../sse.service.js'

describe('sse.service', () => {
  let broadcaster: ReturnType<typeof createSseBroadcaster>
  let mockRes: { write: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; socket: { setNoDelay: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    broadcaster = createSseBroadcaster()
    mockRes = {
      write: vi.fn(),
      on: vi.fn(),
      socket: { setNoDelay: vi.fn() },
    }
  })

  describe('broadcastToAgent', () => {
    it('writes SSE payload to registered agent connections', () => {
      broadcaster.registerAgentStream('agent-1', mockRes as any)
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'hello', type: 'content' })
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('data: ')
      )
      expect(mockRes.write.mock.calls[0][0]).toContain('stream_chunk')
      expect(mockRes.write.mock.calls[0][0]).toContain('hello')
    })

    it('does nothing when no connections for agent', () => {
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'hi' })
      expect(mockRes.write).not.toHaveBeenCalled()
    })

    it('for stream_start/stream_end/stream_error/work_item_updated also writes to stream status connections', () => {
      broadcaster.registerStreamStatus(mockRes as any)
      broadcaster.broadcastToAgent('agent-1', 'stream_start', { work_item_id: 'wi-1' })
      expect(mockRes.write).toHaveBeenCalled()
      const payload = mockRes.write.mock.calls[0][0]
      expect(payload).toContain('stream_start')
      expect(payload).toContain('agentId')
    })
  })

  describe('registerAgentStream', () => {
    it('unregisters on close', () => {
      broadcaster.registerAgentStream('agent-1', mockRes as any)
      const onClose = mockRes.on.mock.calls.find((c: string[]) => c[0] === 'close')?.[1]
      expect(onClose).toBeDefined()
      onClose!()
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'x' })
      expect(mockRes.write).not.toHaveBeenCalled()
    })

    it('unregisters on error', () => {
      broadcaster.registerAgentStream('agent-1', mockRes as any)
      const onError = mockRes.on.mock.calls.find((c: string[]) => c[0] === 'error')?.[1]
      onError!()
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'x' })
      expect(mockRes.write).not.toHaveBeenCalled()
    })
  })

  describe('registerStreamStatus', () => {
    it('unregisters on close', () => {
      broadcaster.registerStreamStatus(mockRes as any)
      const onClose = mockRes.on.mock.calls.find((c: string[]) => c[0] === 'close')?.[1]
      onClose!()
      broadcaster.broadcastToAgent('a', 'stream_end', {})
      expect(mockRes.write).not.toHaveBeenCalled()
    })
  })

  describe('flush', () => {
    it('calls flush when present on response', () => {
      const flush = vi.fn()
      ;(mockRes as any).flush = flush
      broadcaster.registerAgentStream('agent-1', mockRes as any)
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'x' })
      expect(flush).toHaveBeenCalled()
    })
  })

  describe('write error handling', () => {
    it('catches write error and logs', () => {
      mockRes.write.mockImplementationOnce(() => {
        throw new Error('write failed')
      })
      broadcaster.registerAgentStream('agent-1', mockRes as any)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      broadcaster.broadcastToAgent('agent-1', 'stream_chunk', { chunk: 'x' })
      expect(consoleSpy).toHaveBeenCalledWith('[SSE] write error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })
})
