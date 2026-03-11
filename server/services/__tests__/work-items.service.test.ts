import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  listAllWorkItems,
  listWorkItemsByProject,
  listWorkItemsByAgent,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  archiveWorkItem,
  addWorkItemComment,
} from '../work-items.service.js'
import type {
  WorkItemRow,
  WorkItemWithProjectRow,
  WorkItemCommentRow,
} from '../types.js'

describe('work-items.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
  })

  const workItemRow: WorkItemRow = {
    id: 'wi1',
    project_id: 'p1',
    title: 'Task',
    description: null,
    assigned_to: null,
    priority: 'Medium',
    depends_on: null,
    status: 'todo',
    require_approval: false,
    work_item_type: 'Task',
    archived_at: null,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  }

  describe('listAllWorkItems', () => {
    it('returns work items with project name', async () => {
      const rows: WorkItemWithProjectRow[] = [{ ...workItemRow, project_name: 'P1' }]
      mockQuery.mockResolvedValue({ rows })
      const result = await listAllWorkItems(pool)
      expect(result).toEqual(rows)
    })

    it('includes archived when option set', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await listAllWorkItems(pool, { includeArchived: true })
      expect(mockQuery.mock.calls[0][0]).not.toContain('archived_at IS NULL')
    })
  })

  describe('listWorkItemsByProject', () => {
    it('returns work items for project', async () => {
      mockQuery.mockResolvedValue({ rows: [workItemRow] })
      const result = await listWorkItemsByProject(pool, 'p1')
      expect(result).toEqual([workItemRow])
    })
  })

  describe('listWorkItemsByAgent', () => {
    it('returns work items assigned to agent with project name', async () => {
      const rows: WorkItemWithProjectRow[] = [
        { ...workItemRow, assigned_to: 'agent-1', project_name: 'P1' },
      ]
      mockQuery.mockResolvedValue({ rows })
      const result = await listWorkItemsByAgent(pool, 'agent-1')
      expect(result).toEqual(rows)
      expect(mockQuery.mock.calls[0][0]).toContain('assigned_to = $1')
      expect(mockQuery.mock.calls[0][1]).toEqual(['agent-1'])
    })

    it('excludes archived by default', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await listWorkItemsByAgent(pool, 'agent-1')
      expect(mockQuery.mock.calls[0][0]).toContain('archived_at IS NULL')
    })
  })

  describe('getWorkItem', () => {
    it('returns work item with comments and asset_ids', async () => {
      const comments: WorkItemCommentRow[] = [
        {
          id: 'c1',
          work_item_id: 'wi1',
          author_type: 'user',
          author_id: null,
          body: 'Hello',
          created_at: '2025-01-01',
        },
      ]
      mockQuery
        .mockResolvedValueOnce({ rows: [workItemRow] })
        .mockResolvedValueOnce({ rows: comments })
        .mockResolvedValueOnce({ rows: [{ asset_id: 'a1' }] })
      const result = await getWorkItem(pool, 'p1', 'wi1')
      expect(result).toEqual({
        ...workItemRow,
        comments,
        asset_ids: ['a1'],
      })
    })

    it('returns null when work item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getWorkItem(pool, 'p1', 'missing')
      expect(result).toBeNull()
    })
  })

  describe('createWorkItem', () => {
    it('inserts and returns row', async () => {
      mockQuery.mockResolvedValue({ rows: [workItemRow] })
      const result = await createWorkItem(pool, 'p1', { title: 'Task' })
      expect(result).toEqual(workItemRow)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO work_items'),
        expect.arrayContaining(['p1', 'Task'])
      )
    })

    it('inserts with priority and status and require_approval', async () => {
      mockQuery.mockResolvedValue({ rows: [workItemRow] })
      const mockConnect = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
      const poolWithConnect = { ...pool, connect: vi.fn().mockResolvedValue(mockConnect) }
      await createWorkItem(poolWithConnect as Pool, 'p1', {
        title: 'T',
        priority: 'High',
        status: 'in_progress',
        require_approval: true,
        asset_ids: ['a1'],
      })
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO work_items'),
        expect.arrayContaining(['High', 'in_progress', true])
      )
    })

    it('throws when title is empty', async () => {
      await expect(createWorkItem(pool, 'p1', { title: '' })).rejects.toThrow('title is required')
    })
  })

  describe('updateWorkItem', () => {
    it('updates fields and returns row', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...workItemRow, title: 'Updated' }] })
      const result = await updateWorkItem(pool, 'p1', 'wi1', { title: 'Updated' })
      expect(result?.title).toBe('Updated')
    })

    it('returns get when no field updates and no asset_ids', async () => {
      mockQuery.mockResolvedValue({ rows: [workItemRow] })
      const result = await updateWorkItem(pool, 'p1', 'wi1', {})
      expect(result).toEqual(workItemRow)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['wi1', 'p1']
      )
    })

    it('returns get when only asset_ids updated', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
      const poolWithConnect = {
        ...pool,
        connect: vi.fn().mockResolvedValue(mockClient),
      }
      mockQuery.mockResolvedValue({ rows: [workItemRow] })
      const result = await updateWorkItem(poolWithConnect as Pool, 'p1', 'wi1', { asset_ids: [] })
      expect(result).toEqual(workItemRow)
    })
  })

  describe('archiveWorkItem', () => {
    it('sets archived_at and returns row', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...workItemRow, archived_at: '2025-01-02' }] })
      const result = await archiveWorkItem(pool, 'p1', 'wi1')
      expect(result?.archived_at).toBe('2025-01-02')
    })
  })

  describe('addWorkItemComment', () => {
    it('inserts comment and returns row', async () => {
      const comment: WorkItemCommentRow = {
        id: 'c1',
        work_item_id: 'wi1',
        author_type: 'agent',
        author_id: 'agent-1',
        body: 'Done.',
        created_at: '2025-01-01',
      }
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [comment] })
      const result = await addWorkItemComment(pool, 'p1', 'wi1', 'Done.', {
        author_type: 'agent',
        author_id: 'agent-1',
      })
      expect(result).toEqual(comment)
    })

    it('inserts with mentioned_agent_ids', async () => {
      const comment: WorkItemCommentRow = {
        id: 'c1',
        work_item_id: 'wi1',
        author_type: 'user',
        author_id: null,
        body: 'Hi @agent-1',
        created_at: '2025-01-01',
        mentioned_agent_ids: ['agent-1'],
      }
      mockQuery
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [comment] })
      const result = await addWorkItemComment(pool, 'p1', 'wi1', 'Hi @agent-1', {
        mentioned_agent_ids: ['agent-1', ''],
      })
      expect(result.mentioned_agent_ids).toEqual(['agent-1'])
    })

    it('throws when body is empty', async () => {
      await expect(
        addWorkItemComment(pool, 'p1', 'wi1', '')
      ).rejects.toThrow('body is required')
    })

    it('throws when work item not found', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 })
      await expect(
        addWorkItemComment(pool, 'p1', 'wi1', 'Hi')
      ).rejects.toThrow('Work item not found')
    })
  })
})
