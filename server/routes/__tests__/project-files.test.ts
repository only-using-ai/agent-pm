import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createProjectFilesRouter } from '../project-files.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/projects.service.js', () => ({
  getProjectById: vi.fn(),
}))

vi.mock('../../services/project-files.service.js', () => ({
  listDirectoryTree: vi.fn(),
  readProjectFileContent: vi.fn(),
  writeProjectFileContent: vi.fn(),
  deleteProjectFile: vi.fn(),
}))

import * as projectsService from '../../services/projects.service.js'
import * as projectFilesService from '../../services/project-files.service.js'

describe('project-files routes', () => {
  let pool: Pool
  const basePath = '/api/projects/p1/files'

  beforeEach(() => {
    vi.mocked(projectsService.getProjectById).mockReset()
    vi.mocked(projectFilesService.listDirectoryTree).mockReset()
    vi.mocked(projectFilesService.readProjectFileContent).mockReset()
    vi.mocked(projectFilesService.writeProjectFileContent).mockReset()
    vi.mocked(projectFilesService.deleteProjectFile).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns 404 when project not found', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue(null)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).get(basePath)
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Project not found')
    })

    it('returns empty tree when project has no path', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', name: 'P', path: null } as never)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).get(basePath).expect(200)
      expect(res.body).toEqual({ tree: [] })
    })

    it('returns directory tree when project has path', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', name: 'P', path: '/tmp/proj' } as never)
      vi.mocked(projectFilesService.listDirectoryTree).mockResolvedValue([{ name: 'src', children: [] }])
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).get(basePath).expect(200)
      expect(res.body).toEqual({ tree: [{ name: 'src', children: [] }] })
    })
  })

  describe('GET /content', () => {
    it('returns 400 when missing path query', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).get(`${basePath}/content`)
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/path|required/i)
    })

    it('returns file content when path provided', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      vi.mocked(projectFilesService.readProjectFileContent).mockResolvedValue('file content')
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).get(`${basePath}/content?path=src/index.ts`).expect(200)
      expect(res.body).toEqual({ content: 'file content' })
    })
  })

  describe('PUT /content', () => {
    it('returns 400 when content must be a string', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).put(`${basePath}/content?path=x`).send({ content: 123 })
      expect(res.status).toBe(400)
    })

    it('writes file content and returns 200', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      vi.mocked(projectFilesService.writeProjectFileContent).mockResolvedValue(undefined)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).put(`${basePath}/content?path=src/x.ts`).send({ content: 'hello' }).expect(200)
      expect(res.body).toEqual({ content: 'hello' })
    })
  })

  describe('DELETE /', () => {
    it('returns 400 when missing path query', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      const res = await request(app).delete(basePath)
      expect(res.status).toBe(400)
    })

    it('deletes file and returns 204', async () => {
      vi.mocked(projectsService.getProjectById).mockResolvedValue({ id: 'p1', path: '/tmp' } as never)
      vi.mocked(projectFilesService.deleteProjectFile).mockResolvedValue(undefined)
      const router = createProjectFilesRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/files', router)
      await request(app).delete(`${basePath}?path=src/x.ts`).expect(204)
    })
  })
})
