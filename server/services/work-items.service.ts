/**
 * Work items service: list (all / by project), get, create, update, archive, add comment.
 * Single responsibility; depends on injected Pool for testability.
 */

import type { Pool } from 'pg'
import type {
  WorkItemRow,
  WorkItemWithProjectRow,
  WorkItemWithCommentsRow,
  WorkItemCommentRow,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  ListOptions,
} from './types.js'
import { getAssetIdsForWorkItem, setWorkItemAssets } from './assets.service.js'

const WORK_ITEM_COLUMNS =
  'id, project_id, title, description, assigned_to, priority, depends_on, status, require_approval, work_item_type, archived_at, created_at, updated_at'

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const
const WORK_ITEM_TYPES = ['Bug', 'Feature', 'Story', 'Task'] as const

function normalizePriority(priority: unknown): string {
  if (
    typeof priority === 'string' &&
    (PRIORITIES as readonly string[]).includes(priority)
  ) {
    return priority
  }
  return 'Medium'
}

function normalizeStatus(status: unknown): string {
  if (typeof status === 'string' && status.trim()) return status.trim()
  return 'todo'
}

function normalizeWorkItemType(workItemType: unknown): string {
  if (
    typeof workItemType === 'string' &&
    (WORK_ITEM_TYPES as readonly string[]).includes(workItemType)
  ) {
    return workItemType
  }
  return 'Task'
}

export async function listAllWorkItems(
  pool: Pool,
  options: ListOptions = {}
): Promise<WorkItemWithProjectRow[]> {
  const whereClause = options.includeArchived ? '' : 'WHERE w.archived_at IS NULL'
  const { rows } = await pool.query(
    `SELECT w.id, w.project_id, w.title, w.description, w.assigned_to, w.priority, w.depends_on, w.status, w.require_approval, w.work_item_type, w.archived_at, w.created_at, w.updated_at,
            p.name AS project_name
     FROM work_items w
     JOIN projects p ON p.id = w.project_id
     ${whereClause}
     ORDER BY w.updated_at DESC`
  )
  return rows as WorkItemWithProjectRow[]
}

export async function listWorkItemsByProject(
  pool: Pool,
  projectId: string,
  options: ListOptions = {}
): Promise<WorkItemRow[]> {
  const where = options.includeArchived
    ? 'WHERE project_id = $1'
    : 'WHERE project_id = $1 AND archived_at IS NULL'
  const { rows } = await pool.query(
    `SELECT ${WORK_ITEM_COLUMNS} FROM work_items ${where} ORDER BY created_at DESC`,
    [projectId]
  )
  return rows as WorkItemRow[]
}

export async function listWorkItemsByAgent(
  pool: Pool,
  agentId: string,
  options: ListOptions = {}
): Promise<WorkItemWithProjectRow[]> {
  const archivedClause = options.includeArchived ? '' : 'AND w.archived_at IS NULL'
  const { rows } = await pool.query(
    `SELECT w.id, w.project_id, w.title, w.description, w.assigned_to, w.priority, w.depends_on, w.status, w.require_approval, w.work_item_type, w.archived_at, w.created_at, w.updated_at,
            p.name AS project_name
     FROM work_items w
     JOIN projects p ON p.id = w.project_id
     WHERE w.assigned_to = $1 ${archivedClause}
     ORDER BY CASE w.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, w.created_at DESC`,
    [agentId]
  )
  return rows as WorkItemWithProjectRow[]
}

export async function getWorkItem(
  pool: Pool,
  projectId: string,
  id: string
): Promise<WorkItemWithCommentsRow | null> {
  const { rows } = await pool.query(
    `SELECT ${WORK_ITEM_COLUMNS} FROM work_items WHERE id = $1 AND project_id = $2`,
    [id, projectId]
  )
  if (rows.length === 0) return null
  const item = rows[0] as WorkItemRow
  const { rows: comments } = await pool.query(
    `SELECT id, work_item_id, author_type, author_id, body, created_at, mentioned_agent_ids
     FROM work_item_comments WHERE work_item_id = $1 ORDER BY created_at ASC`,
    [id]
  )
  const assetIds = await getAssetIdsForWorkItem(pool, id)
  return {
    ...item,
    comments: comments as WorkItemCommentRow[],
    asset_ids: assetIds,
  }
}

export async function createWorkItem(
  pool: Pool,
  projectId: string,
  input: CreateWorkItemInput
): Promise<WorkItemRow> {
  const title =
    typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : ''
  if (!title) {
    throw new Error('title is required')
  }
  const priorityVal = normalizePriority(input.priority)
  const statusVal = normalizeStatus(input.status)
  const requireApproval = input.require_approval === true
  const workItemTypeVal = normalizeWorkItemType(input.work_item_type)
  const { rows } = await pool.query(
    `INSERT INTO work_items (project_id, title, description, assigned_to, priority, depends_on, status, require_approval, work_item_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${WORK_ITEM_COLUMNS}`,
    [
      projectId,
      title,
      input.description?.trim() ?? null,
      input.assigned_to || null,
      priorityVal,
      input.depends_on || null,
      statusVal,
      requireApproval,
      workItemTypeVal,
    ]
  )
  const workItem = rows[0] as WorkItemRow
  if (input.asset_ids?.length) {
    await setWorkItemAssets(pool, projectId, workItem.id, input.asset_ids)
  }
  return workItem
}

export async function updateWorkItem(
  pool: Pool,
  projectId: string,
  id: string,
  input: UpdateWorkItemInput
): Promise<WorkItemRow | null> {
  const updates: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let paramIndex = 1

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(typeof input.title === 'string' ? input.title.trim() : input.title)
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(
      input.description === null || input.description === ''
        ? null
        : input.description
    )
  }
  if (input.assigned_to !== undefined) {
    updates.push(`assigned_to = $${paramIndex++}`)
    values.push(input.assigned_to || null)
  }
  if (
    input.priority !== undefined &&
    (PRIORITIES as readonly string[]).includes(input.priority)
  ) {
    updates.push(`priority = $${paramIndex++}`)
    values.push(input.priority)
  }
  if (input.depends_on !== undefined) {
    updates.push(`depends_on = $${paramIndex++}`)
    values.push(input.depends_on || null)
  }
  if (input.status !== undefined && typeof input.status === 'string') {
    updates.push(`status = $${paramIndex++}`)
    values.push(input.status.trim())
  }
  if (input.require_approval !== undefined) {
    updates.push(`require_approval = $${paramIndex++}`)
    values.push(input.require_approval === true)
  }
  if (
    input.work_item_type !== undefined &&
    (WORK_ITEM_TYPES as readonly string[]).includes(input.work_item_type)
  ) {
    updates.push(`work_item_type = $${paramIndex++}`)
    values.push(input.work_item_type)
  }

  if (input.asset_ids !== undefined) {
    await setWorkItemAssets(pool, projectId, id, input.asset_ids)
  }

  if (updates.length <= 1 && input.asset_ids === undefined) {
    const { rows: r } = await pool.query(
      `SELECT ${WORK_ITEM_COLUMNS} FROM work_items WHERE id = $1 AND project_id = $2`,
      [id, projectId]
    )
    return (r[0] as WorkItemRow) ?? null
  }

  values.push(id, projectId)
  const { rows } = await pool.query(
    `UPDATE work_items SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND project_id = $${paramIndex}
     RETURNING ${WORK_ITEM_COLUMNS}`,
    values
  )
  return (rows[0] as WorkItemRow) ?? null
}

export async function archiveWorkItem(
  pool: Pool,
  projectId: string,
  id: string
): Promise<WorkItemRow | null> {
  const { rows } = await pool.query(
    `UPDATE work_items SET archived_at = now(), updated_at = now()
     WHERE id = $1 AND project_id = $2 AND archived_at IS NULL
     RETURNING ${WORK_ITEM_COLUMNS}`,
    [id, projectId]
  )
  return (rows[0] as WorkItemRow) ?? null
}

export async function addWorkItemComment(
  pool: Pool,
  projectId: string,
  workItemId: string,
  body: string,
  options: {
    author_type?: 'user' | 'agent'
    author_id?: string | null
    mentioned_agent_ids?: string[]
  } = {}
): Promise<WorkItemCommentRow> {
  const trimmed =
    typeof body === 'string' && body.trim() ? body.trim() : ''
  if (!trimmed) {
    throw new Error('body is required')
  }
  const { rowCount } = await pool.query(
    'SELECT 1 FROM work_items WHERE id = $1 AND project_id = $2',
    [workItemId, projectId]
  )
  if (rowCount === 0) {
    throw new Error('Work item not found')
  }
  const authorType = options.author_type === 'agent' ? 'agent' : 'user'
  const authorId = authorType === 'agent' ? options.author_id ?? null : null
  const mentionedAgentIds = Array.isArray(options.mentioned_agent_ids)
    ? options.mentioned_agent_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const { rows } = await pool.query(
    `INSERT INTO work_item_comments (work_item_id, author_type, author_id, body, mentioned_agent_ids)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, work_item_id, author_type, author_id, body, created_at, mentioned_agent_ids`,
    [workItemId, authorType, authorId, trimmed, mentionedAgentIds]
  )
  const row = rows[0] as WorkItemCommentRow
  if (row.mentioned_agent_ids == null && mentionedAgentIds.length > 0) {
    row.mentioned_agent_ids = mentionedAgentIds
  }
  return row
}
