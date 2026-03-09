/**
 * Agents service: CRUD for agents. Single responsibility; depends on injected Pool for testability.
 */

import type { Pool } from 'pg'
import type { AgentRow, CreateAgentInput, UpdateAgentInput } from './types.js'

export type ListAgentsOptions = { includeArchived?: boolean }

const AGENT_COLUMNS =
  'id, name, team_id, instructions, ai_provider, model, created_at, archived_at'

function normalizeProvider(ai_provider: unknown): string {
  if (typeof ai_provider === 'string' && ai_provider.trim()) {
    return ai_provider.trim().toLowerCase()
  }
  return 'ollama'
}

function normalizeModel(model: unknown): string | null {
  if (model == null) return null
  if (typeof model === 'string' && model.trim() !== '') return model.trim()
  return null
}

export async function listAgents(
  pool: Pool,
  options?: ListAgentsOptions
): Promise<AgentRow[]> {
  const where = options?.includeArchived ? '' : 'WHERE archived_at IS NULL'
  const { rows } = await pool.query(
    `SELECT ${AGENT_COLUMNS} FROM agents ${where} ORDER BY created_at DESC`
  )
  return rows as AgentRow[]
}

export async function getAgentById(
  pool: Pool,
  id: string
): Promise<AgentRow | null> {
  const { rows } = await pool.query(
    `SELECT ${AGENT_COLUMNS} FROM agents WHERE id = $1`,
    [id]
  )
  return (rows[0] as AgentRow) ?? null
}

export async function createAgent(
  pool: Pool,
  input: CreateAgentInput
): Promise<AgentRow> {
  const provider = normalizeProvider(input.ai_provider)
  const modelVal = normalizeModel(input.model)
  const { rows } = await pool.query(
    `INSERT INTO agents (name, team_id, instructions, ai_provider, model)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${AGENT_COLUMNS}`,
    [
      input.name,
      String(input.team_id),
      input.instructions ?? null,
      provider,
      modelVal,
    ]
  )
  return rows[0] as AgentRow
}

export async function updateAgent(
  pool: Pool,
  id: string,
  input: UpdateAgentInput
): Promise<AgentRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(typeof input.name === 'string' ? input.name.trim() : input.name)
  }
  if (input.team_id !== undefined) {
    updates.push(`team_id = $${paramIndex++}`)
    values.push(String(input.team_id))
  }
  if (input.instructions !== undefined) {
    updates.push(`instructions = $${paramIndex++}`)
    values.push(
      input.instructions === null || input.instructions === ''
        ? null
        : input.instructions
    )
  }
  if (input.ai_provider !== undefined) {
    updates.push(`ai_provider = $${paramIndex++}`)
    values.push(normalizeProvider(input.ai_provider))
  }
  if (input.model !== undefined) {
    updates.push(`model = $${paramIndex++}`)
    values.push(
      input.model === null ||
        (typeof input.model === 'string' && input.model.trim() === '')
        ? null
        : String(input.model).trim()
    )
  }

  if (updates.length === 0) return getAgentById(pool, id)

  values.push(id)
  const { rows } = await pool.query(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING ${AGENT_COLUMNS}`,
    values
  )
  return (rows[0] as AgentRow) ?? null
}

export async function archiveAgent(
  pool: Pool,
  id: string
): Promise<AgentRow | null> {
  const { rows } = await pool.query(
    `UPDATE agents SET archived_at = now() WHERE id = $1 AND archived_at IS NULL
     RETURNING ${AGENT_COLUMNS}`,
    [id]
  )
  return (rows[0] as AgentRow) ?? null
}
