import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createWorkItemsRouter, createProjectWorkItemsRouter } from '../work-items.js'
import { createMockPool, createMockGetPool, createMockEmit, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/work-items.service.js', () => ({
  listAllWorkItems: vi.fn(),
  listWorkItemsByProjectWithKanbanMeta: vi.fn(),
  getWorkItem: vi.fn(),
  createWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
  archiveWorkItem: vi.fn(),
  addWorkItemComment: vi.fn(),
}))

vi.mock('../../services/approval-requests.service.js', () => ({
  createApprovalRequest: vi.fn(),
}))

import * as workItemsService from '../../services/work-items.service.js'
import * as approvalService from '../../services/approval-requests.service.js'

describe('work-items routes (GET /api/work-items)', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(workItemsService.listAllWorkItems).mockReset()
    pool = createMockPool(vi.fn())
  })

  it('returns list of all work items', async () => {
    const rows = [{ id: 'w1', project_id: 'p1', title: 'Task', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01' }]
    vi.mocked(workItemsService.listAllWorkItems).mockResolvedValue(rows)
    const deps = { getPool: createMockGetPool(pool), sse: { broadcastToAgent: () => {}, registerAgentStream: () => {}, registerStreamStatus: () => {} }, emit: createMockEmit(), setCancelRequested: vi.fn(), upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() } }
    const router = createWorkItemsRouter(deps)
    const app = appWithRouter('/api/work-items', router)
    const res = await request(app).get('/api/work-items').expect(200)
    expect(res.body).toEqual(rows)
    expect(workItemsService.listAllWorkItems).toHaveBeenCalledWith(pool, { includeArchived: false })
  })

  it('includes archived when archived=1', async () => {
    vi.mocked(workItemsService.listAllWorkItems).mockResolvedValue([])
    const deps = { getPool: createMockGetPool(pool), sse: { broadcastToAgent: () => {}, registerAgentStream: () => {}, registerStreamStatus: () => {} }, emit: createMockEmit(), setCancelRequested: vi.fn(), upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() } }
    const router = createWorkItemsRouter(deps)
    const app = appWithRouter('/api/work-items', router)
    await request(app).get('/api/work-items?archived=1').expect(200)
    expect(workItemsService.listAllWorkItems).toHaveBeenCalledWith(pool, { includeArchived: true })
  })
})

describe('project work-items routes', () => {
  let pool: Pool
  const deps = () => ({ getPool: createMockGetPool(pool), sse: { broadcastToAgent: () => {}, registerAgentStream: () => {}, registerStreamStatus: () => {} }, emit: createMockEmit(), setCancelRequested: vi.fn(), upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() } })
  const basePath = '/api/projects/p1/work-items'

  beforeEach(() => {
    vi.mocked(workItemsService.listWorkItemsByProjectWithKanbanMeta).mockReset()
    vi.mocked(workItemsService.getWorkItem).mockReset()
    vi.mocked(workItemsService.createWorkItem).mockReset()
    vi.mocked(workItemsService.updateWorkItem).mockReset()
    vi.mocked(workItemsService.archiveWorkItem).mockReset()
    vi.mocked(workItemsService.addWorkItemComment).mockReset()
    vi.mocked(approvalService.createApprovalRequest).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns list of work items for project with kanban meta', async () => {
      const rows = [{ id: 'w1', project_id: 'p1', title: 'Task', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01', agent_name: 'Dev Agent', last_completion_duration_seconds: 120 }]
      vi.mocked(workItemsService.listWorkItemsByProjectWithKanbanMeta).mockResolvedValue(rows)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).get(basePath).expect(200)
      expect(res.body).toEqual(rows)
      expect(workItemsService.listWorkItemsByProjectWithKanbanMeta).toHaveBeenCalledWith(pool, 'p1', { includeArchived: false })
    })
  })

  describe('GET /:id', () => {
    it('returns work item when found', async () => {
      const row = { id: 'w1', project_id: 'p1', title: 'Task', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01' }
      vi.mocked(workItemsService.getWorkItem).mockResolvedValue(row)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).get(`${basePath}/w1`).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(workItemsService.getWorkItem).mockResolvedValue(null)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).get(`${basePath}/missing`)
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Work item not found')
    })
  })

  describe('POST /', () => {
    it('creates work item and returns 201', async () => {
      const row = { id: 'w1', project_id: 'p1', title: 'New', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01' }
      vi.mocked(workItemsService.createWorkItem).mockResolvedValue(row)
      const emit = vi.fn()
      const router = createProjectWorkItemsRouter({ ...deps(), emit })
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).post(basePath).send({ title: 'New' }).expect(201)
      expect(res.body).toEqual(row)
      expect(emit).toHaveBeenCalledWith('work_item.created', row)
    })

    it('returns 400 when title is required', async () => {
      vi.mocked(workItemsService.createWorkItem).mockRejectedValue(new Error('title is required'))
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).post(basePath).send({})
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /:id', () => {
    it('updates work item and returns 200', async () => {
      const row = { id: 'w1', project_id: 'p1', title: 'Updated', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'done', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01' }
      vi.mocked(workItemsService.updateWorkItem).mockResolvedValue(row)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).patch(`${basePath}/w1`).send({ status: 'done' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 400 when no fields to update', async () => {
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).patch(`${basePath}/w1`).send({})
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('No fields to update')
    })

    it('returns 404 when work item not found', async () => {
      vi.mocked(workItemsService.updateWorkItem).mockResolvedValue(null)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).patch(`${basePath}/missing`).send({ title: 'X' })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /:id/archive', () => {
    it('archives work item and returns 200', async () => {
      const row = { id: 'w1', project_id: 'p1', title: 'Task', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: '2025-01-02', created_at: '2025-01-01', updated_at: '2025-01-01' }
      vi.mocked(workItemsService.archiveWorkItem).mockResolvedValue(row)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).patch(`${basePath}/w1/archive`).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(workItemsService.archiveWorkItem).mockResolvedValue(null)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).patch(`${basePath}/missing/archive`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:id/cancel', () => {
    it('cancels work item and returns 204', async () => {
      const row = { id: 'w1', project_id: 'p1', title: 'Task', description: null, assigned_to: null, priority: 'medium', depends_on: null, status: 'todo', require_approval: false, work_item_type: 'Task', archived_at: null, created_at: '2025-01-01', updated_at: '2025-01-01' }
      vi.mocked(workItemsService.getWorkItem).mockResolvedValue(row)
      const setCancelRequested = vi.fn()
      const emit = vi.fn()
      const router = createProjectWorkItemsRouter({ ...deps(), setCancelRequested, emit })
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      await request(app).post(`${basePath}/w1/cancel`).expect(204)
      expect(setCancelRequested).toHaveBeenCalledWith('w1')
      expect(emit).toHaveBeenCalledWith('work_item.cancel', { work_item_id: 'w1', project_id: 'p1' })
    })

    it('returns 404 when work item not found', async () => {
      vi.mocked(workItemsService.getWorkItem).mockResolvedValue(null)
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      await request(app).post(`${basePath}/missing/cancel`).expect(404)
    })
  })

  describe('POST /:id/comments', () => {
    it('adds comment and returns 201', async () => {
      const comment = { id: 'c1', work_item_id: 'w1', author_type: 'user', author_id: null, body: 'Hello', created_at: '2025-01-01', mentioned_agent_ids: [] }
      vi.mocked(workItemsService.addWorkItemComment).mockResolvedValue(comment)
      const emit = vi.fn()
      const router = createProjectWorkItemsRouter({ ...deps(), emit })
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).post(`${basePath}/w1/comments`).send({ body: 'Hello' }).expect(201)
      expect(res.body).toEqual(comment)
    })

    it('returns 400 when body is required', async () => {
      vi.mocked(workItemsService.addWorkItemComment).mockRejectedValue(new Error('body is required'))
      const router = createProjectWorkItemsRouter(deps())
      const app = appWithRouter('/api/projects/:projectId/work-items', router)
      const res = await request(app).post(`${basePath}/w1/comments`).send({})
      expect(res.status).toBe(400)
    })
  })
})
