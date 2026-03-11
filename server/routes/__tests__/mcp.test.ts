import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createMcpRouter } from '../mcp.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/mcp.service.js', () => ({
  listMcpTools: vi.fn(),
  getMcpToolById: vi.fn(),
  createMcpTool: vi.fn(),
  updateMcpTool: vi.fn(),
  deleteMcpTool: vi.fn(),
}))

import * as mcpService from '../../services/mcp.service.js'

describe('mcp routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(mcpService.listMcpTools).mockReset()
    vi.mocked(mcpService.getMcpToolById).mockReset()
    vi.mocked(mcpService.createMcpTool).mockReset()
    vi.mocked(mcpService.updateMcpTool).mockReset()
    vi.mocked(mcpService.deleteMcpTool).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns list of MCP tools', async () => {
      const rows = [{ id: 'm1', name: 'Tool', type: 'command', command: 'node', args: null, url: null, env: null, description: null }]
      vi.mocked(mcpService.listMcpTools).mockResolvedValue(rows)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).get('/api/mcp').expect(200)
      expect(res.body).toEqual(rows)
    })
  })

  describe('POST /', () => {
    it('creates MCP tool and returns 201', async () => {
      const row = { id: 'm1', name: 'New', type: 'command', command: 'npx', args: null, url: null, env: null, description: null }
      vi.mocked(mcpService.createMcpTool).mockResolvedValue(row)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).post('/api/mcp').send({ name: 'New', type: 'command', command: 'npx' }).expect(201)
      expect(res.body).toEqual(row)
    })

    it('returns 400 when name and type are required', async () => {
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).post('/api/mcp').send({})
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/name|type/i)
      expect(err).toMatch(/required/i)
    })

    it('returns 400 when type must be command or url', async () => {
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).post('/api/mcp').send({ name: 'X', type: 'invalid' })
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/type|command|url|enum/i)
    })
  })

  describe('GET /:id', () => {
    it('returns MCP tool when found', async () => {
      const row = { id: 'm1', name: 'Tool', type: 'url', command: null, args: null, url: 'http://x', env: null, description: null }
      vi.mocked(mcpService.getMcpToolById).mockResolvedValue(row)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).get('/api/mcp/m1').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(mcpService.getMcpToolById).mockResolvedValue(null)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).get('/api/mcp/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('MCP tool not found')
    })
  })

  describe('PATCH /:id', () => {
    it('updates MCP tool and returns 200', async () => {
      const row = { id: 'm1', name: 'Updated', type: 'command', command: null, args: null, url: null, env: null, description: null }
      vi.mocked(mcpService.updateMcpTool).mockResolvedValue(row)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).patch('/api/mcp/m1').send({ name: 'Updated' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(mcpService.updateMcpTool).mockResolvedValue(null)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).patch('/api/mcp/missing').send({ name: 'X' })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /:id', () => {
    it('deletes MCP tool and returns 204', async () => {
      vi.mocked(mcpService.deleteMcpTool).mockResolvedValue(true)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      await request(app).delete('/api/mcp/m1').expect(204)
      expect(mcpService.deleteMcpTool).toHaveBeenCalledWith(pool, 'm1')
    })

    it('returns 404 when not found', async () => {
      vi.mocked(mcpService.deleteMcpTool).mockResolvedValue(false)
      const router = createMcpRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/mcp', router)
      const res = await request(app).delete('/api/mcp/missing')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('MCP tool not found')
    })
  })
})
