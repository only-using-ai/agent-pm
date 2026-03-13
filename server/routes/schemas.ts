/**
 * Zod schemas for API request validation (body, params, query).
 * Used with validateBody, validateParams, validateQuery middleware.
 */

import { z } from 'zod'

/** Common: non-empty string */
const nonEmptyString = z.string().min(1, 'required')

/** Common: optional string or null */
const optionalString = z.string().nullable().optional()

/** Params: single id (agents, teams, projects, mcp, inbox) */
export const paramId = z.object({ id: nonEmptyString })

/** Params: projectId (columns, work-items, project-files, assets) */
export const paramProjectId = z.object({ projectId: nonEmptyString })

/** Params: projectId + id (work item, column, asset) */
export const paramProjectIdId = z.object({
  projectId: nonEmptyString,
  id: nonEmptyString,
})

export const paramProjectIdColumnId = z.object({
  projectId: nonEmptyString,
  columnId: nonEmptyString,
})

export const paramProjectIdAssetId = z.object({
  projectId: nonEmptyString,
  assetId: nonEmptyString,
})

export const paramProjectIdWorkItemId = z.object({
  projectId: nonEmptyString,
  workItemId: nonEmptyString,
})

/** Params: prompt key */
export const paramKey = z.object({ key: nonEmptyString })

/** Params: context file name */
export const paramName = z.object({ name: z.string() })

/** Query: optional archived=1, completed=1 (projects) */
export const queryArchived = z.object({
  archived: z.enum(['1']).optional(),
  completed: z.enum(['1']).optional(),
})

/** Query: optional status=all for inbox */
export const queryInboxStatus = z.object({
  status: z.enum(['all']).optional(),
})

/** Query: path (project files) */
export const queryPath = z.object({
  path: nonEmptyString,
})

// --- Agents ---
export const createAgentBody = z.object({
  name: nonEmptyString,
  team_id: nonEmptyString,
  instructions: optionalString,
  ai_provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
})

export const updateAgentBody = z
  .object({
    name: z.string().min(1).optional(),
    team_id: nonEmptyString.optional(),
    instructions: optionalString,
    ai_provider: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'No fields to update',
  })

// --- Teams ---
export const createTeamBody = z.object({
  name: nonEmptyString,
})

// --- Projects ---
export const createProjectBody = z.object({
  name: nonEmptyString,
  priority: optionalString,
  description: optionalString,
  path: optionalString,
  project_context: optionalString,
  color: optionalString,
  icon: optionalString,
})

export const updateProjectBody = z.object({
  name: z.string().min(1, 'name must be a non-empty string').optional(),
  priority: optionalString,
  description: optionalString,
  path: optionalString,
  project_context: optionalString,
  color: optionalString,
  icon: optionalString,
})

// --- Columns ---
export const createColumnBody = z.object({
  title: nonEmptyString,
  color: z.string().optional(),
})

export const updateColumnBody = z.object({
  title: z.string().min(1, 'title cannot be empty').optional(),
  color: z.string().optional(),
  position: z.number().optional(),
})

// --- Work items ---
const workItemAssetIds = z.array(z.string()).optional()
const workItemType = z.enum(['Bug', 'Feature', 'Story', 'Task'])

export const createWorkItemBody = z.object({
  title: nonEmptyString,
  description: optionalString,
  assigned_to: optionalString,
  priority: z.string().optional(),
  depends_on: optionalString,
  status: z.string().optional(),
  require_approval: z.boolean().optional(),
  work_item_type: workItemType.optional(),
  asset_ids: workItemAssetIds,
})

export const updateWorkItemBody = z
  .object({
    title: z.string().min(1).optional(),
    description: optionalString,
    assigned_to: optionalString,
    priority: z.string().optional(),
    depends_on: optionalString,
    status: z.string().optional(),
    require_approval: z.boolean().optional(),
    work_item_type: workItemType.optional(),
    asset_ids: z.array(z.string()).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'No fields to update',
  })

export const addCommentBody = z.object({
  body: nonEmptyString,
  author_type: z.string().optional(),
  author_id: z.string().nullable().optional(),
  mentioned_agent_ids: z.array(z.string()).optional(),
})

// --- MCP ---
const mcpType = z.enum(['command', 'url'])
export const createMcpToolBody = z.object({
  name: nonEmptyString,
  type: mcpType,
  command: z.string().nullable().optional(),
  args: z.array(z.string()).nullable().optional(),
  url: z.string().nullable().optional(),
  env: z.record(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
})

export const updateMcpToolBody = z.object({
  name: z.string().min(1).optional(),
  command: z.string().nullable().optional(),
  args: z.array(z.string()).nullable().optional(),
  url: z.string().nullable().optional(),
  env: z.record(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
})

// --- Context ---
export const patchContextBody = z.object({
  content: z.string(),
})

// --- Profile ---
export const updateProfileBody = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

// --- Prompts ---
export const updatePromptBody = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
})

// --- Project files (PUT content) ---
export const putProjectFileBody = z.object({
  content: z.string(),
})

// --- Assets ---
const assetType = z.enum(['file', 'link', 'folder'])
export const createAssetBody = z.object({
  name: nonEmptyString,
  type: assetType,
  parent_id: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  work_item_ids: z.array(z.string()).optional(),
})

export const updateAssetBody = z.object({
  name: z.string().min(1).optional(),
  type: assetType.optional(),
  parent_id: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
})

// --- Work item assets (link) ---
export const linkWorkItemAssetBody = z.object({
  asset_id: nonEmptyString,
})
