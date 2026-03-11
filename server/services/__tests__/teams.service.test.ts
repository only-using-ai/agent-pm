import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import { listTeams, createTeam } from '../teams.service.js'
import type { TeamRow } from '../types.js'

describe('teams.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  describe('listTeams', () => {
    it('returns teams ordered by name', async () => {
      const rows: TeamRow[] = [
        { id: 't1', name: 'Team A', created_at: '2025-01-01' },
        { id: 't2', name: 'Team B', created_at: '2025-01-02' },
      ]
      mockQuery.mockResolvedValue({ rows })
      const result = await listTeams(pool)
      expect(result).toEqual(rows)
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, name, created_at FROM teams ORDER BY name ASC'
      )
    })
  })

  describe('createTeam', () => {
    it('inserts trimmed name and returns row', async () => {
      const row: TeamRow = { id: 't1', name: 'New Team', created_at: '2025-01-01' }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await createTeam(pool, '  New Team  ')
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO teams (name) VALUES ($1) RETURNING id, name, created_at',
        ['New Team']
      )
    })

    it('throws when name is empty', async () => {
      await expect(createTeam(pool, '')).rejects.toThrow('name is required')
      await expect(createTeam(pool, '   ')).rejects.toThrow('name is required')
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })
})
