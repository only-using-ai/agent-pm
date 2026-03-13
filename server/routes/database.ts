import { Router } from 'express'
import {
  listTables,
  executeReadOnlyQuery,
  deleteRow,
} from '../services/database.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badRequest } from '../errors.js'
import { validateBody } from './validate.js'
import { z } from 'zod'

const executeQueryBody = z.object({
  query: z.string().min(1, 'Query is required'),
})

const deleteRowBody = z.object({
  table_schema: z.string().min(1, 'Table schema is required'),
  table_name: z.string().min(1, 'Table name is required'),
  row: z.record(z.unknown()),
})

export function createDatabaseRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router()
  const pool = () => deps.getPool()

  router.get(
    '/tables',
    asyncHandler(async (_req, res) => {
      const tables = await listTables(pool())
      res.json({ tables })
    })
  )

  router.post(
    '/query',
    validateBody(executeQueryBody),
    asyncHandler(async (req, res, next) => {
      const { query } = req.body as z.infer<typeof executeQueryBody>
      try {
        const { columns, rows } = await executeReadOnlyQuery(pool(), query)
        res.json({ columns, rows })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Query failed'
        next(badRequest(message))
      }
    })
  )

  router.post(
    '/delete-row',
    validateBody(deleteRowBody),
    asyncHandler(async (req, res, next) => {
      const { table_schema, table_name, row } = req.body as z.infer<
        typeof deleteRowBody
      >
      try {
        await deleteRow(pool(), table_schema, table_name, row)
        res.status(204).send()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed'
        next(badRequest(message))
      }
    })
  )

  return router
}
