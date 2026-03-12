import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkItemCancelHandler } from '../work-item-cancel-handler.js'

describe('work-item-cancel-handler', () => {
  const mockPayload = { work_item_id: 'wi1', project_id: 'p1' }

  let mockGetPool: () => { query: ReturnType<typeof vi.fn> }
  let mockUpdateWorkItem: ReturnType<typeof vi.fn>
  let mockBroadcaster: { broadcastToAgent: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockGetPool = vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }))
    mockUpdateWorkItem = vi.fn().mockResolvedValue(undefined)
    mockBroadcaster = { broadcastToAgent: vi.fn() }
  })

  it('updates work item status to canceled and broadcasts', async () => {
    const handler = createWorkItemCancelHandler({
      getPool: mockGetPool,
      updateWorkItem: mockUpdateWorkItem,
      broadcaster: mockBroadcaster,
    })
    await handler(mockPayload)
    expect(mockUpdateWorkItem).toHaveBeenCalledWith(
      expect.anything(),
      'p1',
      'wi1',
      { status: 'canceled' }
    )
    expect(mockBroadcaster.broadcastToAgent).toHaveBeenCalledWith(
      'system',
      'work_item_updated',
      { work_item_id: 'wi1', project_id: 'p1', status: 'canceled' }
    )
  })
})
