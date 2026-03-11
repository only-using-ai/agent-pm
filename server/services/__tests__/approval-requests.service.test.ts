import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  createApprovalRequest,
  createInfoRequest,
  listApprovalRequests,
  listInboxItems,
  getApprovalRequest,
  resolveApprovalRequest,
} from '../approval-requests.service.js'
import type { ApprovalRequestRow } from '../types.js'

describe('approval-requests.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  const approvalRow: ApprovalRequestRow = {
    id: 'ar1',
    project_id: 'p1',
    work_item_id: 'wi1',
    agent_id: 'agent-1',
    agent_name: 'Agent',
    body: 'Please approve',
    type: 'approval',
    status: 'pending',
    created_at: '2025-01-01',
    resolved_at: null,
  }

  describe('createApprovalRequest', () => {
    it('inserts with project_id when provided', async () => {
      mockQuery.mockResolvedValue({ rows: [approvalRow] })
      const result = await createApprovalRequest(pool, {
        work_item_id: 'wi1',
        project_id: 'p1',
        agent_id: 'agent-1',
        agent_name: 'Agent',
        body: 'Approve',
      })
      expect(result).toEqual(approvalRow)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO approval_requests'),
        ['p1', 'wi1', 'agent-1', 'Agent', 'Approve']
      )
    })

    it('resolves project_id from work_items when not provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ project_id: 'p1' }] })
        .mockResolvedValueOnce({ rows: [approvalRow] })
      const result = await createApprovalRequest(pool, {
        work_item_id: 'wi1',
        agent_id: null,
        agent_name: 'Agent',
        body: 'Approve',
      })
      expect(result).toEqual(approvalRow)
    })

    it('throws when work item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await expect(
        createApprovalRequest(pool, {
          work_item_id: 'missing',
          agent_name: 'A',
          body: 'B',
        })
      ).rejects.toThrow('Work item not found')
    })
  })

  describe('createInfoRequest', () => {
    it('inserts with type info_request', async () => {
      const row = { ...approvalRow, type: 'info_request' as const }
      mockQuery.mockResolvedValue({ rows: [row] })
      await createInfoRequest(pool, {
        work_item_id: 'wi1',
        project_id: 'p1',
        agent_id: null,
        agent_name: 'Agent',
        body: 'Info',
      })
      expect(mockQuery.mock.calls[0][0]).toContain("'info_request'")
    })
  })

  describe('listApprovalRequests', () => {
    it('filters by status pending by default', async () => {
      mockQuery.mockResolvedValue({ rows: [approvalRow] })
      const result = await listApprovalRequests(pool)
      expect(result).toEqual([approvalRow])
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['pending']
      )
    })
  })

  describe('listInboxItems', () => {
    it('returns pending only by default', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await listInboxItems(pool)
      expect(mockQuery.mock.calls[0][0]).toContain("status = 'pending'")
    })
  })

  describe('getApprovalRequest', () => {
    it('returns row when found', async () => {
      mockQuery.mockResolvedValue({ rows: [approvalRow] })
      const result = await getApprovalRequest(pool, 'ar1')
      expect(result).toEqual(approvalRow)
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getApprovalRequest(pool, 'missing')
      expect(result).toBeNull()
    })
  })

  describe('resolveApprovalRequest', () => {
    it('updates status and returns row', async () => {
      const resolved = { ...approvalRow, status: 'approved' as const, resolved_at: '2025-01-02' }
      mockQuery.mockResolvedValue({ rows: [resolved] })
      const result = await resolveApprovalRequest(pool, 'ar1', 'approved')
      expect(result?.status).toBe('approved')
    })
  })
})
