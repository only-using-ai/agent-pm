import { Router } from 'express'
import {
  listColumns,
  createColumn,
  updateColumn,
  deleteColumn,
} from '../services/project-columns.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badRequest, notFound } from '../errors.js'
import { validateBody, validateParams } from './validate.js'
import {
  paramProjectId,
  paramProjectIdColumnId,
  createColumnBody,
  updateColumnBody,
} from './schemas.js'

export function createColumnsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router({ mergeParams: true })
  const pool = () => deps.getPool()

  router.get(
    '/',
    validateParams(paramProjectId),
    asyncHandler(async (req, res) => {
      const rows = await listColumns(pool(), req.params.projectId)
      res.json(rows)
    })
  )

  router.post(
    '/',
    validateParams(paramProjectId),
    validateBody(createColumnBody),
    asyncHandler(async (req, res) => {
      const { projectId } = req.params
      const row = await createColumn(pool(), projectId, req.body)
      res.status(201).json(row)
    })
  )

  router.patch(
    '/:columnId',
    validateParams(paramProjectIdColumnId),
    validateBody(updateColumnBody),
    asyncHandler(async (req, res) => {
      const { projectId, columnId } = req.params
      const row = await updateColumn(pool(), projectId, columnId, req.body)
      if (!row) throw notFound('Column not found')
      res.json(row)
    })
  )

  router.delete(
    '/:columnId',
    validateParams(paramProjectIdColumnId),
    asyncHandler(async (req, res) => {
      const { projectId, columnId } = req.params
      try {
        await deleteColumn(pool(), projectId, columnId)
        res.status(204).send()
      } catch (e) {
        if (e instanceof Error) {
          if (e.message === 'No columns found' || e.message === 'Column not found') throw notFound(e.message)
          if (e.message === 'Cannot delete the only column') throw badRequest(e.message)
        }
        throw e
      }
    })
  )

  return router
}
