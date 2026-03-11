import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  listMcpTools,
  getMcpToolById,
  createMcpTool,
  updateMcpTool,
  deleteMcpTool,
} from '../mcp.service.js'
import type { McpToolRow, CreateMcpToolInput } from '../types.js'

describe('mcp.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  const mcpRow: McpToolRow = {
    id: 'm1',
    name: 'Tool',
    type: 'command',
    command: 'npx',
    args: ['run', 'tool'],
    url: null,
    env: {},
    description: null,
    created_at: '2025-01-01',
  }

  describe('listMcpTools', () => {
    it('returns tools ordered by created_at', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'm1', name: 'T', type: 'command', command: 'c', args: [], url: null, env: {}, description: null, created_at: '' },
        ],
      })
      const result = await listMcpTools(pool)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('command')
    })
  })

  describe('getMcpToolById', () => {
    it('returns tool when found', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...mcpRow }] })
      const result = await getMcpToolById(pool, 'm1')
      expect(result).not.toBeNull()
      expect(result?.id).toBe('m1')
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getMcpToolById(pool, 'missing')
      expect(result).toBeNull()
    })
  })

  describe('createMcpTool', () => {
    it('inserts and returns row', async () => {
      const input: CreateMcpToolInput = {
        name: 'Tool',
        type: 'command',
        command: 'npx',
        args: ['run'],
      }
      mockQuery.mockResolvedValue({
        rows: [{ id: 'm1', name: 'Tool', type: 'command', command: 'npx', args: '["run"]', url: null, env: '{}', description: null, created_at: '' }],
      })
      const result = await createMcpTool(pool, input)
      expect(result.name).toBe('Tool')
      expect(result.type).toBe('command')
    })

    it('creates url type tool with url and env', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'm1', name: 'T', type: 'url', command: null, args: '[]', url: 'https://x.com', env: '{"KEY":"V"}', description: null, created_at: '' }],
      })
      const result = await createMcpTool(pool, { name: 'T', type: 'url', url: 'https://x.com', env: { KEY: 'V' } })
      expect(result.type).toBe('url')
    })
  })

  describe('updateMcpTool', () => {
    it('updates name and command', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'm1', name: 'Updated', type: 'command', command: 'node', args: '[]', url: null, env: '{}', description: null, created_at: '' }] })
      const result = await updateMcpTool(pool, 'm1', { name: 'Updated', command: 'node' })
      expect(result?.name).toBe('Updated')
    })

    it('returns getMcpToolById when no updates', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...mcpRow }] })
      const result = await updateMcpTool(pool, 'm1', {})
      expect(result).not.toBeNull()
    })
  })

  describe('deleteMcpTool', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })
      const result = await deleteMcpTool(pool, 'm1')
      expect(result).toBe(true)
    })

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 })
      const result = await deleteMcpTool(pool, 'm1')
      expect(result).toBe(false)
    })
  })
})
