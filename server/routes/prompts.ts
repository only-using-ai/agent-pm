import { Router } from 'express'
import { getPromptByKey, listPrompts, updatePrompt } from '../services/prompts.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams } from './validate.js'
import { paramKey, updatePromptBody } from './schemas.js'

export function createPromptsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const rows = await listPrompts(pool())
      res.json(rows)
    })
  )

  router.get(
    '/:key',
    validateParams(paramKey),
    asyncHandler(async (req, res) => {
      const row = await getPromptByKey(pool(), req.params.key)
      if (!row) throw notFound('Prompt not found')
      res.json(row)
    })
  )

  router.patch(
    '/:key',
    validateParams(paramKey),
    validateBody(updatePromptBody),
    asyncHandler(async (req, res) => {
      const { key } = req.params
      const row = await updatePrompt(pool(), key, req.body)
      if (!row) throw notFound('Prompt not found')
      res.json(row)
    })
  )

  return router
}
