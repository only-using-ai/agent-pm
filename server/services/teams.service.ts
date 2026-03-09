/**
 * Teams service: list and create teams. Depends on injected Pool for testability.
 */

import type { Pool } from 'pg'
import type { TeamRow } from './types.js'

export async function listTeams(pool: Pool): Promise<TeamRow[]> {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM teams ORDER BY name ASC'
  )
  return rows as TeamRow[]
}

export async function createTeam(
  pool: Pool,
  name: string
): Promise<TeamRow> {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) {
    throw new Error('name is required')
  }
  const { rows } = await pool.query(
    'INSERT INTO teams (name) VALUES ($1) RETURNING id, name, created_at',
    [trimmed]
  )
  return rows[0] as TeamRow
}
