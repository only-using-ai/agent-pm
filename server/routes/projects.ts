import { Router } from 'express'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
} from '../services/projects.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams, validateQuery } from './validate.js'
import {
  createProjectBody,
  updateProjectBody,
  paramId,
  queryArchived,
} from './schemas.js'

export function createProjectsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/',
    validateQuery(queryArchived),
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.archived === '1'
      const rows = await listProjects(pool(), { includeArchived })
      res.json(rows)
    })
  )

  router.get(
    '/:id',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await getProjectById(pool(), req.params.id)
      if (!row) throw notFound('Project not found')
      res.json(row)
    })
  )

  router.post(
    '/',
    validateBody(createProjectBody),
    asyncHandler(async (req, res) => {
      const row = await createProject(pool(), req.body)
      res.status(201).json(row)
    })
  )

  router.patch(
    '/:id',
    validateParams(paramId),
    validateBody(updateProjectBody),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const row = await updateProject(pool(), id, req.body)
      if (!row) throw notFound('Project not found')
      res.json(row)
    })
  )

  router.patch(
    '/:id/archive',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await archiveProject(pool(), req.params.id)
      if (!row) throw notFound('Project not found or already archived')
      res.json(row)
    })
  )

  return router
}
