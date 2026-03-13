import { Router } from 'express'
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  archiveAgent,
} from '../services/agents.service.js'
import { listWorkItemsByAgent } from '../services/work-items.service.js'
import { cancelPendingItemsForAgent } from '../hook-queue.js'
import { getCurrentWorkItemId } from '../agent-current-work.js'
import { fetchOllamaModels } from '../services/ollama.service.js'
import { fetchCursorModels } from '../services/cursor.service.js'
import { fetchGeminiModels } from '../services/gemini.service.js'
import { fetchAnthropicModels } from '../services/anthropic.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badGateway, notFound } from '../errors.js'
import { getOllamaBaseUrl } from '../config.js'
import { validateBody, validateParams, validateQuery } from './validate.js'
import {
  createAgentBody,
  updateAgentBody,
  paramId,
  queryArchived,
} from './schemas.js'

export function createAgentsRouter(deps: RouteDeps): Router {
  const router = Router()
  const { getPool, sse, setCancelRequested } = deps
  const pool = () => getPool()

  router.get('/stream-status', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    sse.registerStreamStatus(res)
  })

  router.get(
    '/',
    validateQuery(queryArchived),
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.archived === '1'
      const rows = await listAgents(pool(), { includeArchived })
      res.json(rows)
    })
  )

  router.post(
    '/',
    validateBody(createAgentBody),
    asyncHandler(async (req, res) => {
      const row = await createAgent(pool(), req.body)
      res.status(201).json(row)
    })
  )

  router.get(
    '/:id',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await getAgentById(pool(), req.params.id)
      if (!row) throw notFound('Agent not found')
      res.json(row)
    })
  )

  router.get(
    '/:id/work-items',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const agentId = req.params.id
      const agent = await getAgentById(pool(), agentId)
      if (!agent) throw notFound('Agent not found')
      const rows = await listWorkItemsByAgent(pool(), agentId)
      res.json(rows)
    })
  )

  router.post(
    '/:id/queue/clear',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const agentId = req.params.id
      const agent = await getAgentById(pool(), agentId)
      if (!agent) throw notFound('Agent not found')
      // Stop the currently running LangChain stream (handler checks isCancelRequested each chunk)
      const currentWorkItemId = getCurrentWorkItemId(agentId)
      if (currentWorkItemId && typeof setCancelRequested === 'function') setCancelRequested(currentWorkItemId)
      const cleared = await cancelPendingItemsForAgent(pool(), agentId)
      res.json({ cleared })
    })
  )

  router.patch(
    '/:id',
    validateParams(paramId),
    validateBody(updateAgentBody),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { name, team_id, instructions, ai_provider, model } = req.body
      const input = {
        ...(name !== undefined && { name }),
        ...(team_id !== undefined && { team_id }),
        ...(instructions !== undefined && { instructions }),
        ...(ai_provider !== undefined && { ai_provider }),
        ...(model !== undefined && { model }),
      }
      const row = await updateAgent(pool(), id, input)
      if (!row) throw notFound('Agent not found')
      res.json(row)
    })
  )

  router.patch(
    '/:id/archive',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await archiveAgent(pool(), req.params.id)
      if (!row) throw notFound('Agent not found or already archived')
      res.json(row)
    })
  )

  router.get('/:id/stream', validateParams(paramId), (req, res) => {
    const agentId = req.params.id
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    sse.registerAgentStream(agentId, res)
  })

  return router
}

export function createAiModelsRouter(_deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const OLLAMA_BASE = getOllamaBaseUrl()

  router.get(
    '/ollama/models',
    asyncHandler(async (_req, res) => {
      const result = await fetchOllamaModels(OLLAMA_BASE)
      if (result.ok) {
        return res.json({ models: result.models })
      }
      // When Ollama is unreachable or returns an error, surface an empty list
      // instead of a 502 so the UI can continue without showing an error.
      return res.json({ models: [] })
    })
  )

  router.get(
    '/cursor/models',
    asyncHandler(async (_req, res) => {
      const result = await fetchCursorModels()
      if (result.ok) return res.json({ models: result.models })
      throw badGateway(result.error ?? 'Cursor request failed', result.detail)
    })
  )

  router.get(
    '/gemini/models',
    asyncHandler(async (_req, res) => {
      const result = await fetchGeminiModels()
      if (result.ok) return res.json({ models: result.models })
      throw badGateway(result.error ?? 'Gemini request failed', result.detail)
    })
  )

  router.get(
    '/anthropic/models',
    asyncHandler(async (_req, res) => {
      const result = await fetchAnthropicModels()
      if (result.ok) return res.json({ models: result.models })
      throw badGateway(result.error ?? 'Anthropic request failed', result.detail)
    })
  )

  return router
}
