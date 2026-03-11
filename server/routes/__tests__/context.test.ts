import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createContextRouter } from '../context.js'
import { createMockSse, createMockUpload, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/context.service.js', () => ({
  getContextContent: vi.fn(),
  setContextContent: vi.fn(),
  listContextFiles: vi.fn(),
  saveContextFile: vi.fn(),
  deleteContextFile: vi.fn(),
}))

import * as contextService from '../../services/context.service.js'

describe('context routes', () => {
  beforeEach(() => {
    vi.mocked(contextService.getContextContent).mockReset()
    vi.mocked(contextService.setContextContent).mockReset()
    vi.mocked(contextService.listContextFiles).mockReset()
    vi.mocked(contextService.saveContextFile).mockReset()
    vi.mocked(contextService.deleteContextFile).mockReset()
  })

  const deps = () => ({ getPool: () => ({}), sse: createMockSse(), emit: () => {}, upload: createMockUpload() })

  describe('GET /', () => {
    it('returns context content', async () => {
      vi.mocked(contextService.getContextContent).mockResolvedValue('# Context')
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).get('/api/context').expect(200)
      expect(res.body).toEqual({ content: '# Context' })
    })
  })

  describe('PATCH /', () => {
    it('saves context content and returns 200', async () => {
      vi.mocked(contextService.setContextContent).mockResolvedValue(undefined)
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).patch('/api/context').send({ content: 'Updated' }).expect(200)
      expect(res.body).toEqual({ content: 'Updated' })
      expect(contextService.setContextContent).toHaveBeenCalledWith('Updated')
    })

    it('returns 400 when content must be a string', async () => {
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).patch('/api/context').send({ content: 123 })
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/content|string/i)
    })
  })

  describe('GET /files', () => {
    it('returns list of context files', async () => {
      const files = [{ name: 'readme.md', size: 100 }]
      vi.mocked(contextService.listContextFiles).mockResolvedValue(files)
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).get('/api/context/files').expect(200)
      expect(res.body).toEqual({ files })
    })
  })

  describe('POST /files', () => {
    it('returns 400 when no file uploaded', async () => {
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).post('/api/context/files')
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('No file uploaded')
    })

    it('saves file and returns 201 when file is present', async () => {
      vi.mocked(contextService.saveContextFile).mockResolvedValue({ name: 'f.txt', size: 10 })
      const upload = createMockUpload({ buffer: Buffer.from('hi'), originalname: 'f.txt', mimetype: 'text/plain' })
      const router = createContextRouter({ ...deps(), upload })
      const app = appWithRouter('/api/context', router)
      const res = await request(app).post('/api/context/files').expect(201)
      expect(res.body).toHaveProperty('name', 'f.txt')
      expect(contextService.saveContextFile).toHaveBeenCalledWith('f.txt', Buffer.from('hi'))
    })
  })

  describe('DELETE /files/:name', () => {
    it('deletes file and returns 204', async () => {
      vi.mocked(contextService.deleteContextFile).mockResolvedValue(true)
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      await request(app).delete('/api/context/files/readme.md').expect(204)
      expect(contextService.deleteContextFile).toHaveBeenCalledWith('readme.md')
    })

    it('returns 404 when file not found', async () => {
      vi.mocked(contextService.deleteContextFile).mockResolvedValue(false)
      const router = createContextRouter(deps())
      const app = appWithRouter('/api/context', router)
      const res = await request(app).delete('/api/context/files/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('File not found')
    })
  })
})
