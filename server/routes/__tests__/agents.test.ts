import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createAgentsRouter, createAiModelsRouter } from '../agents.js'
import {
  createMockPool,
  createMockGetPool,
  createMockSse,
  appWithRouter,
  responseBody,
} from './helpers.js'

vi.mock('../../services/agents.service.js', () => ({
  listAgents: vi.fn(),
  getAgentById: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  archiveAgent: vi.fn(),
}))

vi.mock('../../services/ollama.service.js', () => ({
  fetchOllamaModels: vi.fn(),
}))

vi.mock('../../services/cursor.service.js', () => ({
  fetchCursorModels: vi.fn(),
}))

vi.mock('../../services/anthropic.service.js', () => ({
  fetchAnthropicModels: vi.fn(),
}))

import * as agentsService from '../../services/agents.service.js'
import * as ollamaService from '../../services/ollama.service.js'
import * as cursorService from '../../services/cursor.service.js'
import * as anthropicService from '../../services/anthropic.service.js'

describe('agents routes', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    vi.mocked(agentsService.listAgents).mockReset()
    vi.mocked(agentsService.getAgentById).mockReset()
    vi.mocked(agentsService.createAgent).mockReset()
    vi.mocked(agentsService.updateAgent).mockReset()
    vi.mocked(agentsService.archiveAgent).mockReset()
    mockQuery = vi.fn()
    pool = createMockPool(mockQuery)
  })

  describe('GET /stream-status', () => {
    it('returns 200 and registers stream status', (done) => {
      const registerStreamStatus = vi.fn()
      const sse = createMockSse()
      sse.registerStreamStatus = registerStreamStatus
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse,
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      request(app)
        .get('/api/agents/stream-status')
        .timeout(200)
        .end((err, res) => {
          try {
            expect(err).toBeFalsy()
            expect(res?.status).toBe(200)
            expect(res?.headers['content-type']).toMatch(/text\/event-stream/)
            expect(registerStreamStatus).toHaveBeenCalledTimes(1)
            done()
          } catch (e) {
            done(e instanceof Error ? e : new Error(String(e)))
          }
        })
    })
  })

  describe('GET /', () => {
    it('returns list of agents', async () => {
      const rows = [
        {
          id: 'a1',
          name: 'Agent 1',
          team_id: 't1',
          instructions: null,
          ai_provider: 'ollama',
          model: 'llama3',
          created_at: '2025-01-01',
          archived_at: null,
        },
      ]
      vi.mocked(agentsService.listAgents).mockResolvedValue(rows)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).get('/api/agents').expect(200)
      expect(res.body).toEqual(rows)
      expect(agentsService.listAgents).toHaveBeenCalledWith(pool, { includeArchived: false })
    })

    it('includes archived when archived=1', async () => {
      vi.mocked(agentsService.listAgents).mockResolvedValue([])
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      await request(app).get('/api/agents?archived=1').expect(200)
      expect(agentsService.listAgents).toHaveBeenCalledWith(pool, { includeArchived: true })
    })

    it('returns 500 when service throws', async () => {
      vi.mocked(agentsService.listAgents).mockRejectedValue(new Error('db error'))
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).get('/api/agents')
      expect(res.status).toBe(500)
      const bodyOrText = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(bodyOrText.length > 0).toBe(true)
      expect(bodyOrText).toMatch(/unexpected|error/i)
    })
  })

  describe('POST /', () => {
    it('creates agent and returns 201', async () => {
      const row = {
        id: 'a1',
        name: 'New Agent',
        team_id: 't1',
        instructions: 'Do stuff',
        ai_provider: 'ollama',
        model: 'llama3',
        created_at: '2025-01-01',
        archived_at: null,
      }
      vi.mocked(agentsService.createAgent).mockResolvedValue(row)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app)
        .post('/api/agents')
        .send({ name: 'New Agent', team_id: 't1', instructions: 'Do stuff', model: 'llama3' })
        .expect(201)
      expect(res.body).toEqual(row)
      expect(agentsService.createAgent).toHaveBeenCalledWith(pool, expect.objectContaining({
        name: 'New Agent',
        team_id: 't1',
        instructions: 'Do stuff',
        model: 'llama3',
      }))
    })

    it('returns 400 when name missing', async () => {
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).post('/api/agents').send({ team_id: 't1' })
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/name/i)
      expect(err).toMatch(/required/i)
      expect(agentsService.createAgent).not.toHaveBeenCalled()
    })

    it('returns 400 when team_id missing', async () => {
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      await request(app).post('/api/agents').send({ name: 'A' }).expect(400)
      expect(agentsService.createAgent).not.toHaveBeenCalled()
    })

    it('returns 500 when service throws', async () => {
      vi.mocked(agentsService.createAgent).mockRejectedValue(new Error('db error'))
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).post('/api/agents').send({ name: 'A', team_id: 't1' })
      expect(res.status).toBe(500)
      const bodyOrText = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(bodyOrText.length > 0).toBe(true)
      expect(bodyOrText).toMatch(/unexpected|error/i)
    })
  })

  describe('GET /:id', () => {
    it('returns agent when found', async () => {
      const row = {
        id: 'a1',
        name: 'Agent',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      vi.mocked(agentsService.getAgentById).mockResolvedValue(row)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).get('/api/agents/a1').expect(200)
      expect(res.body).toEqual(row)
      expect(agentsService.getAgentById).toHaveBeenCalledWith(pool, 'a1')
    })

    it('returns 404 when not found', async () => {
      vi.mocked(agentsService.getAgentById).mockResolvedValue(null)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).get('/api/agents/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Agent not found')
    })

    it('returns 500 when service throws', async () => {
      vi.mocked(agentsService.getAgentById).mockRejectedValue(new Error('db error'))
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      await request(app).get('/api/agents/a1').expect(500)
    })
  })

  describe('PATCH /:id', () => {
    it('updates agent and returns 200', async () => {
      const row = {
        id: 'a1',
        name: 'Updated',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      vi.mocked(agentsService.updateAgent).mockResolvedValue(row)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).patch('/api/agents/a1').send({ name: 'Updated' }).expect(200)
      expect(res.body).toEqual(row)
      expect(agentsService.updateAgent).toHaveBeenCalledWith(pool, 'a1', { name: 'Updated' })
    })

    it('returns 400 when no fields to update', async () => {
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).patch('/api/agents/a1').send({})
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('No fields to update')
      expect(agentsService.updateAgent).not.toHaveBeenCalled()
    })

    it('returns 404 when agent not found', async () => {
      vi.mocked(agentsService.updateAgent).mockResolvedValue(null)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).patch('/api/agents/missing').send({ name: 'X' })
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Agent not found')
    })
  })

  describe('PATCH /:id/archive', () => {
    it('archives agent and returns 200', async () => {
      const row = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '2025-01-01',
        archived_at: '2025-01-02',
      }
      vi.mocked(agentsService.archiveAgent).mockResolvedValue(row)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).patch('/api/agents/a1/archive').expect(200)
      expect(res.body).toEqual(row)
      expect(agentsService.archiveAgent).toHaveBeenCalledWith(pool, 'a1')
    })

    it('returns 404 when agent not found or already archived', async () => {
      vi.mocked(agentsService.archiveAgent).mockResolvedValue(null)
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse: createMockSse(),
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      const res = await request(app).patch('/api/agents/missing/archive')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Agent not found or already archived')
    })
  })

  describe('GET /:id/stream', () => {
    it('returns 200 and registers agent stream', (done) => {
      const registerAgentStream = vi.fn()
      const sse = createMockSse()
      sse.registerAgentStream = registerAgentStream
      const router = createAgentsRouter({
        getPool: createMockGetPool(pool),
        sse,
        emit: () => {},
        upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
      })
      const app = appWithRouter('/api/agents', router)
      request(app)
        .get('/api/agents/a1/stream')
        .timeout(200)
        .end((err, res) => {
          try {
            expect(err).toBeFalsy()
            expect(res?.status).toBe(200)
            expect(registerAgentStream).toHaveBeenCalledWith('a1', expect.any(Object))
            done()
          } catch (e) {
            done(e instanceof Error ? e : new Error(String(e)))
          }
        })
    })
  })
})

describe('AI models routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(ollamaService.fetchOllamaModels).mockReset()
    vi.mocked(cursorService.fetchCursorModels).mockReset()
    vi.mocked(anthropicService.fetchAnthropicModels).mockReset()
    pool = createMockPool(vi.fn())
  })

  it('GET /ollama/models returns 200 with models when ok', async () => {
    vi.mocked(ollamaService.fetchOllamaModels).mockResolvedValue({
      ok: true,
      models: [{ name: 'llama3' }],
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/ollama/models').expect(200)
    expect(res.body.models).toEqual([{ name: 'llama3' }])
  })

  it('GET /ollama/models returns 502 when not ok', async () => {
    vi.mocked(ollamaService.fetchOllamaModels).mockResolvedValue({
      ok: false,
      error: 'Connection refused',
      detail: 'detail',
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/ollama/models')
    expect(res.status).toBe(502)
    expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Connection refused')
  })

  it('GET /cursor/models returns 200 with models when ok', async () => {
    vi.mocked(cursorService.fetchCursorModels).mockResolvedValue({
      ok: true,
      models: [{ id: 'gpt-4' }],
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/cursor/models').expect(200)
    expect(res.body.models).toEqual([{ id: 'gpt-4' }])
  })

  it('GET /cursor/models returns 502 when not ok', async () => {
    vi.mocked(cursorService.fetchCursorModels).mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
      detail: undefined,
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/cursor/models')
    expect(res.status).toBe(502)
    expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Unauthorized')
  })

  it('GET /anthropic/models returns 200 with models when ok', async () => {
    vi.mocked(anthropicService.fetchAnthropicModels).mockResolvedValue({
      ok: true,
      models: [{ id: 'claude-3' }],
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/anthropic/models').expect(200)
    expect(res.body.models).toEqual([{ id: 'claude-3' }])
  })

  it('GET /anthropic/models returns 502 when not ok', async () => {
    vi.mocked(anthropicService.fetchAnthropicModels).mockResolvedValue({
      ok: false,
      error: 'API error',
      detail: undefined,
    })
    const router = createAiModelsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api', router)
    const res = await request(app).get('/api/anthropic/models')
    expect(res.status).toBe(502)
    expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('API error')
  })
})
