import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createInboxRouter } from '../inbox.js'
import { createMockPool, createMockGetPool, createMockEmit, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/approval-requests.service.js', () => ({
  listInboxItems: vi.fn(),
  resolveApprovalRequest: vi.fn(),
}))

import * as approvalService from '../../services/approval-requests.service.js'

describe('inbox routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(approvalService.listInboxItems).mockReset()
    vi.mocked(approvalService.resolveApprovalRequest).mockReset()
    pool = createMockPool(vi.fn())
  })

  const deps = () => ({ getPool: createMockGetPool(pool), sse: { broadcastToAgent: () => {}, registerAgentStream: () => {}, registerStreamStatus: () => {} }, emit: createMockEmit(), upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() } })

  describe('GET /', () => {
    it('returns list of inbox items', async () => {
      const rows = [{ id: 'i1', type: 'approval', work_item_id: 'w1', project_id: 'p1', agent_id: 'a1', agent_name: 'Agent', body: 'Approve?', status: 'pending', created_at: '2025-01-01' }]
      vi.mocked(approvalService.listInboxItems).mockResolvedValue(rows)
      const router = createInboxRouter(deps())
      const app = appWithRouter('/api/inbox', router)
      const res = await request(app).get('/api/inbox').expect(200)
      expect(res.body).toEqual(rows)
      expect(approvalService.listInboxItems).toHaveBeenCalledWith(pool, { pendingOnly: true })
    })

    it('includes all when status=all', async () => {
      vi.mocked(approvalService.listInboxItems).mockResolvedValue([])
      const router = createInboxRouter(deps())
      const app = appWithRouter('/api/inbox', router)
      await request(app).get('/api/inbox?status=all').expect(200)
      expect(approvalService.listInboxItems).toHaveBeenCalledWith(pool, { pendingOnly: false })
    })
  })

  describe('PATCH /:id/approve', () => {
    it('approves and returns 200', async () => {
      const row = { id: 'i1', type: 'approval', work_item_id: 'w1', project_id: 'p1', agent_id: 'a1', agent_name: 'Agent', body: 'Approve?', status: 'approved', created_at: '2025-01-01' }
      vi.mocked(approvalService.resolveApprovalRequest).mockResolvedValue(row)
      const emit = vi.fn()
      const router = createInboxRouter({ ...deps(), emit })
      const app = appWithRouter('/api/inbox', router)
      const res = await request(app).patch('/api/inbox/i1/approve').expect(200)
      expect(res.body).toEqual(row)
      expect(emit).toHaveBeenCalledWith('work_item.approved', expect.objectContaining({ work_item_id: 'w1', project_id: 'p1' }))
    })

    it('returns 404 when not found or already resolved', async () => {
      vi.mocked(approvalService.resolveApprovalRequest).mockResolvedValue(null)
      const router = createInboxRouter(deps())
      const app = appWithRouter('/api/inbox', router)
      const res = await request(app).patch('/api/inbox/missing/approve')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Inbox item not found')
    })
  })

  describe('PATCH /:id/reject', () => {
    it('rejects and returns 200', async () => {
      const row = { id: 'i1', type: 'approval', work_item_id: 'w1', project_id: 'p1', agent_id: 'a1', agent_name: 'Agent', body: 'Approve?', status: 'rejected', created_at: '2025-01-01' }
      vi.mocked(approvalService.resolveApprovalRequest).mockResolvedValue(row)
      const router = createInboxRouter(deps())
      const app = appWithRouter('/api/inbox', router)
      const res = await request(app).patch('/api/inbox/i1/reject').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(approvalService.resolveApprovalRequest).mockResolvedValue(null)
      const router = createInboxRouter(deps())
      const app = appWithRouter('/api/inbox', router)
      const res = await request(app).patch('/api/inbox/missing/reject')
      expect(res.status).toBe(404)
    })
  })
})
