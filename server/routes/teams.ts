import { Router } from 'express'
import { listTeams, createTeam } from '../services/teams.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler } from '../errors.js'
import { validateBody } from './validate.js'
import { createTeamBody } from './schemas.js'

export function createTeamsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const rows = await listTeams(pool())
      res.json(rows)
    })
  )

  router.post(
    '/',
    validateBody(createTeamBody),
    asyncHandler(async (req, res) => {
      const row = await createTeam(pool(), req.body.name)
      res.status(201).json(row)
    })
  )

  return router
}
