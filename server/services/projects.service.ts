/**
 * Projects service: list, get, create, archive. Depends on injected Pool.
 * Creating a project seeds default columns via project-columns.service.
 */

import type { Pool } from 'pg'
import type {
  ProjectRow,
  CreateProjectInput,
  UpdateProjectInput,
  ListOptions,
} from './types.js'
import {
  ensureDefaultColumns,
} from './project-columns.service.js'

export async function listProjects(
  pool: Pool,
  options: ListOptions = {}
): Promise<ProjectRow[]> {
  const where = options.includeArchived ? '' : 'WHERE archived_at IS NULL'
  const { rows } = await pool.query(
    `SELECT id, name, priority, description, path, created_at, archived_at FROM projects ${where} ORDER BY created_at DESC`
  )
  return rows as ProjectRow[]
}

export async function getProjectById(
  pool: Pool,
  id: string
): Promise<ProjectRow | null> {
  const { rows } = await pool.query(
    'SELECT id, name, priority, description, path, created_at, archived_at FROM projects WHERE id = $1',
    [id]
  )
  return (rows[0] as ProjectRow) ?? null
}

export async function createProject(
  pool: Pool,
  input: CreateProjectInput
): Promise<ProjectRow> {
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new Error('name is required')
  }
  const { rows } = await pool.query(
    `INSERT INTO projects (name, priority, description, path)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, priority, description, path, created_at, archived_at`,
    [input.name, input.priority ?? null, input.description ?? null, input.path ?? null]
  )
  const project = rows[0] as ProjectRow
  await ensureDefaultColumns(pool, project.id)
  return project
}

export async function updateProject(
  pool: Pool,
  id: string,
  input: UpdateProjectInput
): Promise<ProjectRow | null> {
  if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) {
    throw new Error('name must be a non-empty string')
  }
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1
  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(input.name.trim())
  }
  if (input.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`)
    values.push(input.priority)
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(input.description)
  }
  if (input.path !== undefined) {
    updates.push(`path = $${paramIndex++}`)
    values.push(input.path)
  }
  if (updates.length === 0) {
    return getProjectById(pool, id)
  }
  values.push(id)
  const { rows } = await pool.query(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, priority, description, path, created_at, archived_at`,
    values
  )
  return (rows[0] as ProjectRow) ?? null
}

export async function archiveProject(
  pool: Pool,
  id: string
): Promise<ProjectRow | null> {
  const { rows } = await pool.query(
    `UPDATE projects SET archived_at = now() WHERE id = $1 AND archived_at IS NULL
     RETURNING id, name, priority, description, created_at, archived_at`,
    [id]
  )
  return (rows[0] as ProjectRow) ?? null
}
