import { Router } from 'express'
import {
  listMcpTools,
  getMcpToolById,
  createMcpTool,
  updateMcpTool,
  deleteMcpTool,
} from '../services/mcp.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams } from './validate.js'
import {
  paramId,
  createMcpToolBody,
  updateMcpToolBody,
} from './schemas.js'

export function createMcpRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const rows = await listMcpTools(pool())
      res.json(rows)
    })
  )

  router.post(
    '/',
    validateBody(createMcpToolBody),
    asyncHandler(async (req, res) => {
      const row = await createMcpTool(pool(), {
        ...req.body,
        command: req.body.command ?? null,
        args: req.body.args ?? undefined,
        url: req.body.url ?? null,
        env: req.body.env ?? undefined,
        description: req.body.description ?? null,
      })
      res.status(201).json(row)
    })
  )

  router.get(
    '/:id',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await getMcpToolById(pool(), req.params.id)
      if (!row) throw notFound('MCP tool not found')
      res.json(row)
    })
  )

  router.patch(
    '/:id',
    validateParams(paramId),
    validateBody(updateMcpToolBody),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const updates = {
        ...(req.body.name !== undefined && { name: req.body.name }),
        ...(req.body.command !== undefined && { command: req.body.command }),
        ...(req.body.args !== undefined && { args: req.body.args }),
        ...(req.body.url !== undefined && { url: req.body.url }),
        ...(req.body.env !== undefined && { env: req.body.env }),
        ...(req.body.description !== undefined && { description: req.body.description }),
      }
      const row = await updateMcpTool(pool(), id, updates)
      if (!row) throw notFound('MCP tool not found')
      res.json(row)
    })
  )

  router.delete(
    '/:id',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const deleted = await deleteMcpTool(pool(), req.params.id)
      if (!deleted) throw notFound('MCP tool not found')
      res.status(204).send()
    })
  )

  return router
}
