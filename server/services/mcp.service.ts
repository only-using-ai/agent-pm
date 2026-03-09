/**
 * MCP tools service: CRUD for MCP (Model Context Protocol) server configs.
 * Used by the API and by the agent runner to load tools for LangChain.
 */

import type { Pool } from 'pg'
import type {
  McpToolRow,
  CreateMcpToolInput,
  UpdateMcpToolInput,
} from './types.js'

const COLS =
  'id, name, type, command, args, url, env, description, created_at'

function normalizeArgs(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === 'string').map(String)
  }
  return []
}

function normalizeEnv(v: unknown): Record<string, string> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, string> = {}
    for (const [k, val] of Object.entries(v)) {
      if (typeof k === 'string' && typeof val === 'string') out[k] = val
    }
    return out
  }
  return {}
}

function rowToMcpTool(row: Record<string, unknown>): McpToolRow {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type === 'url' ? 'url' : 'command',
    command: row.command != null ? String(row.command) : null,
    args: normalizeArgs(row.args),
    url: row.url != null ? String(row.url) : null,
    env: normalizeEnv(row.env),
    description: row.description != null ? String(row.description) : null,
    created_at: String(row.created_at),
  }
}

export async function listMcpTools(pool: Pool): Promise<McpToolRow[]> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM mcp_tools ORDER BY created_at DESC`
  )
  return (rows as Record<string, unknown>[]).map(rowToMcpTool)
}

export async function getMcpToolById(
  pool: Pool,
  id: string
): Promise<McpToolRow | null> {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM mcp_tools WHERE id = $1`,
    [id]
  )
  const row = (rows as Record<string, unknown>[])[0]
  return row ? rowToMcpTool(row) : null
}

export async function createMcpTool(
  pool: Pool,
  input: CreateMcpToolInput
): Promise<McpToolRow> {
  const type = input.type === 'url' ? 'url' : 'command'
  const args = Array.isArray(input.args) ? input.args : []
  const env = input.env && typeof input.env === 'object' ? input.env : {}
  const { rows } = await pool.query(
    `INSERT INTO mcp_tools (name, type, command, args, url, env, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLS}`,
    [
      input.name,
      type,
      input.command ?? null,
      JSON.stringify(args),
      input.url ?? null,
      JSON.stringify(env),
      input.description ?? null,
    ]
  )
  return rowToMcpTool((rows as Record<string, unknown>[])[0])
}

export async function updateMcpTool(
  pool: Pool,
  id: string,
  input: UpdateMcpToolInput
): Promise<McpToolRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1
  if (input.name !== undefined) {
    updates.push(`name = $${i++}`)
    values.push(input.name)
  }
  if (input.command !== undefined) {
    updates.push(`command = $${i++}`)
    values.push(input.command)
  }
  if (input.args !== undefined) {
    updates.push(`args = $${i++}`)
    values.push(JSON.stringify(Array.isArray(input.args) ? input.args : []))
  }
  if (input.url !== undefined) {
    updates.push(`url = $${i++}`)
    values.push(input.url)
  }
  if (input.env !== undefined) {
    updates.push(`env = $${i++}`)
    values.push(JSON.stringify(input.env && typeof input.env === 'object' ? input.env : {}))
  }
  if (input.description !== undefined) {
    updates.push(`description = $${i++}`)
    values.push(input.description)
  }
  if (updates.length === 0) {
    return getMcpToolById(pool, id)
  }
  values.push(id)
  const { rows } = await pool.query(
    `UPDATE mcp_tools SET ${updates.join(', ')} WHERE id = $${i} RETURNING ${COLS}`,
    values
  )
  const row = (rows as Record<string, unknown>[])[0]
  return row ? rowToMcpTool(row) : null
}

export async function deleteMcpTool(
  pool: Pool,
  id: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM mcp_tools WHERE id = $1',
    [id]
  )
  return (rowCount ?? 0) > 0
}
