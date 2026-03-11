import { Router } from 'express'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
} from '../services/projects.service.js'
import type { UpdateProjectInput } from '../services/types.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams, validateQuery } from './validate.js'
import {
  createProjectBody,
  updateProjectBody,
  paramId,
  queryArchived,
} from './schemas.js'

/** Ensure API response always includes color and icon (for clients that expect them). */
function toProjectResponse(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    color: row.color ?? null,
    icon: row.icon ?? null,
  }
}

export function createProjectsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/',
    validateQuery(queryArchived),
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.archived === '1'
      const rows = await listProjects(pool(), { includeArchived })
      res.json(rows.map((r) => toProjectResponse(r as Record<string, unknown>)))
    })
  )

  router.get(
    '/:id',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await getProjectById(pool(), req.params.id)
      if (!row) throw notFound('Project not found')
      res.json(toProjectResponse(row as Record<string, unknown>))
    })
  )

  router.post(
    '/',
    validateBody(createProjectBody),
    asyncHandler(async (req, res) => {
      const row = await createProject(pool(), req.body)
      res.status(201).json(toProjectResponse(row as Record<string, unknown>))
    })
  )

  router.patch(
    '/:id',
    validateParams(paramId),
    validateBody(updateProjectBody),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const body = req.body as Record<string, unknown>
      const updatePayload: UpdateProjectInput = {}
      if (body.name !== undefined) updatePayload.name = body.name as string
      if (body.priority !== undefined) updatePayload.priority = body.priority as string | null
      if (body.description !== undefined) updatePayload.description = body.description as string | null
      if (body.path !== undefined) updatePayload.path = body.path as string | null
      if (body.project_context !== undefined) updatePayload.project_context = body.project_context as string | null
      if ('color' in body) updatePayload.color = body.color as string | null
      if ('icon' in body) updatePayload.icon = body.icon as string | null
      const row = await updateProject(pool(), id, updatePayload)
      if (!row) throw notFound('Project not found')
      res.json(toProjectResponse(row as Record<string, unknown>))
    })
  )

  router.patch(
    '/:id/archive',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await archiveProject(pool(), req.params.id)
      if (!row) throw notFound('Project not found or already archived')
      res.json(toProjectResponse(row as Record<string, unknown>))
    })
  )

  return router
}
