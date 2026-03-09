/**
 * Handler for work_item.created hook: when a work item is assigned to an agent,
 * load the agent, build context, run the deep agent stream (with context-bound tools),
 * and broadcast to SSE clients. The deep agent executes tools internally; no loop here.
 *
 * Thinking/reasoning tokens from the model are broadcast with type "thinking" so the
 * client can stream and display them in real time (see LangChain streaming docs).
 */

import type { Pool } from 'pg'
import type { WorkItemCreatedPayload } from '../hooks.js'
import type { AgentRow } from './types.js'
import type { SseBroadcaster } from './sse.service.js'

export type AgentStreamChunk =
  | { type: 'thinking'; text: string }
  | { type: 'content'; text: string }
  | { type: 'tool_call'; name: string; arguments: string | Record<string, unknown>; id?: string }

export type WorkItemCreatedHandlerDeps = {
  getPool: () => Pool
  getAgentById: (pool: Pool, id: string) => Promise<AgentRow | null>
  getPromptByKey: (pool: Pool, key: string) => Promise<{ content: string } | null>
  /** (agent, payload, options?) => context; options.template is the prompt content from DB when provided. */
  buildContextForWorkItemCreated: (
    agent: AgentRecordLike,
    payload: PayloadLike,
    options?: { template?: string | null }
  ) => unknown
  /** Returns initial messages for the agent (system + user). */
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
  emitWorkItemCreated: (payload: WorkItemCreatedPayload) => void
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

/** Minimal shape needed so we don't depend on agent/types in services. */
type AgentRecordLike = {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider?: string | null
  model?: string | null
}

type PayloadLike = WorkItemCreatedPayload

/**
 * Returns a hook handler for 'work_item.created' that runs the assigned agent and streams output.
 */
export function createWorkItemCreatedHandler(
  deps: WorkItemCreatedHandlerDeps
): (payload: WorkItemCreatedPayload) => Promise<void> {
  const {
    getPool,
    getAgentById,
    getPromptByKey,
    buildContextForWorkItemCreated,
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

  return async (payload: WorkItemCreatedPayload): Promise<void> => {
    if (!payload.assigned_to) return

    const agentId = payload.assigned_to
    const pool = getPool()
    const agent = await getAgentById(pool, agentId)
    if (!agent) return

    try {
      const promptContent = await getPromptByKey(pool, 'agent_system_prompt')
      const context = buildContextForWorkItemCreated(agent, payload, {
        template: promptContent?.content ?? null,
      })
      broadcaster.broadcastToAgent(agentId, 'stream_start', {
        work_item_id: payload.id,
        title: payload.title,
      })
      log(`[agent ${agent.name}] `)

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
      logError('[work_item.created] Agent stream error:', e)
      broadcaster.broadcastToAgent(agentId, 'stream_error', {
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
}
