/**
 * Shared types for service layer. Row types match DB columns; API types match request/response shapes.
 * Services depend on pg.Pool (injected) for testability (Dependency Inversion).
 */

import type { Pool } from 'pg'

/** Abstractions for testability: run queries without depending on a concrete Pool. */
export type QueryRunner = Pick<Pool, 'query'>

export type AgentRow = {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider: string | null
  model: string | null
  created_at: string
  archived_at: string | null
}

export type CreateAgentInput = {
  name: string
  team_id: string
  instructions?: string | null
  ai_provider?: string | null
  model?: string | null
}

export type UpdateAgentInput = Partial<CreateAgentInput>

export type TeamRow = {
  id: string
  name: string
  created_at: string
}

export type ProjectRow = {
  id: string
  name: string
  priority: string | null
  description: string | null
  path: string | null
  created_at: string
  archived_at: string | null
}

export type CreateProjectInput = {
  name: string
  priority?: string | null
  description?: string | null
  path?: string | null
}

export type UpdateProjectInput = {
  name?: string
  priority?: string | null
  description?: string | null
  path?: string | null
}

export type ProjectColumnRow = {
  project_id: string
  id: string
  title: string
  color: string
  position: number
}

export type CreateProjectColumnInput = {
  title: string
  color?: string
}

export type UpdateProjectColumnInput = {
  title?: string
  color?: string
}

export type WorkItemRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  priority: string
  depends_on: string | null
  status: string
  require_approval: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type WorkItemWithProjectRow = WorkItemRow & { project_name: string }

export type WorkItemCommentRow = {
  id: string
  work_item_id: string
  author_type: string
  author_id: string | null
  body: string
  created_at: string
}

export type WorkItemWithCommentsRow = WorkItemRow & { comments: WorkItemCommentRow[] }

export type CreateWorkItemInput = {
  title: string
  description?: string | null
  assigned_to?: string | null
  priority?: string
  depends_on?: string | null
  status?: string
  require_approval?: boolean
}

export type UpdateWorkItemInput = Partial<{
  title: string
  description: string | null
  assigned_to: string | null
  priority: string
  depends_on: string | null
  status: string
  require_approval: boolean
}>

export type ListOptions = { includeArchived?: boolean }

export type ApprovalRequestRow = {
  id: string
  project_id: string
  work_item_id: string
  agent_id: string | null
  agent_name: string
  body: string
  type: 'approval' | 'info_request'
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  resolved_at: string | null
}

export type McpToolRow = {
  id: string
  name: string
  type: 'command' | 'url'
  command: string | null
  args: string[]
  url: string | null
  env: Record<string, string>
  description: string | null
  created_at: string
}

export type CreateMcpToolInput = {
  name: string
  type: 'command' | 'url'
  command?: string | null
  args?: string[] | null
  url?: string | null
  env?: Record<string, string> | null
  description?: string | null
}

export type UpdateMcpToolInput = Partial<Omit<CreateMcpToolInput, 'type'>>
