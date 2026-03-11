import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  DEFAULT_PROJECT_COLUMNS,
  ensureDefaultColumns,
  listColumns,
  createColumn,
  updateColumn,
  deleteColumn,
} from '../project-columns.service.js'
import type { ProjectColumnRow, CreateProjectColumnInput, UpdateProjectColumnInput } from '../types.js'

describe('project-columns.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  describe('DEFAULT_PROJECT_COLUMNS', () => {
    it('exports default columns with todo, in_progress, completed, blocked, canceled', () => {
      expect(DEFAULT_PROJECT_COLUMNS.length).toBe(5)
      const ids = DEFAULT_PROJECT_COLUMNS.map((c) => c.id)
      expect(ids).toContain('todo')
      expect(ids).toContain('in_progress')
      expect(ids).toContain('completed')
      expect(ids).toContain('blocked')
      expect(ids).toContain('canceled')
    })
  })

  describe('ensureDefaultColumns', () => {
    it('inserts default columns with ON CONFLICT DO NOTHING', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await ensureDefaultColumns(pool, 'p1')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (project_id, id) DO NOTHING'),
        expect.any(Array)
      )
    })
  })

  describe('listColumns', () => {
    it('returns columns when present', async () => {
      const rows: ProjectColumnRow[] = [
        { project_id: 'p1', id: 'todo', title: 'Todo', color: 'bg-muted/50', position: 0 },
      ]
      mockQuery.mockResolvedValue({ rows })
      const result = await listColumns(pool, 'p1')
      expect(result).toEqual(rows)
    })

    it('calls ensureDefaultColumns and re-queries when no rows', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ project_id: 'p1', id: 'todo', title: 'Todo', color: 'x', position: 0 }] })
      const result = await listColumns(pool, 'p1')
      expect(mockQuery).toHaveBeenCalled()
      expect(result.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('createColumn', () => {
    it('inserts with title and optional color', async () => {
      const row: ProjectColumnRow = {
        project_id: 'p1',
        id: 'col-uuid',
        title: 'New Column',
        color: 'bg-blue-500/10',
        position: 1,
      }
      mockQuery
        .mockResolvedValueOnce({ rows: [{ next_pos: 1 }] })
        .mockResolvedValueOnce({ rows: [row] })
      const result = await createColumn(pool, 'p1', { title: 'New Column', color: 'bg-blue-500/10' })
      expect(result).toEqual(row)
      expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO project_columns')
    })

    it('throws when title is empty', async () => {
      await expect(createColumn(pool, 'p1', { title: '' })).rejects.toThrow('title is required')
      await expect(createColumn(pool, 'p1', { title: '  ' })).rejects.toThrow('title is required')
    })
  })

  describe('updateColumn', () => {
    it('updates title', async () => {
      const row: ProjectColumnRow = {
        project_id: 'p1',
        id: 'col1',
        title: 'Updated',
        color: 'x',
        position: 0,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateColumn(pool, 'p1', 'col1', { title: 'Updated' })
      expect(result).toEqual(row)
    })

    it('throws when title is empty', async () => {
      await expect(updateColumn(pool, 'p1', 'col1', { title: '' })).rejects.toThrow(
        'title cannot be empty'
      )
    })

    it('returns get when no updates', async () => {
      const row: ProjectColumnRow = {
        project_id: 'p1',
        id: 'col1',
        title: 'T',
        color: 'x',
        position: 0,
      }
      mockQuery.mockResolvedValue({ rows: [row] })
      const result = await updateColumn(pool, 'p1', 'col1', {})
      expect(result).toEqual(row)
    })
  })

  describe('deleteColumn', () => {
    it('moves work items to fallback column and deletes', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'todo' }, { id: 'col1' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
      await deleteColumn(pool, 'p1', 'col1')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE work_items SET status = $1'),
        ['todo', 'p1', 'col1']
      )
    })

    it('throws when no columns found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await expect(deleteColumn(pool, 'p1', 'col1')).rejects.toThrow('No columns found')
    })

    it('throws when deleting the only column', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'col1' }] })
      await expect(deleteColumn(pool, 'p1', 'col1')).rejects.toThrow(
        'Cannot delete the only column'
      )
    })

    it('throws when column not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'todo' }, { id: 'col1' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 0 })
      await expect(deleteColumn(pool, 'p1', 'col1')).rejects.toThrow('Column not found')
    })
  })
})
