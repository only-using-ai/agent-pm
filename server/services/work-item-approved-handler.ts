/**
 * Handler for work_item.approved hook: when a user approves an approval request in the Inbox,
 * the assigned agent is triggered to continue with the work item. Loads the agent and work item,
 * builds context indicating approval, runs the agent stream, and broadcasts to SSE clients.
 */

import type { Pool } from 'pg'
import type { WorkItemApprovedPayload } from '../hooks.js'
import type { AgentRow } from './types.js'
import type { SseBroadcaster } from './sse.service.js'

export type AgentStreamChunk =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; name: string; arguments: string | Record<string, unknown>; id?: string }

export type WorkItemApprovedHandlerDeps = {
  getPool: () => Pool
  getAgentById: (pool: Pool, id: string) => Promise<AgentRow | null>
  getWorkItem: (
    pool: Pool,
    projectId: string,
    workItemId: string
  ) => Promise<{
    id: string
    project_id: string
    title: string | null
    description: string | null
    assigned_to: string | null
    priority: string
    depends_on: string | null
    status: string
    require_approval: boolean
    archived_at: string | null
    created_at: string
    updated_at: string
  } | null>
  buildContextForWorkItemApproved: (
    agent: AgentRecordLike,
    workItem: WorkItemRowLike,
    options: { approvalBody: string }
  ) => unknown
  getInitialMessages: (agent: AgentRecordLike, context: unknown) => unknown[]
  runAgentStream: (
    agent: AgentRecordLike,
    context: unknown,
    options?: { messages?: unknown[]; toolContext?: import('../agent/langchain-tools.js').WorkItemToolContext }
  ) => AsyncIterable<AgentStreamChunk>
  isCancelRequested: (workItemId: string) => boolean
  clearCancelRequested: (workItemId: string) => void
  setCurrentWorkItem: (agentId: string, workItemId: string) => void
  clearCurrentWorkItem: (agentId: string) => void
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
  listAgents: (pool: Pool) => Promise<Array<{ id: string; name: string; team_id: string; instructions: string | null }>>
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
  emitWorkItemCreated: (payload: import('../hooks.js').WorkItemCreatedPayload) => void
  createApprovalRequest?: (
    pool: Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
  createInfoRequest?: (
    pool: Pool,
    input: { work_item_id: string; project_id?: string; agent_id: string | null; agent_name: string; body: string }
  ) => Promise<{ id: string }>
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

type WorkItemRowLike = {
  id: string
  project_id: string
  title: string | null
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

/**
 * Returns a hook handler for 'work_item.approved' that runs the agent to continue the work item.
 */
export function createWorkItemApprovedHandler(
  deps: WorkItemApprovedHandlerDeps
): (payload: WorkItemApprovedPayload) => Promise<void> {
  const {
    getPool,
    getAgentById,
    getWorkItem,
    buildContextForWorkItemApproved,
    getInitialMessages,
    runAgentStream,
    isCancelRequested,
    clearCancelRequested,
    setCurrentWorkItem,
    clearCurrentWorkItem,
    updateWorkItem,
    addWorkItemComment,
    listAgents,
    createWorkItem,
    emitWorkItemCreated,
    createApprovalRequest,
    createInfoRequest,
    broadcaster,
    log = (...args: unknown[]) => {
      console.log('log', ...args)
    },
    logError = (msg, e) => {
      console.error('logError', msg, e)
    },
  } = deps

  return async (payload: WorkItemApprovedPayload): Promise<void> => {
    if (!payload.agent_id) return

    const pool = getPool()
    const [agent, workItem] = await Promise.all([
      getAgentById(pool, payload.agent_id),
      getWorkItem(pool, payload.project_id, payload.work_item_id),
    ])

    if (!agent || !workItem || workItem.archived_at) return

    setCurrentWorkItem(payload.agent_id, payload.work_item_id)
    try {
      const context = buildContextForWorkItemApproved(agent, workItem as WorkItemRowLike, {
        approvalBody: payload.body,
      })
      broadcaster.broadcastToAgent(payload.agent_id, 'stream_start', {
        work_item_id: payload.work_item_id,
        title: workItem.title,
      })
      log(`[agent ${agent.name}] work_item.approved – continuing`)

      const messages = getInitialMessages(agent, context)
      const toolContext = {
        pool,
        projectId: payload.project_id,
        workItemId: payload.work_item_id,
        agentId: payload.agent_id,
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
        if (isCancelRequested(payload.work_item_id)) {
          clearCancelRequested(payload.work_item_id)
          break
        }
        if (chunk.type === 'tool_call') {
          broadcaster.broadcastToAgent(payload.agent_id, 'stream_chunk', {
            chunk: `Tool: ${chunk.name}`,
            type: 'content',
          })
        } else if ('text' in chunk && chunk.text !== undefined) {
          broadcaster.broadcastToAgent(payload.agent_id, 'stream_chunk', {
            chunk: chunk.text,
            type: chunk.type === 'thinking' ? 'thinking' : 'content',
          })
        }
      }

      clearCancelRequested(payload.work_item_id)
      broadcaster.broadcastToAgent(payload.agent_id, 'stream_end', {})
    } catch (e) {
      logError('[work_item.approved] Agent stream error:', e)
      broadcaster.broadcastToAgent(payload.agent_id, 'stream_error', {
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      clearCurrentWorkItem(payload.agent_id)
    }
  }
}
