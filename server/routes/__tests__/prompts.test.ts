import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createPromptsRouter } from '../prompts.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/prompts.service.js', () => ({
  getPromptByKey: vi.fn(),
  listPrompts: vi.fn(),
  updatePrompt: vi.fn(),
}))

import * as promptsService from '../../services/prompts.service.js'

describe('prompts routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(promptsService.listPrompts).mockReset()
    vi.mocked(promptsService.getPromptByKey).mockReset()
    vi.mocked(promptsService.updatePrompt).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns list of prompts', async () => {
      const rows = [{ key: 'system', name: 'System', content: 'You are helpful.' }]
      vi.mocked(promptsService.listPrompts).mockResolvedValue(rows)
      const router = createPromptsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/prompts', router)
      const res = await request(app).get('/api/prompts').expect(200)
      expect(res.body).toEqual(rows)
    })
  })

  describe('GET /:key', () => {
    it('returns prompt when found', async () => {
      const row = { key: 'system', name: 'System', content: 'You are helpful.' }
      vi.mocked(promptsService.getPromptByKey).mockResolvedValue(row)
      const router = createPromptsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/prompts', router)
      const res = await request(app).get('/api/prompts/system').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(promptsService.getPromptByKey).mockResolvedValue(null)
      const router = createPromptsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/prompts', router)
      const res = await request(app).get('/api/prompts/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Prompt not found')
    })
  })

  describe('PATCH /:key', () => {
    it('updates prompt and returns 200', async () => {
      const row = { key: 'system', name: 'Updated', content: 'New content.' }
      vi.mocked(promptsService.updatePrompt).mockResolvedValue(row)
      const router = createPromptsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/prompts', router)
      const res = await request(app).patch('/api/prompts/system').send({ name: 'Updated', content: 'New content.' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(promptsService.updatePrompt).mockResolvedValue(null)
      const router = createPromptsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/prompts', router)
      const res = await request(app).patch('/api/prompts/missing').send({ content: 'x' })
      expect(res.status).toBe(404)
    })
  })
})
