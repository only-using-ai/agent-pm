/**
 * Handler for work_item.assignment_change hook: when a work item's assignment
 * changes to an agent, load that agent, build context, run the agent stream,
 * and broadcast to SSE clients. Same flow as work_item.created but with
 * reassignment-focused prompt.
 */

import type { Pool } from 'pg'
import type { WorkItemAssignmentChangePayload } from '../hooks.js'
import type { AgentRow } from './types.js'
import type { SseBroadcaster } from './sse.service.js'

export type AgentStreamChunk =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; name: string; arguments: string | Record<string, unknown>; id?: string }

export type WorkItemAssignmentChangeHandlerDeps = {
  getPool: () => Pool
  getAgentById: (pool: Pool, id: string) => Promise<AgentRow | null>
  getPromptByKey: (pool: Pool, key: string) => Promise<{ content: string } | null>
  buildContextForWorkItemAssignmentChange: (
    agent: AgentRecordLike,
    payload: WorkItemAssignmentChangePayload,
    options?: { template?: string | null }
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

/**
 * Returns a hook handler for 'work_item.assignment_change' that runs the newly
 * assigned agent and streams output.
 */
export function createWorkItemAssignmentChangeHandler(
  deps: WorkItemAssignmentChangeHandlerDeps
): (payload: WorkItemAssignmentChangePayload) => Promise<void> {
  const {
    getPool,
    getAgentById,
    getPromptByKey,
    buildContextForWorkItemAssignmentChange,
    getInitialMessages,
    runAgentStream,
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

  return async (payload: WorkItemAssignmentChangePayload): Promise<void> => {
    if (!payload.assigned_to) return

    const agentId = payload.assigned_to
    const pool = getPool()
    const agent = await getAgentById(pool, agentId)
    if (!agent) return

    try {
      const promptContent = await getPromptByKey(pool, 'agent_system_prompt')
      const context = buildContextForWorkItemAssignmentChange(agent, payload, {
        template: promptContent?.content ?? null,
      })
      broadcaster.broadcastToAgent(agentId, 'stream_start', {
        work_item_id: payload.id,
        title: payload.title,
      })
      log(`[agent ${agent.name}] work_item.assignment_change`)

      const messages = getInitialMessages(agent, context)
      const toolContext =
        payload.id && payload.project_id
          ? {
              pool,
              projectId: payload.project_id,
              workItemId: payload.id,
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
          : undefined

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
      logError('[work_item.assignment_change] Agent stream error:', e)
      broadcaster.broadcastToAgent(agentId, 'stream_error', {
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
}
