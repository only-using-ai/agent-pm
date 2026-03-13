import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createProjectsRouter } from '../projects.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/projects.service.js', () => ({
  listProjects: vi.fn(),
  getProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  completeProject: vi.fn(),
}))

import * as projectsService from '../../services/projects.service.js'

describe('projects routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(projectsService.listProjects).mockReset()
    vi.mocked(projectsService.getProjectById).mockReset()
    vi.mocked(projectsService.createProject).mockReset()
    vi.mocked(projectsService.updateProject).mockReset()
    vi.mocked(projectsService.archiveProject).mockReset()
    vi.mocked(projectsService.completeProject).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns list of projects', async () => {
      const rows = [{ id: 'p1', name: 'Project A', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: null, completed_at: null }]
      vi.mocked(projectsService.listProjects).mockResolvedValue(rows)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).get('/api/projects').expect(200)
      expect(res.body).toEqual(rows)
      expect(projectsService.listProjects).toHaveBeenCalledWith(pool, { includeArchived: false, completedOnly: false })
    })

    it('includes archived when archived=1', async () => {
      vi.mocked(projectsService.listProjects).mockResolvedValue([])
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      await request(app).get('/api/projects?archived=1').expect(200)
      expect(projectsService.listProjects).toHaveBeenCalledWith(pool, { includeArchived: true, completedOnly: false })
    })

    it('returns only completed when completed=1', async () => {
      vi.mocked(projectsService.listProjects).mockResolvedValue([])
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      await request(app).get('/api/projects?completed=1').expect(200)
      expect(projectsService.listProjects).toHaveBeenCalledWith(pool, { includeArchived: false, completedOnly: true })
    })
  })

  describe('GET /:id', () => {
    it('returns project when found', async () => {
      const row = { id: 'p1', name: 'P', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: null, completed_at: null }
      vi.mocked(projectsService.getProjectById).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).get('/api/projects/p1').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue(null)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).get('/api/projects/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Project not found')
    })

    it('always includes color and icon in response (defaults to null if missing)', async () => {
      const rowWithoutColorIcon = { id: 'p1', name: 'P', priority: null, description: null, path: null, project_context: null, created_at: '2025-01-01', archived_at: null }
      vi.mocked(projectsService.getProjectById).mockResolvedValue(rowWithoutColorIcon as never)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).get('/api/projects/p1').expect(200)
      expect(res.body).toHaveProperty('color', null)
      expect(res.body).toHaveProperty('icon', null)
    })
  })

  describe('POST /', () => {
    it('creates project and returns 201', async () => {
      const row = { id: 'p1', name: 'New', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: null, completed_at: null }
      vi.mocked(projectsService.createProject).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).post('/api/projects').send({ name: 'New' }).expect(201)
      expect(res.body).toEqual(row)
    })

    it('returns 400 when name is required', async () => {
      vi.mocked(projectsService.createProject).mockRejectedValue(new Error('name is required'))
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).post('/api/projects').send({})
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /:id', () => {
    it('updates project and returns 200', async () => {
      const row = { id: 'p1', name: 'Updated', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: null, completed_at: null }
      vi.mocked(projectsService.updateProject).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/p1').send({ name: 'Updated' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('passes color and icon to updateProject when provided', async () => {
      const row = { id: 'p1', name: 'P', priority: null, description: null, path: null, project_context: null, color: '#22c55e', icon: null, created_at: '2025-01-01', archived_at: null }
      vi.mocked(projectsService.updateProject).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/p1').send({ color: '#22c55e', icon: null }).expect(200)
      expect(projectsService.updateProject).toHaveBeenCalledWith(pool, 'p1', { color: '#22c55e', icon: null })
      expect(res.body).toHaveProperty('color', '#22c55e')
      expect(res.body).toHaveProperty('icon', null)
    })

    it('returns 404 when project not found', async () => {
      vi.mocked(projectsService.updateProject).mockResolvedValue(null)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/missing').send({ name: 'X' })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /:id/archive', () => {
    it('archives project and returns 200', async () => {
      const row = { id: 'p1', name: 'P', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: '2025-01-02', completed_at: null }
      vi.mocked(projectsService.archiveProject).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/p1/archive').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when project not found or already archived', async () => {
      vi.mocked(projectsService.archiveProject).mockResolvedValue(null)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/missing/archive')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Project not found')
    })
  })

  describe('PATCH /:id/complete', () => {
    it('completes project and returns 200', async () => {
      const row = { id: 'p1', name: 'P', priority: null, description: null, path: null, project_context: null, color: null, icon: null, created_at: '2025-01-01', archived_at: null, completed_at: '2025-01-02' }
      vi.mocked(projectsService.completeProject).mockResolvedValue(row)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/p1/complete').expect(200)
      expect(res.body).toEqual(row)
      expect(projectsService.completeProject).toHaveBeenCalledWith(pool, 'p1')
    })

    it('returns 404 when project not found, already completed, or archived', async () => {
      vi.mocked(projectsService.completeProject).mockResolvedValue(null)
      const router = createProjectsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects', router)
      const res = await request(app).patch('/api/projects/missing/complete')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Project not found')
    })
  })
})
