/**
 * Project columns service: default columns constant, ensure defaults, list, create, delete.
 * Single responsibility; used by projects.service for seeding new projects.
 */

import crypto from 'node:crypto'
import type { Pool } from 'pg'
import type {
  ProjectColumnRow,
  CreateProjectColumnInput,
  UpdateProjectColumnInput,
} from './types.js'

export const DEFAULT_PROJECT_COLUMNS: ReadonlyArray<{
  id: string
  title: string
  color: string
  position: number
}> = [
  { id: 'todo', title: 'Todo', color: 'bg-muted/50', position: 0 },
  {
    id: 'in_progress',
    title: 'In Progress',
    color: 'bg-blue-500/10 border-blue-500/30',
    position: 1,
  },
  {
    id: 'completed',
    title: 'Completed',
    color: 'bg-green-500/10 border-green-500/30',
    position: 2,
  },
  {
    id: 'blocked',
    title: 'Blocked',
    color: 'bg-amber-500/10 border-amber-500/30',
    position: 3,
  },
  {
    id: 'canceled',
    title: 'Canceled',
    color: 'bg-red-500/10 border-red-500/30',
    position: 4,
  },
]

export async function ensureDefaultColumns(
  pool: Pool,
  projectId: string
): Promise<void> {
  for (const col of DEFAULT_PROJECT_COLUMNS) {
    await pool.query(
      `INSERT INTO project_columns (project_id, id, title, color, position) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, id) DO NOTHING`,
      [projectId, col.id, col.title, col.color, col.position]
    )
  }
}

export async function listColumns(
  pool: Pool,
  projectId: string
): Promise<ProjectColumnRow[]> {
  let { rows } = await pool.query(
    `SELECT project_id, id, title, color, position FROM project_columns
     WHERE project_id = $1 ORDER BY position ASC, id ASC`,
    [projectId]
  )
  if (rows.length === 0) {
    await ensureDefaultColumns(pool, projectId)
    const r = await pool.query(
      `SELECT project_id, id, title, color, position FROM project_columns
       WHERE project_id = $1 ORDER BY position ASC, id ASC`,
      [projectId]
    )
    rows = r.rows
  }
  return rows as ProjectColumnRow[]
}

export async function createColumn(
  pool: Pool,
  projectId: string,
  input: CreateProjectColumnInput
): Promise<ProjectColumnRow> {
  const title =
    typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : ''
  if (!title) {
    throw new Error('title is required')
  }
  const { rows: maxRow } = await pool.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM project_columns WHERE project_id = $1`,
    [projectId]
  )
  const position = (maxRow[0] as { next_pos: number })?.next_pos ?? 0
  const id = `col-${crypto.randomUUID()}`
  const colorVal =
    input.color && typeof input.color === 'string'
      ? input.color
      : 'bg-muted/50'
  const { rows } = await pool.query(
    `INSERT INTO project_columns (project_id, id, title, color, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING project_id, id, title, color, position`,
    [projectId, id, title, colorVal, position]
  )
  return rows[0] as ProjectColumnRow
}

export async function updateColumn(
  pool: Pool,
  projectId: string,
  columnId: string,
  input: UpdateProjectColumnInput
): Promise<ProjectColumnRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1
  if (input.title !== undefined) {
    const title =
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim()
        : ''
    if (!title) throw new Error('title cannot be empty')
    updates.push(`title = $${paramIndex++}`)
    values.push(title)
  }
  if (input.color !== undefined) {
    const colorVal =
      typeof input.color === 'string' && input.color.trim()
        ? input.color.trim()
        : 'bg-muted/50'
    updates.push(`color = $${paramIndex++}`)
    values.push(colorVal)
  }
  if (input.position !== undefined && Number.isInteger(input.position) && input.position >= 0) {
    updates.push(`position = $${paramIndex++}`)
    values.push(input.position)
  }
  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT project_id, id, title, color, position FROM project_columns
       WHERE project_id = $1 AND id = $2`,
      [projectId, columnId]
    )
    return (rows[0] as ProjectColumnRow) ?? null
  }
  values.push(projectId, columnId)
  const { rows } = await pool.query(
    `UPDATE project_columns SET ${updates.join(', ')}
     WHERE project_id = $${paramIndex} AND id = $${paramIndex + 1}
     RETURNING project_id, id, title, color, position`,
    values
  )
  return (rows[0] as ProjectColumnRow) ?? null
}

export async function deleteColumn(
  pool: Pool,
  projectId: string,
  columnId: string
): Promise<void> {
  const { rows: columns } = await pool.query(
    `SELECT id FROM project_columns WHERE project_id = $1 ORDER BY position ASC, id ASC`,
    [projectId]
  )
  if (columns.length === 0) {
    throw new Error('No columns found')
  }
  const fallbackId =
    (columns as { id: string }[]).find((c) => c.id !== columnId)?.id ??
    (columns[0] as { id: string }).id
  if (fallbackId === columnId) {
    throw new Error('Cannot delete the only column')
  }
  await pool.query(
    `UPDATE work_items SET status = $1, updated_at = now() WHERE project_id = $2 AND status = $3`,
    [fallbackId, projectId, columnId]
  )
  const { rowCount } = await pool.query(
    `DELETE FROM project_columns WHERE project_id = $1 AND id = $2`,
    [projectId, columnId]
  )
  if (rowCount === 0) {
    throw new Error('Column not found')
  }
}
