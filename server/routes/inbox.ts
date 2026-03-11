import { Router } from 'express'
import { listInboxItems, resolveApprovalRequest } from '../services/approval-requests.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateParams, validateQuery } from './validate.js'
import { paramId, queryInboxStatus } from './schemas.js'

export function createInboxRouter(deps: RouteDeps): Router {
  const router = Router()
  const { getPool, emit } = deps
  const pool = () => getPool()

  router.get(
    '/',
    validateQuery(queryInboxStatus),
    asyncHandler(async (req, res) => {
      const pendingOnly = req.query.status !== 'all'
      const rows = await listInboxItems(pool(), { pendingOnly })
      res.json(rows)
    })
  )

  router.patch(
    '/:id/approve',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await resolveApprovalRequest(pool(), req.params.id, 'approved')
      if (!row) throw notFound('Inbox item not found or already resolved')
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
    })
  )

  router.patch(
    '/:id/reject',
    validateParams(paramId),
    asyncHandler(async (req, res) => {
      const row = await resolveApprovalRequest(pool(), req.params.id, 'rejected')
      if (!row) throw notFound('Inbox item not found or already resolved')
      res.json(row)
    })
  )

  return router
}
