import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
} from '../projects.service.js'
import type { ProjectRow, CreateProjectInput } from '../types.js'

describe('projects.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  describe('listProjects', () => {
    it('returns projects excluding archived by default', async () => {
      const rows: ProjectRow[] = [
        {
          id: 'p1',
          name: 'P1',
          priority: null,
          description: null,
          path: null,
          project_context: null,
          color: null,
          icon: null,
          created_at: '2025-01-01',
          archived_at: null,
        },
      ]
      mockQuery.mockResolvedValue({ rows })
      const result = await listProjects(pool)
      expect(result).toEqual(rows)
      expect(mockQuery.mock.calls[0][0]).toContain('WHERE archived_at IS NULL')
    })

    it('includes archived when includeArchived is true', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await listProjects(pool, { includeArchived: true })
      expect(mockQuery.mock.calls[0][0]).not.toContain('WHERE archived_at')
    })
  })

  describe('getProjectById', () => {
    it('returns project when found', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'P1',
        priority: null,
        description: null,
        path: null,
        project_context: null,
        color: null,
        icon: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await getProjectById(pool, 'p1')
      expect(result).toEqual(row)
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getProjectById(pool, 'missing')
      expect(result).toBeNull()
    })
  })

  describe('createProject', () => {
    it('inserts and ensures default columns then returns project', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'New',
        priority: null,
        description: null,
        path: null,
        project_context: null,
        color: null,
        icon: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValue({ rows: [] })
      const result = await createProject(pool, { name: 'New' })
      expect(result).toEqual(row)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        ['New', null, null, null, null, null, null]
      )
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO project_columns'),
        expect.any(Array)
      )
    })

    it('throws when name is missing or empty', async () => {
      await expect(createProject(pool, { name: '' })).rejects.toThrow('name is required')
      await expect(createProject(pool, { name: '  ' })).rejects.toThrow('name is required')
      await expect(createProject(pool, {} as CreateProjectInput)).rejects.toThrow('name is required')
    })
  })

  describe('updateProject', () => {
    it('updates provided fields', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'Updated',
        priority: 'High',
        description: null,
        path: null,
        project_context: null,
        color: null,
        icon: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateProject(pool, 'p1', { name: 'Updated', priority: 'High' })
      expect(result).toEqual(row)
    })

    it('returns getProjectById when no updates', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'P1',
        priority: null,
        description: null,
        path: null,
        project_context: null,
        color: null,
        icon: null,
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateProject(pool, 'p1', {})
      expect(result).toEqual(row)
    })

    it('throws when name is empty string', async () => {
      await expect(updateProject(pool, 'p1', { name: '' })).rejects.toThrow(
        'name must be a non-empty string'
      )
    })

    it('updates color and icon and returns them in the row', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'P',
        priority: null,
        description: null,
        path: null,
        project_context: null,
        color: '#22c55e',
        icon: '📁',
        created_at: '2025-01-01',
        archived_at: null,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateProject(pool, 'p1', { color: '#22c55e', icon: '📁' })
      expect(result).toEqual(row)
      expect(result?.color).toBe('#22c55e')
      expect(result?.icon).toBe('📁')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('color = $'),
        expect.arrayContaining(['#22c55e', '📁', 'p1'])
      )
    })
  })

  describe('archiveProject', () => {
    it('sets archived_at and returns row', async () => {
      const row: ProjectRow = {
        id: 'p1',
        name: 'P1',
        priority: null,
        description: null,
        path: null,
        project_context: null,
        color: null,
        icon: null,
        created_at: '2025-01-01',
        archived_at: '2025-01-02',
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await archiveProject(pool, 'p1')
      expect(result).toEqual(row)
    })
  })
})
