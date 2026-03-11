/**
 * Handler for work_item.commented hook: when a comment is saved with @-mentioned agents,
 * load the work item (with all comments), build context including WORK_ITEM_COMMENTS,
 * and run the agent for each mentioned agent. Same flow as work_item.created but with
 * comment-focused context.
 */

import type { Pool } from 'pg'
import type { WorkItemCommentedPayload } from '../hooks.js'
import type { AgentRow } from './types.js'
import type { SseBroadcaster } from './sse.service.js'
import type { WorkItemWithCommentsRow } from './types.js'

export type AgentStreamChunk =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; name: string; arguments: string | Record<string, unknown>; id?: string }

export type WorkItemCommentedHandlerDeps = {
  getPool: () => Pool
  getAgentById: (pool: Pool, id: string) => Promise<AgentRow | null>
  getProjectById: (pool: Pool, id: string) => Promise<{ project_context?: string | null } | null>
  getWorkItem: (pool: Pool, projectId: string, workItemId: string) => Promise<WorkItemWithCommentsRow | null>
  listAgents: (pool: Pool) => Promise<Array<{ id: string; name: string; team_id: string; instructions: string | null }>>
  getPromptByKey: (pool: Pool, key: string) => Promise<{ content: string } | null>
  getContextContent: () => Promise<string>
  buildContextForWorkItemCommented: (
    agent: AgentRecordLike,
    workItem: WorkItemWithCommentsForPromptLike,
    options?: { template?: string | null; areaContext?: string; projectContext?: string; agentNames?: Map<string, string> }
  ) => unknown
  getInitialMessages: (agent: AgentRecordLike, context: unknown) => unknown[]
  runAgentStream: (
    agent: AgentRecordLike,
    context: unknown,
    options?: { messages?: unknown[]; toolContext?: import('../agent/langchain-tools.js').WorkItemToolContext }
  ) => AsyncIterable<AgentStreamChunk>
  updateWorkItem: (
    pool: Pool,
    projectId: string,
    workItemId: string,
    input: { status: string }
  ) => Promise<unknown>
  addWorkItemComment: (
    pool: Pool,
    projectId: string,
    workItemId: string,
    body: string,
    options: { author_type: 'agent'; author_id: string }
  ) => Promise<unknown>
  createWorkItem: (
    pool: Pool,
    projectId: string,
    input: {
      title: string
      description?: string | null
      assigned_to?: string | null
      priority?: string
      depends_on?: string | null
      status?: string
    }
  ) => Promise<{ id: string; project_id: string; title: string; assigned_to: string | null; [key: string]: unknown }>
  createApprovalRequest?: (
    pool: Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
  createInfoRequest?: (
    pool: Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
  emitWorkItemCreated: (payload: import('../hooks.js').WorkItemCreatedPayload) => void
  broadcaster: SseBroadcaster
  log?: (message: string) => void
  logError?: (message: string, err: unknown) => void
}

type AgentRecordLike = {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider?: string | null
  model?: string | null
}

type WorkItemWithCommentsForPromptLike = {
  id: string
  project_id: string
  title: string | null
  description?: string | null
  priority?: string | null
  status?: string | null
  comments: Array<{ author_type: string; author_id: string | null; body: string; created_at: string }>
}

/**
 * Returns a hook handler for 'work_item.commented' that runs each @-mentioned agent
 * with context that includes all comments (WORK_ITEM_COMMENTS).
 */
export function createWorkItemCommentedHandler(
  deps: WorkItemCommentedHandlerDeps
): (payload: WorkItemCommentedPayload) => Promise<void> {
  const {
    getPool,
    getAgentById,
    getProjectById,
    getWorkItem,
    listAgents,
    getPromptByKey,
    getContextContent,
    buildContextForWorkItemCommented,
    getInitialMessages,
    runAgentStream,
    updateWorkItem,
    addWorkItemComment,
    createWorkItem,
    emitWorkItemCreated,
    createApprovalRequest,
    createInfoRequest,
    broadcaster,
    log = () => {},
    logError = () => {},
  } = deps

  return async (payload: WorkItemCommentedPayload): Promise<void> => {
    const pool = getPool()
    const workItem = await getWorkItem(pool, payload.project_id, payload.work_item_id)
    if (!workItem) return

    const agentNamesMap = new Map<string, string>()
    const agentsList = await listAgents(pool)
    for (const a of agentsList) {
      agentNamesMap.set(a.id, a.name)
    }

    const workItemForPrompt: WorkItemWithCommentsForPromptLike = {
      id: workItem.id,
      project_id: workItem.project_id,
      title: workItem.title,
      description: workItem.description,
      priority: workItem.priority,
      status: workItem.status,
      comments: (workItem.comments ?? []).map((c) => ({
        author_type: c.author_type,
        author_id: c.author_id,
        body: c.body,
        created_at: c.created_at,
      })),
    }

    for (const agentId of payload.mentioned_agent_ids) {
      const agent = await getAgentById(pool, agentId)
      if (!agent) continue

      try {
        const [promptContent, areaContext, project] = await Promise.all([
          getPromptByKey(pool, 'agent_system_prompt'),
          getContextContent(),
          getProjectById(pool, payload.project_id),
        ])
        const context = buildContextForWorkItemCommented(agent, workItemForPrompt, {
          template: promptContent?.content ?? null,
          areaContext,
          projectContext: project?.project_context ?? '',
          agentNames: agentNamesMap,
        })

        broadcaster.broadcastToAgent(agentId, 'stream_start', {
          work_item_id: payload.work_item_id,
          title: workItem.title,
        })
        log(`[agent ${agent.name}] work_item.commented`)

        const messages = getInitialMessages(agent, context)
        const toolContext = {
          pool,
          projectId: payload.project_id,
          workItemId: payload.work_item_id,
          agentId,
          broadcaster,
          updateWorkItem,
          addWorkItemComment,
          listAgents,
          createWorkItem,
          emitWorkItemCreated,
          createApprovalRequest,
          createInfoRequest,
        }

        for await (const chunk of runAgentStream(agent, context, {
          messages: messages as import('../agent/types.js').ChatMessage[],
          toolContext,
        })) {
          if (chunk.type === 'tool_call') {
            broadcaster.broadcastToAgent(agentId, 'stream_chunk', {
              chunk: `Tool: ${chunk.name}`,
              type: 'content',
            })
          } else if ('text' in chunk && chunk.text !== undefined) {
            broadcaster.broadcastToAgent(agentId, 'stream_chunk', {
              chunk: chunk.text,
              type: chunk.type === 'thinking' ? 'thinking' : 'content',
            })
          }
        }

        broadcaster.broadcastToAgent(agentId, 'stream_end', {})
      } catch (e) {
        logError('[work_item.commented] Agent stream error:', e)
        broadcaster.broadcastToAgent(agentId, 'stream_error', {
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }
}
