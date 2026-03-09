/**
 * Prompts service: CRUD for prompt templates (e.g. Agent System Prompt).
 * Used by the work-item-created flow and editable from Settings.
 */

import type { Pool } from 'pg'

export type PromptRow = {
  key: string
  name: string
  content: string
  updated_at: string
}

const PROMPT_COLUMNS = 'key, name, content, updated_at'

export async function listPrompts(pool: Pool): Promise<PromptRow[]> {
  const { rows } = await pool.query(
    `SELECT ${PROMPT_COLUMNS} FROM prompts ORDER BY key`
  )
  return rows as PromptRow[]
}

export async function getPromptByKey(
  pool: Pool,
  key: string
): Promise<PromptRow | null> {
  const { rows } = await pool.query(
    `SELECT ${PROMPT_COLUMNS} FROM prompts WHERE key = $1`,
    [key]
  )
  return (rows[0] as PromptRow) ?? null
}

export async function updatePrompt(
  pool: Pool,
  key: string,
  input: { name?: string; content?: string }
): Promise<PromptRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(input.name.trim())
  }
  if (input.content !== undefined) {
    updates.push(`content = $${paramIndex++}`)
    values.push(input.content)
  }
  updates.push(`updated_at = now()`)
  if (updates.length <= 1) {
    return getPromptByKey(pool, key)
  }
  values.push(key)
  const { rows } = await pool.query(
    `UPDATE prompts SET ${updates.join(', ')} WHERE key = $${paramIndex} RETURNING ${PROMPT_COLUMNS}`,
    values
  )
  return (rows[0] as PromptRow) ?? null
}
