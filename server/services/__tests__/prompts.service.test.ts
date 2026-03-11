import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import { listPrompts, getPromptByKey, updatePrompt } from '../prompts.service.js'
import type { PromptRow } from '../prompts.service.js'

describe('prompts.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  describe('listPrompts', () => {
    it('returns prompts ordered by key', async () => {
      const rows: PromptRow[] = [
        { key: 'agent_system_prompt', name: 'System', content: 'You are...', updated_at: '2025-01-01' },
      ]
      mockQuery.mockResolvedValue({ rows })
      const result = await listPrompts(pool)
      expect(result).toEqual(rows)
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY key'))
    })
  })

  describe('getPromptByKey', () => {
    it('returns prompt when found', async () => {
      const row: PromptRow = {
        key: 'agent_system_prompt',
        name: 'System',
        content: 'You are helpful.',
        updated_at: '2025-01-01',
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await getPromptByKey(pool, 'agent_system_prompt')
      expect(result).toEqual(row)
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getPromptByKey(pool, 'missing')
      expect(result).toBeNull()
    })
  })

  describe('updatePrompt', () => {
    it('updates name and content', async () => {
      const row: PromptRow = {
        key: 'key1',
        name: 'New Name',
        content: 'New content',
        updated_at: '2025-01-01',
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updatePrompt(pool, 'key1', {
        name: 'New Name',
        content: 'New content',
      })
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE prompts SET'),
        expect.arrayContaining(['New Name', 'New content', 'key1'])
      )
    })

    it('returns getPromptByKey when no updates', async () => {
      const row: PromptRow = {
        key: 'key1',
        name: 'N',
        content: 'C',
        updated_at: '2025-01-01',
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updatePrompt(pool, 'key1', {})
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['key1']
      )
    })
  })
})
