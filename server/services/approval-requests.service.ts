/**
 * Approval requests (inbox items): create from agent tool, list, approve, reject.
 */

import type { Pool } from 'pg'
import type { ApprovalRequestRow } from './types.js'

export async function createApprovalRequest(
  pool: Pool,
  input: {
    work_item_id: string
    project_id?: string
    agent_id: string | null
    agent_name: string
    body: string
  }
): Promise<ApprovalRequestRow> {
  let projectId = input.project_id
  if (!projectId) {
    const { rows } = await pool.query<{ project_id: string }>(
      'SELECT project_id FROM work_items WHERE id = $1 LIMIT 1',
      [input.work_item_id]
    )
    if (rows.length === 0) throw new Error('Work item not found')
    projectId = rows[0].project_id
  }
  const { rows } = await pool.query<ApprovalRequestRow>(
    `INSERT INTO approval_requests (project_id, work_item_id, agent_id, agent_name, body, type, status)
     VALUES ($1, $2, $3, $4, $5, 'approval', 'pending')
     RETURNING id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at`,
    [
      projectId,
      input.work_item_id,
      input.agent_id ?? null,
      input.agent_name.trim() || 'Agent',
      input.body.trim() || '',
    ]
  )
  return rows[0]
}

export async function createInfoRequest(
  pool: Pool,
  input: {
    work_item_id: string
    project_id?: string
    agent_id: string | null
    agent_name: string
    body: string
  }
): Promise<ApprovalRequestRow> {
  let projectId = input.project_id
  if (!projectId) {
    const { rows } = await pool.query<{ project_id: string }>(
      'SELECT project_id FROM work_items WHERE id = $1 LIMIT 1',
      [input.work_item_id]
    )
    if (rows.length === 0) throw new Error('Work item not found')
    projectId = rows[0].project_id
  }
  const { rows } = await pool.query<ApprovalRequestRow>(
    `INSERT INTO approval_requests (project_id, work_item_id, agent_id, agent_name, body, type, status)
     VALUES ($1, $2, $3, $4, $5, 'info_request', 'pending')
     RETURNING id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at`,
    [
      projectId,
      input.work_item_id,
      input.agent_id ?? null,
      input.agent_name.trim() || 'Agent',
      input.body.trim() || '',
    ]
  )
  return rows[0]
}

export async function listApprovalRequests(
  pool: Pool,
  options: { status?: 'pending' | 'approved' | 'rejected' } = {}
): Promise<ApprovalRequestRow[]> {
  const status = options.status ?? 'pending'
  const { rows } = await pool.query<ApprovalRequestRow>(
    `SELECT id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at
     FROM approval_requests
     WHERE status = $1
     ORDER BY created_at DESC`,
    [status]
  )
  return rows
}

export async function listInboxItems(
  pool: Pool,
  options: { pendingOnly?: boolean } = {}
): Promise<ApprovalRequestRow[]> {
  const pendingOnly = options.pendingOnly !== false
  const { rows } = await pool.query<ApprovalRequestRow>(
    `SELECT id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at
     FROM approval_requests
     ${pendingOnly ? "WHERE status = 'pending'" : ''}
     ORDER BY created_at DESC`,
    pendingOnly ? [] : []
  )
  return rows
}

export async function getApprovalRequest(
  pool: Pool,
  id: string
): Promise<ApprovalRequestRow | null> {
  const { rows } = await pool.query<ApprovalRequestRow>(
    `SELECT id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at
     FROM approval_requests WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}

export async function resolveApprovalRequest(
  pool: Pool,
  id: string,
  status: 'approved' | 'rejected'
): Promise<ApprovalRequestRow | null> {
  const { rows } = await pool.query<ApprovalRequestRow>(
    `UPDATE approval_requests
     SET status = $1, resolved_at = now()
     WHERE id = $2 AND approval_requests.status = 'pending'
     RETURNING id, project_id, work_item_id, agent_id, agent_name, body, type, status, created_at, resolved_at`,
    [status, id]
  )
  return rows[0] ?? null
}
