import { Router } from 'express'
import {
  listAllWorkItems,
  listWorkItemsByProject,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  archiveWorkItem,
  addWorkItemComment,
} from '../services/work-items.service.js'
import { createApprovalRequest } from '../services/approval-requests.service.js'
import type { WorkItemAssignmentChangePayload } from '../hooks.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams, validateQuery } from './validate.js'
import {
  queryArchived,
  paramProjectId,
  paramProjectIdId,
  createWorkItemBody,
  updateWorkItemBody,
  addCommentBody,
} from './schemas.js'

export function createWorkItemsRouter(deps: RouteDeps): Router {
  const router = Router({ mergeParams: true })
  const { getPool } = deps
  const pool = () => getPool()

  // Mounted at /api/work-items (no projectId)
  router.get(
    '/',
    validateQuery(queryArchived),
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.archived === '1'
      const rows = await listAllWorkItems(pool(), { includeArchived })
      res.json(rows)
    })
  )

  return router
}

export function createProjectWorkItemsRouter(deps: RouteDeps): Router {
  const router = Router({ mergeParams: true })
  const { getPool, emit } = deps
  const pool = () => getPool()

  router.get(
    '/',
    validateParams(paramProjectId),
    validateQuery(queryArchived),
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.archived === '1'
      const rows = await listWorkItemsByProject(pool(), req.params.projectId, { includeArchived })
      res.json(rows)
    })
  )

  router.get(
    '/:id',
    validateParams(paramProjectIdId),
    asyncHandler(async (req, res) => {
      const row = await getWorkItem(pool(), req.params.projectId, req.params.id)
      if (!row) throw notFound('Work item not found')
      res.json(row)
    })
  )

  router.post(
    '/',
    validateParams(paramProjectId),
    validateBody(createWorkItemBody),
    asyncHandler(async (req, res) => {
      const { projectId } = req.params
      const row = await createWorkItem(pool(), projectId, req.body)
      if (row.require_approval) {
        await createApprovalRequest(pool(), {
          work_item_id: row.id,
          project_id: row.project_id,
          agent_id: row.assigned_to ?? null,
          agent_name: 'System',
          body: `Approval required to proceed with: ${row.title}`,
        })
      }
      emit('work_item.created', row)
      res.status(201).json(row)
    })
  )

  router.patch(
    '/:id',
    validateParams(paramProjectIdId),
    validateBody(updateWorkItemBody),
    asyncHandler(async (req, res) => {
      const { projectId, id } = req.params
      const updates = {
        ...(req.body.title !== undefined && { title: req.body.title }),
        ...(req.body.description !== undefined && { description: req.body.description }),
        ...(req.body.assigned_to !== undefined && { assigned_to: req.body.assigned_to }),
        ...(req.body.priority !== undefined && { priority: req.body.priority }),
        ...(req.body.depends_on !== undefined && { depends_on: req.body.depends_on }),
        ...(req.body.status !== undefined && { status: req.body.status }),
        ...(req.body.require_approval !== undefined && { require_approval: req.body.require_approval }),
        ...(req.body.work_item_type !== undefined && { work_item_type: req.body.work_item_type }),
        ...(req.body.asset_ids !== undefined && { asset_ids: req.body.asset_ids }),
      }
      const row = await updateWorkItem(pool(), projectId, id, updates)
      if (!row) throw notFound('Work item not found')
      if (updates.assigned_to !== undefined && row.assigned_to) {
        emit('work_item.assignment_change', row as WorkItemAssignmentChangePayload)
      }
      res.json(row)
    })
  )

  router.patch(
    '/:id/archive',
    validateParams(paramProjectIdId),
    asyncHandler(async (req, res) => {
      const row = await archiveWorkItem(pool(), req.params.projectId, req.params.id)
      if (!row) throw notFound('Work item not found or already archived')
      res.json(row)
    })
  )

  router.post(
    '/:id/comments',
    validateParams(paramProjectIdId),
    validateBody(addCommentBody),
    asyncHandler(async (req, res) => {
      const { projectId, id } = req.params
      const { body, author_type, author_id, mentioned_agent_ids } = req.body
      const comment = await addWorkItemComment(pool(), projectId, id, body, {
        author_type,
        author_id,
        mentioned_agent_ids,
      })
      emit('work_item.comment', {
        comment,
        work_item_id: id,
        project_id: projectId,
      })
      const mentionedIds = Array.isArray(comment.mentioned_agent_ids)
        ? comment.mentioned_agent_ids
        : []
      if (mentionedIds.length > 0) {
        emit('work_item.commented', {
          comment,
          work_item_id: id,
          project_id: projectId,
          mentioned_agent_ids: mentionedIds,
        })
      }
      res.status(201).json(comment)
    })
  )

  return router
}
