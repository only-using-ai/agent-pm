/**
 * LangChain tools for the agent. Used by the deep agent runner; tools can be
 * stub implementations (for tests) or context-bound implementations that
 * perform real DB updates and broadcast (for work-item handler).
 */

import { tool } from '@langchain/core/tools'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import { writeFile } from 'fs/promises'
import path from 'path'

const WORK_ITEM_STATUS_VALUES = [
  'todo',
  'in_progress',
  'completed',
  'blocked',
  'canceled',
] as const

const updateWorkItemStatusSchema = z.object({
  status: z.enum(WORK_ITEM_STATUS_VALUES).describe('The new status of the work item.'),
})

const addWorkItemCommentSchema = z.object({
  body: z.string().describe('The comment text to add to the current work item.'),
})

const listAvailableAgentsSchema = z.object({})

const createWorkItemAndAssignSchema = z.object({
  title: z.string().describe('Title of the new work item.'),
  description: z
    .string()
    .optional()
    .nullable()
    .describe('Optional description or instructions for the work item.'),
  assigned_to_agent_id: z
    .string()
    .describe('ID of the agent to assign the work item to. Use list_available_agents first to get agent IDs.'),
  priority: z
    .enum(['Low', 'Medium', 'High', 'Critical'])
    .optional()
    .describe('Optional priority. Defaults to Medium.'),
  depends_on: z
    .string()
    .optional()
    .describe(
      'Optional work item id that this new work item depends on. Typically the id of the current work item.'
    ),
})

const requestForApprovalSchema = z.object({
  text: z.string().describe('The approval request message to show the user (what you are asking approval for).'),
  work_item_id: z.string().describe('The ID of the work item this approval is about.'),
  agent_name: z.string().describe('Display name of the agent requesting approval (e.g. your own name).'),
})

const requestInfoSchema = z.object({
  message: z.string().describe('The question or information you need from the user. Be clear and specific.'),
  work_item_id: z.string().describe('The ID of the work item this request is related to.'),
  agent_name: z.string().describe('Display name of the agent asking for information (e.g. your own name).'),
})

const writeFileSchema = z.object({
  filename: z.string().describe('Path or name of the file to write (relative to current working directory or absolute).'),
  contents: z.string().describe('The full contents to write to the file.'),
})

const linkAssetToWorkItemSchema = z.object({
  asset_id: z.string().describe('ID of the asset to link to the current work item.'),
})

const createAssetAndLinkSchema = z.object({
  name: z.string().describe('Display name of the asset (e.g. filename or title).'),
  type: z.enum(['file', 'link', 'folder']).describe('Type of asset: file, link, or folder.'),
  path: z.string().optional().describe('Optional file path (e.g. path to the file just created).'),
  url: z.string().optional().describe('Optional URL for link-type assets.'),
})

/** Context passed when creating work-item tools for a real run (pool, broadcaster, etc.). */
export interface WorkItemToolContext {
  pool: import('pg').Pool
  projectId: string
  workItemId: string
  agentId: string
  broadcaster: { broadcastToAgent: (agentId: string, event: string, data: unknown) => void }
  updateWorkItem: (
    pool: import('pg').Pool,
    projectId: string,
    workItemId: string,
    input: { status: string }
  ) => Promise<unknown>
  addWorkItemComment: (
    pool: import('pg').Pool,
    projectId: string,
    workItemId: string,
    body: string,
    options: { author_type: 'agent'; author_id: string }
  ) => Promise<unknown>
  listAgents: (pool: import('pg').Pool) => Promise<Array<{ id: string; name: string; team_id: string; instructions: string | null }>>
  createWorkItem: (
    pool: import('pg').Pool,
    projectId: string,
    input: {
      title: string
      description?: string | null
      assigned_to?: string | null
      priority?: string
      depends_on?: string | null
      status?: string
    }
  ) => Promise<{
    id: string
    project_id: string
    title: string
    description: string | null
    assigned_to: string | null
    priority: string
    depends_on: string | null
    status: string
    archived_at: string | null
    created_at: string
    updated_at: string
  }>
  emitWorkItemCreated?: (payload: {
    id: string
    project_id: string
    title: string
    description: string | null
    assigned_to: string | null
    priority: string
    depends_on: string | null
    status: string
    archived_at: string | null
    created_at: string
    updated_at: string
  }) => void
  createApprovalRequest?: (
    pool: import('pg').Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
  createInfoRequest?: (
    pool: import('pg').Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
  linkAssetToWorkItem?: (
    pool: import('pg').Pool,
    projectId: string,
    workItemId: string,
    assetId: string
  ) => Promise<{ linked: boolean }>
  createAsset?: (
    pool: import('pg').Pool,
    projectId: string,
    input: { name: string; type: 'file' | 'link' | 'folder'; parent_id?: string | null; path?: string | null; url?: string | null; work_item_ids?: string[] }
  ) => Promise<{ id: string; name: string; type: string; path: string | null; url: string | null }>
}

/**
 * Stub tools (no DB): for tests or when toolContext is not provided.
 */
export const updateWorkItemStatusTool = tool(
  async (_: z.infer<typeof updateWorkItemStatusSchema>) => {
    return 'Status update will be applied by the system.'
  },
  {
    name: 'update_work_item_status',
    description:
      'Update the status of the current work item. Use this when the user or your analysis indicates the item should move to a different column (e.g. mark as in progress, completed, or blocked).',
    schema: updateWorkItemStatusSchema,
  }
)

export const addWorkItemCommentTool = tool(
  async (_: z.infer<typeof addWorkItemCommentSchema>) => {
    return 'Comment will be added by the system.'
  },
  {
    name: 'add_work_item_comment',
    description:
      'Add a comment to the current work item. Use this to leave a note, summarize progress, or communicate with the user about the work item.',
    schema: addWorkItemCommentSchema,
  }
)

export const listAvailableAgentsTool = tool(
  async (_: z.infer<typeof listAvailableAgentsSchema>) => {
    return 'Agent list will be provided by the system. Use this tool to see available agents before creating or assigning work.'
  },
  {
    name: 'list_available_agents',
    description:
      'Get a list of available agents. Use this before creating a work item or assigning a task so you can choose the right agent by id. Returns agent id, name, and brief info.',
    schema: listAvailableAgentsSchema,
  }
)

export const createWorkItemAndAssignTool = tool(
  async (_: z.infer<typeof createWorkItemAndAssignSchema>) => {
    return 'Work item will be created and assigned by the system.'
  },
  {
    name: 'create_work_item_and_assign',
    description:
      'Create a new work item in the current project and assign it to an agent. Use list_available_agents first to get agent IDs. The assigned agent will be notified and can work on the task.',
    schema: createWorkItemAndAssignSchema,
  }
)

export const requestForApprovalTool = tool(
  async (_: z.infer<typeof requestForApprovalSchema>) => {
    return 'Approval request will be added to the user’s inbox.'
  },
  {
    name: 'request_for_approval',
    description:
      'Ask the user for approval before proceeding. Use this when you need human sign-off (e.g. deploy, merge, or a decision). The request appears in the user’s Inbox with Approve/Reject buttons. Provide the work item id, your agent name, and a clear message explaining what you are asking approval for.',
    schema: requestForApprovalSchema,
  }
)

export const requestInfoTool = tool(
  async (_: z.infer<typeof requestInfoSchema>) => {
    return 'Info request will be added to the user’s inbox.'
  },
  {
    name: 'request_info',
    description:
      'Ask the user for information or clarification. Use this when you need the user to provide details, preferences, or answers before you can proceed (e.g. priorities, constraints, business rules). The request appears in the user’s Inbox as an "Info request"; they can reply with the information. Provide the work item id, your agent name, and a clear message describing what you need.',
    schema: requestInfoSchema,
  }
)

export const linkAssetToWorkItemTool = tool(
  async (_: z.infer<typeof linkAssetToWorkItemSchema>) => {
    return 'Asset will be linked to the work item by the system.'
  },
  {
    name: 'link_asset_to_work_item',
    description:
      'Link an existing asset to the current work item. Use this after creating or identifying an asset so it appears on the work item. Provide the asset id.',
    schema: linkAssetToWorkItemSchema,
  }
)

export const createAssetAndLinkToWorkItemTool = tool(
  async (_: z.infer<typeof createAssetAndLinkSchema>) => {
    return 'Asset will be created and linked to the work item by the system.'
  },
  {
    name: 'create_asset_and_link_to_work_item',
    description:
      'Create a new asset (e.g. for a file you just created with write_file) and link it to the current work item. Use name and type; optionally path for files or url for links. Use this when you create a new file so it is tracked as an asset on the work item.',
    schema: createAssetAndLinkSchema,
  }
)

/** Write content to a file. Path is relative to process cwd or absolute. */
export const writeFileTool = tool(
  async (input: z.infer<typeof writeFileSchema>) => {
    const filename = typeof input?.filename === 'string' ? input.filename.trim() : ''
    const contents = typeof input?.contents === 'string' ? input.contents : ''
    if (!filename) return 'Filename is required.'
    try {
      const resolved = path.isAbsolute(filename) ? filename : path.resolve(process.cwd(), filename)
      await writeFile(resolved, contents, 'utf8')
      return `Wrote ${contents.length} character(s) to ${resolved}.`
    } catch (e) {
      console.error('[write_file]', e)
      return e instanceof Error ? e.message : 'Failed to write file.'
    }
  },
  {
    name: 'write_file',
    description:
      'Write text contents to a file. Use this to create or overwrite a file. Provide the filename (path) and the full contents. Path can be relative to the current working directory or absolute.',
    schema: writeFileSchema,
  }
)

/** Stub tools array for tests / default use. */
export const LANGCHAIN_TOOLS: StructuredToolInterface[] = [
  updateWorkItemStatusTool,
  addWorkItemCommentTool,
  listAvailableAgentsTool,
  createWorkItemAndAssignTool,
  requestForApprovalTool,
  requestInfoTool,
  writeFileTool,
  linkAssetToWorkItemTool,
  createAssetAndLinkToWorkItemTool,
]

/**
 * Create work-item tools bound to run context. When the deep agent calls these,
 * they perform real DB updates and broadcast to SSE clients.
 */
export function createWorkItemTools(ctx: WorkItemToolContext): StructuredToolInterface[] {
  const updateStatus = tool(
    async (input: z.infer<typeof updateWorkItemStatusSchema>) => {
      const status = input?.status?.trim()
      if (!status || !ctx.workItemId || !ctx.projectId) {
        return 'Status or work item missing.'
      }
      try {
        await ctx.updateWorkItem(ctx.pool, ctx.projectId, ctx.workItemId, { status })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'work_item_updated', {
          work_item_id: ctx.workItemId,
          project_id: ctx.projectId,
          status,
        })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: 'Status change successful.',
          type: 'content',
        })
        return 'Status change successful.'
      } catch (e) {
        console.error('[update_work_item_status]', e)
        return 'Status update failed.'
      }
    },
    {
      name: 'update_work_item_status',
      description:
        'Update the status of the current work item. Use this when the user or your analysis indicates the item should move to a different column (e.g. mark as in progress, completed, or blocked).',
      schema: updateWorkItemStatusSchema,
    }
  )

  const addComment = tool(
    async (input: z.infer<typeof addWorkItemCommentSchema>) => {
      const body = typeof input?.body === 'string' ? input.body.trim() : ''
      if (!body || !ctx.workItemId || !ctx.projectId) {
        return 'Comment body or work item missing.'
      }
      try {
        await ctx.addWorkItemComment(ctx.pool, ctx.projectId, ctx.workItemId, body, {
          author_type: 'agent',
          author_id: ctx.agentId,
        })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: 'Comment added successfully.',
          type: 'content',
        })
        return 'Comment added successfully.'
      } catch (e) {
        console.error('[add_work_item_comment]', e)
        return 'Comment failed.'
      }
    },
    {
      name: 'add_work_item_comment',
      description:
        'Add a comment to the current work item. Use this to leave a note, summarize progress, or communicate with the user about the work item.',
      schema: addWorkItemCommentSchema,
    }
  )

  const listAgentsTool = tool(
    async (_: z.infer<typeof listAvailableAgentsSchema>) => {
      try {
        const agents = await ctx.listAgents(ctx.pool)
        if (agents.length === 0) return 'No agents available.'
        const lines = agents.map(
          (a) => `- **${a.name}** (id: \`${a.id}\`)${a.instructions ? ` — ${a.instructions.slice(0, 80)}${a.instructions.length > 80 ? '…' : ''}` : ''}`
        )
        return `Available agents:\n${lines.join('\n')}\n\nUse the agent id when creating a work item with create_work_item_and_assign.`
      } catch (e) {
        console.error('[list_available_agents]', e)
        return 'Failed to list agents.'
      }
    },
    {
      name: 'list_available_agents',
      description:
        'Get a list of available agents. Use this before creating a work item or assigning a task so you can choose the right agent by id. Returns agent id, name, and brief info.',
      schema: listAvailableAgentsSchema,
    }
  )

  const createWorkItemAndAssign = tool(
    async (input: z.infer<typeof createWorkItemAndAssignSchema>) => {
      const title = input?.title?.trim()
      if (!title) return 'Title is required.'
      if (!ctx.projectId) return 'Project context missing.'
      const agentId = input?.assigned_to_agent_id?.trim()
      if (!agentId) return 'assigned_to_agent_id is required. Use list_available_agents to get agent IDs.'
      try {
        const row = await ctx.createWorkItem(ctx.pool, ctx.projectId, {
          title,
          description: input?.description?.trim() ?? null,
          assigned_to: agentId,
          priority: input?.priority ?? 'Medium',
          depends_on: input?.depends_on?.trim() || null,
          status: 'todo',
        })
        if (ctx.emitWorkItemCreated && typeof row === 'object' && row !== null && 'id' in row && 'project_id' in row) {
          ctx.emitWorkItemCreated(row as Parameters<NonNullable<WorkItemToolContext['emitWorkItemCreated']>>[0])
        }
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: `Created work item "${row.title}" (id: ${row.id}) and assigned to agent ${agentId}.`,
          type: 'content',
        })
        return `Created work item "${row.title}" (id: ${row.id}) and assigned to agent ${agentId}. The assigned agent will be notified.`
      } catch (e) {
        console.error('[create_work_item_and_assign]', e)
        return e instanceof Error ? e.message : 'Failed to create work item.'
      }
    },
    {
      name: 'create_work_item_and_assign',
      description:
        'Create a new work item in the current project and assign it to an agent. Use list_available_agents first to get agent IDs. The assigned agent will be notified and can work on the task.',
      schema: createWorkItemAndAssignSchema,
    }
  )

  const requestForApproval = tool(
    async (input: z.infer<typeof requestForApprovalSchema>) => {
      const text = typeof input?.text === 'string' ? input.text.trim() : ''
      const workItemId = typeof input?.work_item_id === 'string' ? input.work_item_id.trim() : ''
      const agentName = typeof input?.agent_name === 'string' ? input.agent_name.trim() : ''
      if (!text) return 'Approval request text is required.'
      if (!workItemId) return 'work_item_id is required.'
      if (!ctx.createApprovalRequest) return 'Approval requests are not available in this context.'
      try {
        const row = await ctx.createApprovalRequest(ctx.pool, {
          work_item_id: workItemId,
          project_id: ctx.workItemId === workItemId ? ctx.projectId : undefined,
          agent_id: ctx.agentId,
          agent_name: agentName || 'Agent',
          body: text,
        })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: 'Approval request sent to inbox. The user can Approve or Reject from the Inbox.',
          type: 'content',
        })
        return `Approval request created (id: ${row.id}). It has been added to the user's Inbox. Wait for the user to Approve or Reject before proceeding.`
      } catch (e) {
        console.error('[request_for_approval]', e)
        return e instanceof Error ? e.message : 'Failed to create approval request.'
      }
    },
    {
      name: 'request_for_approval',
      description:
        'Ask the user for approval before proceeding. Use this when you need human sign-off (e.g. deploy, merge, or a decision). The request appears in the user’s Inbox with Approve/Reject buttons. Provide the work item id, your agent name, and a clear message explaining what you are asking approval for.',
      schema: requestForApprovalSchema,
    }
  )

  const requestInfo = tool(
    async (input: z.infer<typeof requestInfoSchema>) => {
      const message = typeof input?.message === 'string' ? input.message.trim() : ''
      const workItemId = typeof input?.work_item_id === 'string' ? input.work_item_id.trim() : ''
      const agentName = typeof input?.agent_name === 'string' ? input.agent_name.trim() : ''
      if (!message) return 'Info request message is required.'
      if (!workItemId) return 'work_item_id is required.'
      if (!ctx.createInfoRequest) return 'Info requests are not available in this context.'
      try {
        const row = await ctx.createInfoRequest(ctx.pool, {
          work_item_id: workItemId,
          project_id: ctx.workItemId === workItemId ? ctx.projectId : undefined,
          agent_id: ctx.agentId,
          agent_name: agentName || 'Agent',
          body: message,
        })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: 'Info request sent to inbox. The user can reply from the Inbox.',
          type: 'content',
        })
        return `Info request created (id: ${row.id}). It has been added to the user's Inbox. Wait for the user to reply with the requested information before proceeding.`
      } catch (e) {
        console.error('[request_info]', e)
        return e instanceof Error ? e.message : 'Failed to create info request.'
      }
    },
    {
      name: 'request_info',
      description:
        'Ask the user for information or clarification. Use this when you need the user to provide details, preferences, or answers before you can proceed (e.g. priorities, constraints, business rules). The request appears in the user’s Inbox as an "Info request"; they can reply with the information. Provide the work item id, your agent name, and a clear message describing what you need.',
      schema: requestInfoSchema,
    }
  )

  const linkAssetToWorkItem = tool(
    async (input: z.infer<typeof linkAssetToWorkItemSchema>) => {
      const assetId = typeof input?.asset_id === 'string' ? input.asset_id.trim() : ''
      if (!assetId) return 'asset_id is required.'
      if (!ctx.workItemId || !ctx.projectId) return 'Work item context missing.'
      if (!ctx.linkAssetToWorkItem) return 'Linking assets is not available in this context.'
      try {
        const { linked } = await ctx.linkAssetToWorkItem(ctx.pool, ctx.projectId, ctx.workItemId, assetId)
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: linked ? 'Asset linked to work item.' : 'Asset was already linked to this work item.',
          type: 'content',
        })
        return linked ? 'Asset linked to work item.' : 'Asset was already linked to this work item.'
      } catch (e) {
        console.error('[link_asset_to_work_item]', e)
        return e instanceof Error ? e.message : 'Failed to link asset to work item.'
      }
    },
    {
      name: 'link_asset_to_work_item',
      description:
        'Link an existing asset to the current work item. Use this after creating or identifying an asset so it appears on the work item. Provide the asset id.',
      schema: linkAssetToWorkItemSchema,
    }
  )

  const createAssetAndLinkToWorkItem = tool(
    async (input: z.infer<typeof createAssetAndLinkSchema>) => {
      const name = typeof input?.name === 'string' ? input.name.trim() : ''
      if (!name) return 'name is required.'
      if (!ctx.workItemId || !ctx.projectId) return 'Work item context missing.'
      if (!ctx.createAsset) return 'Creating assets is not available in this context.'
      const type = input?.type === 'file' || input?.type === 'link' || input?.type === 'folder' ? input.type : 'file'
      try {
        const row = await ctx.createAsset(ctx.pool, ctx.projectId, {
          name,
          type,
          path: input?.path?.trim() ?? null,
          url: input?.url?.trim() ?? null,
          work_item_ids: [ctx.workItemId],
        })
        ctx.broadcaster.broadcastToAgent(ctx.agentId, 'stream_chunk', {
          chunk: `Asset "${row.name}" created and linked to work item (id: ${row.id}).`,
          type: 'content',
        })
        return `Asset "${row.name}" created and linked to work item (id: ${row.id}). Use this when you create a new file so it is tracked on the work item.`
      } catch (e) {
        console.error('[create_asset_and_link_to_work_item]', e)
        return e instanceof Error ? e.message : 'Failed to create asset.'
      }
    },
    {
      name: 'create_asset_and_link_to_work_item',
      description:
        'Create a new asset (e.g. for a file you just created with write_file) and link it to the current work item. Use name and type; optionally path for files or url for links. Use this when you create a new file so it is tracked as an asset on the work item.',
      schema: createAssetAndLinkSchema,
    }
  )

  return [
    updateStatus,
    addComment,
    listAgentsTool,
    createWorkItemAndAssign,
    requestForApproval,
    requestInfo,
    linkAssetToWorkItem,
    createAssetAndLinkToWorkItem,
  ]
}

export { WORK_ITEM_STATUS_VALUES }
