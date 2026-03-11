import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  archiveAgent,
} from '../agents.service.js'
import type { AgentRow, CreateAgentInput, UpdateAgentInput } from '../types.js'

describe('agents.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  describe('listAgents', () => {
    it('returns agents excluding archived by default', async () => {
      const rows: AgentRow[] = [
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
      mockQuery.mockResolvedValue({ rows })
      const result = await listAgents(pool)
      expect(result).toEqual(rows)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE archived_at IS NULL')
      )
    })

    it('includes archived when includeArchived is true', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await listAgents(pool, { includeArchived: true })
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      )
      expect(mockQuery.mock.calls[0][0]).not.toContain('WHERE archived_at')
    })
  })

  describe('getAgentById', () => {
    it('returns agent when found', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await getAgentById(pool, 'a1')
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['a1'])
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getAgentById(pool, 'missing')
      expect(result).toBeNull()
    })
  })

  describe('createAgent', () => {
    it('inserts with normalized provider and model', async () => {
      const input: CreateAgentInput = {
        name: 'New Agent',
        team_id: 't1',
        instructions: 'Do stuff',
        ai_provider: '  OpenAI  ',
        model: ' gpt-4 ',
      }
      const row: AgentRow = {
        id: 'a1',
        name: 'New Agent',
        team_id: 't1',
        instructions: 'Do stuff',
        ai_provider: 'openai',
        model: 'gpt-4',
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await createAgent(pool, input)
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        ['New Agent', 't1', 'Do stuff', 'openai', 'gpt-4']
      )
    })

    it('defaults ai_provider to ollama when empty', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'a1',
            name: 'A',
            team_id: 't1',
            instructions: null,
            ai_provider: 'ollama',
            model: null,
            created_at: '',
            archived_at: null,
          },
        ],
      })
      await createAgent(pool, { name: 'A', team_id: 't1', ai_provider: '' })
      expect(mockQuery.mock.calls[0][1]).toContain('ollama')
    })
  })

  describe('updateAgent', () => {
    it('updates only provided fields', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'Updated',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateAgent(pool, 'a1', { name: 'Updated' })
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents SET name = $1'),
        ['Updated', 'a1']
      )
    })

    it('updates instructions to null when empty string', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      await updateAgent(pool, 'a1', { instructions: '' })
      expect(mockQuery.mock.calls[0][1]).toContain(null)
    })

    it('updates model to null when empty string', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      await updateAgent(pool, 'a1', { model: '' })
      expect(mockQuery).toHaveBeenCalled()
    })

    it('returns getAgentById when no updates', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateAgent(pool, 'a1', {})
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['a1']
      )
    })
  })

  describe('archiveAgent', () => {
    it('sets archived_at and returns row', async () => {
      const row: AgentRow = {
        id: 'a1',
        name: 'A',
        team_id: 't1',
        instructions: null,
        ai_provider: 'ollama',
        model: null,
        created_at: '',
        archived_at: '2025-01-01',
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await archiveAgent(pool, 'a1')
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('archived_at = now()'),
        ['a1']
      )
    })

    it('returns null when agent already archived', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await archiveAgent(pool, 'a1')
      expect(result).toBeNull()
    })
  })
})
