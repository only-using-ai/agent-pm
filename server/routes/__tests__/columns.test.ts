import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createColumnsRouter } from '../columns.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/project-columns.service.js', () => ({
  listColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
}))

import * as columnsService from '../../services/project-columns.service.js'

describe('columns routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(columnsService.listColumns).mockReset()
    vi.mocked(columnsService.createColumn).mockReset()
    vi.mocked(columnsService.updateColumn).mockReset()
    vi.mocked(columnsService.deleteColumn).mockReset()
    pool = createMockPool(vi.fn())
  })

  const basePath = '/api/projects/p1/columns'

  describe('GET /', () => {
    it('returns list of columns', async () => {
      const rows = [{ project_id: 'p1', id: 'c1', title: 'Todo', color: '#fff', position: 0 }]
      vi.mocked(columnsService.listColumns).mockResolvedValue(rows)
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).get(basePath).expect(200)
      expect(res.body).toEqual(rows)
      expect(columnsService.listColumns).toHaveBeenCalledWith(pool, 'p1')
    })
  })

  describe('POST /', () => {
    it('creates column and returns 201', async () => {
      const row = { project_id: 'p1', id: 'c1', title: 'Done', color: '#eee', position: 1 }
      vi.mocked(columnsService.createColumn).mockResolvedValue(row)
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).post(basePath).send({ title: 'Done', color: '#eee' }).expect(201)
      expect(res.body).toEqual(row)
      expect(columnsService.createColumn).toHaveBeenCalledWith(pool, 'p1', { title: 'Done', color: '#eee' })
    })

    it('returns 400 when title is required', async () => {
      vi.mocked(columnsService.createColumn).mockRejectedValue(new Error('title is required'))
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).post(basePath).send({})
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /:columnId', () => {
    it('updates column and returns 200', async () => {
      const row = { project_id: 'p1', id: 'c1', title: 'Updated', color: '#ccc', position: 0 }
      vi.mocked(columnsService.updateColumn).mockResolvedValue(row)
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).patch(`${basePath}/c1`).send({ title: 'Updated' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when column not found', async () => {
      vi.mocked(columnsService.updateColumn).mockResolvedValue(null)
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).patch(`${basePath}/missing`).send({ title: 'X' })
      expect(res.status).toBe(404)
    })

    it('returns 400 when title cannot be empty', async () => {
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).patch(`${basePath}/c1`).send({ title: '' })
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? '')).toMatch(/title|empty/i)
      expect(columnsService.updateColumn).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /:columnId', () => {
    it('deletes column and returns 204', async () => {
      vi.mocked(columnsService.deleteColumn).mockResolvedValue(undefined)
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      await request(app).delete(`${basePath}/c1`).expect(204)
      expect(columnsService.deleteColumn).toHaveBeenCalledWith(pool, 'p1', 'c1')
    })

    it('returns 404 when column not found', async () => {
      vi.mocked(columnsService.deleteColumn).mockRejectedValue(new Error('Column not found'))
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).delete(`${basePath}/missing`)
      expect(res.status).toBe(404)
    })

    it('returns 400 when cannot delete the only column', async () => {
      vi.mocked(columnsService.deleteColumn).mockRejectedValue(new Error('Cannot delete the only column'))
      const router = createColumnsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/columns', router)
      const res = await request(app).delete(`${basePath}/c1`)
      expect(res.status).toBe(400)
    })
  })
})
