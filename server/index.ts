import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { getPool, createPool, initDb } from './db.js'
import { startEmbeddedPostgres } from './embedded-postgres.js'
import { emit, on, runHandlers, setEnqueueFn } from './hooks.js'
import { enqueue, startProcessor } from './hook-queue.js'
import type { WorkItemCreatedPayload, WorkItemAssignmentChangePayload } from './hooks.js'
import {
  runAgentStream as runAgentStreamImpl,
  buildAgentPrompt,
  buildContextForWorkItemCreated,
  buildContextForWorkItemAssignmentChange,
  buildContextForWorkItemApproved,
} from './agent/index.js'
import type { AgentContext, ChatMessage } from './agent/types.js'
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  archiveAgent,
} from './services/agents.service.js'
import { listTeams, createTeam } from './services/teams.service.js'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
} from './services/projects.service.js'
import {
  listColumns,
  createColumn,
  updateColumn,
  deleteColumn,
} from './services/project-columns.service.js'
import {
  listAllWorkItems,
  listWorkItemsByProject,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  archiveWorkItem,
  addWorkItemComment,
} from './services/work-items.service.js'
import {
  listInboxItems,
  resolveApprovalRequest,
  createApprovalRequest,
  createInfoRequest,
} from './services/approval-requests.service.js'
import { getPromptByKey, listPrompts, updatePrompt } from './services/prompts.service.js'
import {
  listMcpTools,
  getMcpToolById,
  createMcpTool,
  updateMcpTool,
  deleteMcpTool,
} from './services/mcp.service.js'
import { fetchOllamaModels } from './services/ollama.service.js'
import { fetchCursorModels } from './services/cursor.service.js'
import { fetchAnthropicModels } from './services/anthropic.service.js'
import { createSseBroadcaster } from './services/sse.service.js'
import { createWorkItemCreatedHandler } from './services/work-item-created-handler.js'
import { createWorkItemAssignmentChangeHandler } from './services/work-item-assignment-change-handler.js'
import { createWorkItemApprovedHandler } from './services/work-item-approved-handler.js'
import type { AgentStreamChunk } from './services/work-item-created-handler.js'
import {
  getContextContent,
  setContextContent,
  listContextFiles,
  saveContextFile,
  deleteContextFile,
} from './services/context.service.js'
import type {
  CreateAgentInput,
  UpdateAgentInput,
  UpdateMcpToolInput,
  UpdateWorkItemInput,
} from './services/types.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const pool = () => getPool()
const sse = createSseBroadcaster()

on(
  'work_item.created',
  createWorkItemCreatedHandler({
    getPool: pool,
    getAgentById,
    getPromptByKey,
    buildContextForWorkItemCreated,
    getInitialMessages: (agent, context) => buildAgentPrompt(agent, context as AgentContext),
    runAgentStream: async function* (agent, context, options) {
      let workspace: string | undefined
      if (options?.toolContext?.projectId) {
        const project = await getProjectById(pool(), options.toolContext.projectId)
        if (project?.path?.trim()) workspace = project.path.trim()
      }
      const mcpToolConfigs = await listMcpTools(pool())
      yield* runAgentStreamImpl(agent, context as AgentContext, {
        messages: options?.messages as ChatMessage[] | undefined,
        toolContext: options?.toolContext,
        mcpToolConfigs,
        workspace,
      }) as AsyncIterable<AgentStreamChunk>
    },
    updateWorkItem: (p, projectId, workItemId, input) =>
      updateWorkItem(p, projectId, workItemId, input),
    addWorkItemComment: (p, projectId, workItemId, body, options) =>
      addWorkItemComment(p, projectId, workItemId, body, options),
    listAgents: (p) => listAgents(p),
    createWorkItem: (p, projectId, input) => createWorkItem(p, projectId, input),
    emitWorkItemCreated: (payload: WorkItemCreatedPayload) => emit('work_item.created', payload),
    createApprovalRequest: async (p, input) => {
      const row = await createApprovalRequest(p, input)
      return { id: row.id }
    },
    createInfoRequest: async (p, input) => {
      const row = await createInfoRequest(p, input)
      return { id: row.id }
    },
    broadcaster: sse,
  })
)

on(
  'work_item.assignment_change',
  createWorkItemAssignmentChangeHandler({
    getPool: pool,
    getAgentById,
    getPromptByKey,
    buildContextForWorkItemAssignmentChange,
    getInitialMessages: (agent, context) => buildAgentPrompt(agent, context as AgentContext),
    runAgentStream: async function* (agent, context, options) {
      let workspace: string | undefined
      if (options?.toolContext?.projectId) {
        const project = await getProjectById(pool(), options.toolContext.projectId)
        if (project?.path?.trim()) workspace = project.path.trim()
      }
      const mcpToolConfigs = await listMcpTools(pool())
      yield* runAgentStreamImpl(agent, context as AgentContext, {
        messages: options?.messages as ChatMessage[] | undefined,
        toolContext: options?.toolContext,
        mcpToolConfigs,
        workspace,
      }) as AsyncIterable<AgentStreamChunk>
    },
    updateWorkItem: (p, projectId, workItemId, input) =>
      updateWorkItem(p, projectId, workItemId, input),
    addWorkItemComment: (p, projectId, workItemId, body, options) =>
      addWorkItemComment(p, projectId, workItemId, body, options),
    listAgents: (p) => listAgents(p),
    createWorkItem: (p, projectId, input) => createWorkItem(p, projectId, input),
    emitWorkItemCreated: (payload: WorkItemCreatedPayload) => emit('work_item.created', payload),
    createApprovalRequest: async (p, input) => {
      const row = await createApprovalRequest(p, input)
      return { id: row.id }
    },
    createInfoRequest: async (p, input) => {
      const row = await createInfoRequest(p, input)
      return { id: row.id }
    },
    broadcaster: sse,
  })
)

on(
  'work_item.approved',
  createWorkItemApprovedHandler({
    getPool: pool,
    getAgentById,
    getWorkItem: (p, projectId, workItemId) => getWorkItem(p, projectId, workItemId),
    buildContextForWorkItemApproved,
    getInitialMessages: (agent, context) => buildAgentPrompt(agent, context as AgentContext),
    runAgentStream: async function* (agent, context, options) {
      let workspace: string | undefined
      if (options?.toolContext?.projectId) {
        const project = await getProjectById(pool(), options.toolContext.projectId)
        if (project?.path?.trim()) workspace = project.path.trim()
      }
      const mcpToolConfigs = await listMcpTools(pool())
      yield* runAgentStreamImpl(agent, context as AgentContext, {
        messages: options?.messages as ChatMessage[] | undefined,
        toolContext: options?.toolContext,
        mcpToolConfigs,
        workspace,
      }) as AsyncIterable<AgentStreamChunk>
    },
    updateWorkItem: (p, projectId, workItemId, input) =>
      updateWorkItem(p, projectId, workItemId, input),
    addWorkItemComment: (p, projectId, workItemId, body, options) =>
      addWorkItemComment(p, projectId, workItemId, body, options),
    listAgents: (p) => listAgents(p),
    createWorkItem: (p, projectId, input) => createWorkItem(p, projectId, input),
    emitWorkItemCreated: (payload: WorkItemCreatedPayload) => emit('work_item.created', payload),
    createApprovalRequest: async (p, input) => {
      const row = await createApprovalRequest(p, input)
      return { id: row.id }
    },
    createInfoRequest: async (p, input) => {
      const row = await createInfoRequest(p, input)
      return { id: row.id }
    },
    broadcaster: sse,
  })
)

const upload = multer({ storage: multer.memoryStorage() })

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Agents
app.get('/api/agents', async (req, res) => {
  try {
    const includeArchived = req.query.archived === '1'
    const rows = await listAgents(pool(), { includeArchived })
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list agents' })
  }
})

app.post('/api/agents', async (req, res) => {
  const { name, team_id, instructions, ai_provider, model } = req.body
  if (!name || !team_id) {
    return res.status(400).json({ error: 'name and team_id are required' })
  }
  try {
    const input: CreateAgentInput = {
      name,
      team_id,
      instructions: instructions ?? null,
      ai_provider,
      model,
    }
    const row = await createAgent(pool(), input)
    res.status(201).json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create agent' })
  }
})

app.get('/api/agents/stream-status', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  sse.registerStreamStatus(res)
})

app.get('/api/agents/:id', async (req, res) => {
  try {
    const row = await getAgentById(pool(), req.params.id)
    if (!row) return res.status(404).json({ error: 'Agent not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch agent' })
  }
})

app.patch('/api/agents/:id', async (req, res) => {
  const { id } = req.params
  const { name, team_id, instructions, ai_provider, model } = req.body
  try {
    const input: UpdateAgentInput = {
      ...(name !== undefined && { name }),
      ...(team_id !== undefined && { team_id }),
      ...(instructions !== undefined && { instructions }),
      ...(ai_provider !== undefined && { ai_provider }),
      ...(model !== undefined && { model }),
    }
    if (Object.keys(input).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    const row = await updateAgent(pool(), id, input)
    if (!row) return res.status(404).json({ error: 'Agent not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update agent' })
  }
})

app.patch('/api/agents/:id/archive', async (req, res) => {
  try {
    const row = await archiveAgent(pool(), req.params.id)
    if (!row) {
      return res.status(404).json({ error: 'Agent not found or already archived' })
    }
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to archive agent' })
  }
})

app.get('/api/agents/:id/stream', (req, res) => {
  const agentId = req.params.id
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  sse.registerAgentStream(agentId, res)
})

const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434'
app.get('/api/ollama/models', async (_req, res) => {
  const result = await fetchOllamaModels(OLLAMA_BASE)
  if (result.ok) {
    return res.json({ models: result.models })
  }
  res.status(502).json({
    error: result.error,
    detail: result.detail,
  })
})

app.get('/api/cursor/models', async (_req, res) => {
  const result = await fetchCursorModels()
  if (result.ok) {
    return res.json({ models: result.models })
  }
  res.status(502).json({
    error: result.error,
    detail: result.detail,
  })
})

app.get('/api/anthropic/models', async (_req, res) => {
  const result = await fetchAnthropicModels()
  if (result.ok) {
    return res.json({ models: result.models })
  }
  res.status(502).json({
    error: result.error,
    detail: result.detail,
  })
})

// Teams
app.get('/api/teams', async (_req, res) => {
  try {
    const rows = await listTeams(pool())
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list teams' })
  }
})

app.post('/api/teams', async (req, res) => {
  const { name } = req.body
  try {
    const row = await createTeam(pool(), name)
    res.status(201).json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'name is required') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to create team' })
  }
})

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    const includeArchived = req.query.archived === '1'
    const rows = await listProjects(pool(), { includeArchived })
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

app.get('/api/projects/:id', async (req, res) => {
  try {
    const row = await getProjectById(pool(), req.params.id)
    if (!row) return res.status(404).json({ error: 'Project not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

app.post('/api/projects', async (req, res) => {
  const { name, priority, description, path } = req.body
  try {
    const row = await createProject(pool(), { name, priority, description, path })
    res.status(201).json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'name is required') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

app.patch('/api/projects/:id', async (req, res) => {
  const { id } = req.params
  const { name, priority, description, path } = req.body
  try {
    const row = await updateProject(pool(), id, { name, priority, description, path })
    if (!row) return res.status(404).json({ error: 'Project not found' })
    res.json(row)
  } catch (e) {
    if (e instanceof Error && (e.message === 'name must be a non-empty string' || e.message === 'name is required')) {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

app.patch('/api/projects/:id/archive', async (req, res) => {
  try {
    const row = await archiveProject(pool(), req.params.id)
    if (!row) {
      return res.status(404).json({ error: 'Project not found or already archived' })
    }
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to archive project' })
  }
})

// Project columns
app.get('/api/projects/:projectId/columns', async (req, res) => {
  try {
    const rows = await listColumns(pool(), req.params.projectId)
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list columns' })
  }
})

app.post('/api/projects/:projectId/columns', async (req, res) => {
  const { projectId } = req.params
  const { title, color } = req.body
  try {
    const row = await createColumn(pool(), projectId, { title, color })
    res.status(201).json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'title is required') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to create column' })
  }
})

app.patch('/api/projects/:projectId/columns/:columnId', async (req, res) => {
  const { projectId, columnId } = req.params
  const { title, color } = req.body
  try {
    const row = await updateColumn(pool(), projectId, columnId, { title, color })
    if (!row) return res.status(404).json({ error: 'Column not found' })
    res.json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'title cannot be empty') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to update column' })
  }
})

app.delete('/api/projects/:projectId/columns/:columnId', async (req, res) => {
  const { projectId, columnId } = req.params
  try {
    await deleteColumn(pool(), projectId, columnId)
    res.status(204).send()
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'No columns found' || e.message === 'Column not found') {
        return res.status(404).json({ error: e.message })
      }
      if (e.message === 'Cannot delete the only column') {
        return res.status(400).json({ error: e.message })
      }
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to delete column' })
  }
})

// MCP tools
app.get('/api/mcp', async (_req, res) => {
  try {
    const rows = await listMcpTools(pool())
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list MCP tools' })
  }
})

app.post('/api/mcp', async (req, res) => {
  const { name, type, command, args, url, env, description } = req.body
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' })
  }
  if (type !== 'command' && type !== 'url') {
    return res.status(400).json({ error: 'type must be command or url' })
  }
  try {
    const row = await createMcpTool(pool(), {
      name,
      type,
      command: command ?? null,
      args: Array.isArray(args) ? args : undefined,
      url: url ?? null,
      env: env && typeof env === 'object' ? env : undefined,
      description: description ?? null,
    })
    res.status(201).json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create MCP tool' })
  }
})

app.get('/api/mcp/:id', async (req, res) => {
  try {
    const row = await getMcpToolById(pool(), req.params.id)
    if (!row) return res.status(404).json({ error: 'MCP tool not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch MCP tool' })
  }
})

app.patch('/api/mcp/:id', async (req, res) => {
  const { id } = req.params
  const { name, command, args, url, env, description } = req.body
  try {
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (command !== undefined) updates.command = command
    if (args !== undefined) updates.args = args
    if (url !== undefined) updates.url = url
    if (env !== undefined) updates.env = env
    if (description !== undefined) updates.description = description
    const row = await updateMcpTool(pool(), id, updates as UpdateMcpToolInput)
    if (!row) return res.status(404).json({ error: 'MCP tool not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update MCP tool' })
  }
})

app.delete('/api/mcp/:id', async (req, res) => {
  try {
    const deleted = await deleteMcpTool(pool(), req.params.id)
    if (!deleted) return res.status(404).json({ error: 'MCP tool not found' })
    res.status(204).send()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete MCP tool' })
  }
})

// Work items (all)
app.get('/api/work-items', async (req, res) => {
  try {
    const includeArchived = req.query.archived === '1'
    const rows = await listAllWorkItems(pool(), { includeArchived })
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list work items' })
  }
})

// Work items (by project)
app.get('/api/projects/:projectId/work-items', async (req, res) => {
  try {
    const includeArchived = req.query.archived === '1'
    const rows = await listWorkItemsByProject(
      pool(),
      req.params.projectId,
      { includeArchived }
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list work items' })
  }
})

app.get('/api/projects/:projectId/work-items/:id', async (req, res) => {
  try {
    const row = await getWorkItem(
      pool(),
      req.params.projectId,
      req.params.id
    )
    if (!row) return res.status(404).json({ error: 'Work item not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch work item' })
  }
})

app.post('/api/projects/:projectId/work-items', async (req, res) => {
  const { projectId } = req.params
  const { title, description, assigned_to, priority, depends_on, status, require_approval } =
    req.body
  try {
    const row = await createWorkItem(pool(), projectId, {
      title,
      description,
      assigned_to,
      priority,
      depends_on,
      status,
      require_approval,
    })
    if (row.require_approval) {
      await createApprovalRequest(pool(), {
        work_item_id: row.id,
        project_id: row.project_id,
        agent_id: row.assigned_to ?? null,
        agent_name: 'System',
        body: `Approval required to proceed with: ${row.title}`,
      })
    }
    emit('work_item.created', row)
    res.status(201).json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'title is required') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to create work item' })
  }
})

app.patch('/api/projects/:projectId/work-items/:id', async (req, res) => {
  const { projectId, id } = req.params
  const { title, description, assigned_to, priority, depends_on, status, require_approval } =
    req.body
  const updates: UpdateWorkItemInput = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (assigned_to !== undefined) updates.assigned_to = assigned_to
  if (priority !== undefined) updates.priority = priority
  if (depends_on !== undefined) updates.depends_on = depends_on
  if (status !== undefined) updates.status = status
  if (require_approval !== undefined) updates.require_approval = require_approval
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }
  try {
    const row = await updateWorkItem(pool(), projectId, id, updates)
    if (!row) return res.status(404).json({ error: 'Work item not found' })
    if (updates.assigned_to !== undefined && row.assigned_to) {
      emit('work_item.assignment_change', row as WorkItemAssignmentChangePayload)
    }
    res.json(row)
  } catch (e) {
    if (e instanceof Error && e.message === 'No fields to update') {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    res.status(500).json({ error: 'Failed to update work item' })
  }
})

app.patch('/api/projects/:projectId/work-items/:id/archive', async (req, res) => {
  try {
    const row = await archiveWorkItem(
      pool(),
      req.params.projectId,
      req.params.id
    )
    if (!row) {
      return res
        .status(404)
        .json({ error: 'Work item not found or already archived' })
    }
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to archive work item' })
  }
})

// Inbox (approval requests)
app.get('/api/inbox', async (_req, res) => {
  try {
    const pendingOnly = _req.query.status !== 'all'
    const rows = await listInboxItems(pool(), { pendingOnly })
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list inbox' })
  }
})

app.patch('/api/inbox/:id/approve', async (req, res) => {
  try {
    const row = await resolveApprovalRequest(pool(), req.params.id, 'approved')
    if (!row) return res.status(404).json({ error: 'Inbox item not found or already resolved' })
    if (row.type === 'approval') {
      emit('work_item.approved', {
        work_item_id: row.work_item_id,
        project_id: row.project_id,
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        body: row.body,
      })
    }
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to approve' })
  }
})

app.patch('/api/inbox/:id/reject', async (req, res) => {
  try {
    const row = await resolveApprovalRequest(pool(), req.params.id, 'rejected')
    if (!row) return res.status(404).json({ error: 'Inbox item not found or already resolved' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to reject' })
  }
})

// Context (additional context markdown + files in .agent-pm)
app.get('/api/context', async (_req, res) => {
  try {
    const content = await getContextContent()
    res.json({ content })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load context' })
  }
})

app.patch('/api/context', async (req, res) => {
  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' })
  }
  try {
    await setContextContent(content)
    res.json({ content })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to save context' })
  }
})

app.get('/api/context/files', async (_req, res) => {
  try {
    const files = await listContextFiles()
    res.json({ files })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list context files' })
  }
})

app.post('/api/context/files', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  try {
    const entry = await saveContextFile(req.file.originalname, req.file.buffer)
    res.status(201).json(entry)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to save file' })
  }
})

app.delete('/api/context/files/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)
  try {
    const deleted = await deleteContextFile(name)
    if (!deleted) return res.status(404).json({ error: 'File not found' })
    res.status(204).send()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Prompts (settings)
app.get('/api/prompts', async (_req, res) => {
  try {
    const rows = await listPrompts(pool())
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list prompts' })
  }
})

app.get('/api/prompts/:key', async (req, res) => {
  try {
    const row = await getPromptByKey(pool(), req.params.key)
    if (!row) return res.status(404).json({ error: 'Prompt not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch prompt' })
  }
})

app.patch('/api/prompts/:key', async (req, res) => {
  const { key } = req.params
  const { name, content } = req.body
  try {
    const row = await updatePrompt(pool(), key, { name, content })
    if (!row) return res.status(404).json({ error: 'Prompt not found' })
    res.json(row)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update prompt' })
  }
})

app.post(
  '/api/projects/:projectId/work-items/:id/comments',
  async (req, res) => {
    const { projectId, id } = req.params
    const { body, author_type, author_id } = req.body
    try {
      const comment = await addWorkItemComment(
        pool(),
        projectId,
        id,
        body,
        { author_type, author_id }
      )
      emit('work_item.comment', {
        comment,
        work_item_id: id,
        project_id: projectId,
      })
      res.status(201).json(comment)
    } catch (e) {
      if (e instanceof Error && e.message === 'body is required') {
        return res.status(400).json({ error: e.message })
      }
      if (e instanceof Error && e.message === 'Work item not found') {
        return res.status(404).json({ error: e.message })
      }
      console.error(e)
      res.status(500).json({ error: 'Failed to add comment' })
    }
  }
)

async function start() {
  const connectionString = process.env.DATABASE_URL

  if (connectionString) {
    console.log('Using external PostgreSQL (DATABASE_URL)')
    const p = createPool(connectionString)
    const maxAttempts = 30
    const delayMs = 1000
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await initDb(p)
        console.log('Database tables ready')
        break
      } catch (e) {
        if (attempt === maxAttempts) {
          console.error('Database init failed after retries:', e)
          process.exit(1)
        }
        console.log(`Waiting for Postgres (attempt ${attempt}/${maxAttempts})...`)
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  } else {
    await startEmbeddedPostgres()
  }

  const p = pool()
  setEnqueueFn((event, payload) => enqueue(p, event, payload))
  startProcessor(pool, runHandlers)

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}

start()
