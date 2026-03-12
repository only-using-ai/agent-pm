import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { getPool, createPool, initDb } from './db.js'
import { startEmbeddedPostgres } from './embedded-postgres.js'
import { emit, on, setEnqueueFn, runHandlers } from './hooks.js'
import { enqueue, startProcessor } from './hook-queue.js'
import type { WorkItemCreatedPayload } from './hooks.js'
import {
  runAgentStream as runAgentStreamImpl,
  buildAgentPrompt,
  buildContextForWorkItemCreated,
  buildContextForWorkItemAssignmentChange,
  buildContextForWorkItemApproved,
  buildContextForWorkItemCommented,
} from './agent/index.js'
import type { AgentContext, ChatMessage } from './agent/types.js'
import { getAgentById, listAgents } from './services/agents.service.js'
import { getProjectById } from './services/projects.service.js'
import {
  getWorkItem,
  updateWorkItem as updateWorkItemService,
  addWorkItemComment as addWorkItemCommentService,
  createWorkItem as createWorkItemService,
} from './services/work-items.service.js'
import {
  createApprovalRequest as createApprovalRequestService,
  createInfoRequest as createInfoRequestService,
} from './services/approval-requests.service.js'
import {
  linkAssetToWorkItem as linkAssetToWorkItemService,
  createAsset as createAssetService,
} from './services/assets.service.js'
import { getPromptByKey } from './services/prompts.service.js'
import { getContextContent } from './services/context.service.js'
import { listMcpTools } from './services/mcp.service.js'
import { createSseBroadcaster } from './services/sse.service.js'
import { createWorkItemCreatedHandler } from './services/work-item-created-handler.js'
import { createWorkItemAssignmentChangeHandler } from './services/work-item-assignment-change-handler.js'
import { createWorkItemApprovedHandler } from './services/work-item-approved-handler.js'
import { createWorkItemCommentedHandler } from './services/work-item-commented-handler.js'
import { createWorkItemCancelHandler } from './services/work-item-cancel-handler.js'
import type { AgentStreamChunk } from './services/work-item-created-handler.js'
import { getServerPort, getDatabaseUrl } from './config.js'
import { errorMiddleware } from './errors.js'
import { setCancelRequested, isCancelRequested, clearCancelRequested } from './cancel-work-item.js'
import { mountRoutes } from './routes/index.js'

const app = express()
const PORT = getServerPort()
const pool = () => getPool()
const sse = createSseBroadcaster()
const upload = multer({ storage: multer.memoryStorage() })

function buildRunAgentStream() {
  return async function* (
    agent: Parameters<typeof runAgentStreamImpl>[0],
    context: Parameters<typeof runAgentStreamImpl>[1],
    options: Parameters<typeof runAgentStreamImpl>[2]
  ) {
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
  }
}

const runAgentStream = buildRunAgentStream()

const commonHandlerDeps = {
  getPool: pool,
  getAgentById,
  getPromptByKey,
  getContextContent,
  getInitialMessages: (agent: unknown, context: unknown) =>
    buildAgentPrompt(agent as Parameters<typeof buildAgentPrompt>[0], context as AgentContext),
  runAgentStream,
  isCancelRequested,
  clearCancelRequested,
  updateWorkItem: (p, projectId, workItemId, input) =>
    updateWorkItemService(p, projectId, workItemId, input as Parameters<typeof updateWorkItemService>[3]),
  addWorkItemComment: (p, projectId, workItemId, body, options) =>
    addWorkItemCommentService(p, projectId, workItemId, body, options as Parameters<typeof addWorkItemCommentService>[4]),
  listAgents: (p) => listAgents(p),
  createWorkItem: (p, projectId, input) =>
    createWorkItemService(p, projectId, input as Parameters<typeof createWorkItemService>[2]),
  emitWorkItemCreated: (payload: WorkItemCreatedPayload) => emit('work_item.created', payload),
  createApprovalRequest: async (p, input) => {
    const row = await createApprovalRequestService(p, input as Parameters<typeof createApprovalRequestService>[1])
    return { id: row.id }
  },
  createInfoRequest: async (p, input) => {
    const row = await createInfoRequestService(p, input as Parameters<typeof createInfoRequestService>[1])
    return { id: row.id }
  },
  linkAssetToWorkItem: (p, projectId, workItemId, assetId) =>
    linkAssetToWorkItemService(p, projectId, workItemId, assetId),
  createAsset: (p, projectId, input) =>
    createAssetService(p, projectId, input as Parameters<typeof createAssetService>[2]),
  broadcaster: sse,
}

on(
  'work_item.created',
  createWorkItemCreatedHandler({
    ...commonHandlerDeps,
    getProjectById,
    buildContextForWorkItemCreated,
  })
)

on(
  'work_item.assignment_change',
  createWorkItemAssignmentChangeHandler({
    ...commonHandlerDeps,
    getProjectById,
    buildContextForWorkItemAssignmentChange,
  })
)

on(
  'work_item.approved',
  createWorkItemApprovedHandler({
    ...commonHandlerDeps,
    getWorkItem,
    buildContextForWorkItemApproved,
  })
)

on(
  'work_item.commented',
  createWorkItemCommentedHandler({
    ...commonHandlerDeps,
    getProjectById,
    getWorkItem,
    buildContextForWorkItemCommented,
  })
)

on(
  'work_item.cancel',
  createWorkItemCancelHandler({
    getPool: pool,
    updateWorkItem: (p, projectId, workItemId, input) =>
      updateWorkItemService(p, projectId, workItemId, input as Parameters<typeof updateWorkItemService>[3]),
    broadcaster: sse,
  })
)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

mountRoutes(app, { getPool: pool, sse, emit, setCancelRequested, upload })

app.use(errorMiddleware)

async function start() {
  const connectionString = getDatabaseUrl()

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
