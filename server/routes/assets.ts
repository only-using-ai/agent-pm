import { Router } from 'express'
import {
  listAssetsByProject,
  buildAssetTree,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  linkAssetToWorkItem,
} from '../services/assets.service.js'
import { getWorkItem } from '../services/work-items.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, notFound } from '../errors.js'
import { validateBody, validateParams } from './validate.js'
import {
  paramProjectId,
  paramProjectIdAssetId,
  paramProjectIdWorkItemId,
  createAssetBody,
  updateAssetBody,
  linkWorkItemAssetBody,
} from './schemas.js'

export function createAssetsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router({ mergeParams: true })
  const pool = () => deps.getPool()

  router.get(
    '/',
    validateParams(paramProjectId),
    asyncHandler(async (req, res) => {
      const flat = await listAssetsByProject(pool(), req.params.projectId)
      const tree = buildAssetTree(flat)
      res.json({ flat, tree })
    })
  )

  router.get(
    '/:assetId',
    validateParams(paramProjectIdAssetId),
    asyncHandler(async (req, res) => {
      const row = await getAsset(pool(), req.params.projectId, req.params.assetId)
      if (!row) throw notFound('Asset not found')
      res.json(row)
    })
  )

  router.post(
    '/',
    validateParams(paramProjectId),
    validateBody(createAssetBody),
    asyncHandler(async (req, res) => {
      const { projectId } = req.params
      const row = await createAsset(pool(), projectId, {
        ...req.body,
        name: req.body.name.trim(),
        parent_id: req.body.parent_id ?? null,
        path: req.body.path ?? null,
        url: req.body.url ?? null,
      })
      res.status(201).json(row)
    })
  )

  router.patch(
    '/:assetId',
    validateParams(paramProjectIdAssetId),
    validateBody(updateAssetBody),
    asyncHandler(async (req, res) => {
      const { projectId, assetId } = req.params
      const updates = {
        ...(req.body.name !== undefined && { name: req.body.name }),
        ...(req.body.type !== undefined && { type: req.body.type }),
        ...(req.body.parent_id !== undefined && { parent_id: req.body.parent_id }),
        ...(req.body.path !== undefined && { path: req.body.path }),
        ...(req.body.url !== undefined && { url: req.body.url }),
      }
      const row = await updateAsset(pool(), projectId, assetId, updates)
      if (!row) throw notFound('Asset not found')
      res.json(row)
    })
  )

  router.delete(
    '/:assetId',
    validateParams(paramProjectIdAssetId),
    asyncHandler(async (req, res) => {
      const deleted = await deleteAsset(pool(), req.params.projectId, req.params.assetId)
      if (!deleted) throw notFound('Asset not found')
      res.status(204).send()
    })
  )

  return router
}

export function createWorkItemAssetsRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router({ mergeParams: true })
  const pool = () => deps.getPool()

  router.post(
    '/',
    validateParams(paramProjectIdWorkItemId),
    validateBody(linkWorkItemAssetBody),
    asyncHandler(async (req, res) => {
      const { projectId, workItemId } = req.params
      const assetId = req.body.asset_id
      const workItem = await getWorkItem(pool(), projectId, workItemId)
      if (!workItem) throw notFound('Work item not found')
      try {
        const { linked } = await linkAssetToWorkItem(pool(), projectId, workItemId, assetId.trim())
        res.status(linked ? 201 : 200).json({ linked })
      } catch (e) {
        if (e instanceof Error && e.message === 'Asset not found') throw notFound(e.message)
        throw e
      }
    })
  )

  return router
}
