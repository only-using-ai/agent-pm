import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createAssetsRouter, createWorkItemAssetsRouter } from '../assets.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/assets.service.js', () => ({
  listAssetsByProject: vi.fn(),
  buildAssetTree: vi.fn(),
  getAsset: vi.fn(),
  createAsset: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  linkAssetToWorkItem: vi.fn(),
}))

vi.mock('../../services/work-items.service.js', () => ({
  getWorkItem: vi.fn(),
}))

import * as assetsService from '../../services/assets.service.js'
import * as workItemsService from '../../services/work-items.service.js'

describe('assets routes', () => {
  let pool: Pool
  const basePath = '/api/projects/p1/assets'

  beforeEach(() => {
    vi.mocked(assetsService.listAssetsByProject).mockReset()
    vi.mocked(assetsService.buildAssetTree).mockReset()
    vi.mocked(assetsService.getAsset).mockReset()
    vi.mocked(assetsService.createAsset).mockReset()
    vi.mocked(assetsService.updateAsset).mockReset()
    vi.mocked(assetsService.deleteAsset).mockReset()
    vi.mocked(assetsService.linkAssetToWorkItem).mockReset()
    vi.mocked(workItemsService.getWorkItem).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns flat and tree assets', async () => {
      const flat = [{ id: 'a1', project_id: 'p1', name: 'Asset', type: 'file', parent_id: null, path: null, url: null }]
      const tree = [{ id: 'a1', name: 'Asset', type: 'file', children: [] }]
      vi.mocked(assetsService.listAssetsByProject).mockResolvedValue(flat)
      vi.mocked(assetsService.buildAssetTree).mockReturnValue(tree)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).get(basePath).expect(200)
      expect(res.body).toEqual({ flat, tree })
    })
  })

  describe('GET /:assetId', () => {
    it('returns asset when found', async () => {
      const row = { id: 'a1', project_id: 'p1', name: 'Asset', type: 'file', parent_id: null, path: null, url: null }
      vi.mocked(assetsService.getAsset).mockResolvedValue(row)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).get(`${basePath}/a1`).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(assetsService.getAsset).mockResolvedValue(null)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).get(`${basePath}/missing`)
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Asset not found')
    })
  })

  describe('POST /', () => {
    it('creates asset and returns 201', async () => {
      const row = { id: 'a1', project_id: 'p1', name: 'New', type: 'file', parent_id: null, path: null, url: null }
      vi.mocked(assetsService.createAsset).mockResolvedValue(row)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).post(basePath).send({ name: 'New', type: 'file' }).expect(201)
      expect(res.body).toEqual(row)
    })

    it('returns 400 when name and type are required', async () => {
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).post(basePath).send({})
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/name|type/i)
      expect(err).toMatch(/required/i)
    })

    it('returns 400 when type must be file, link, or folder', async () => {
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).post(basePath).send({ name: 'X', type: 'invalid' })
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /:assetId', () => {
    it('updates asset and returns 200', async () => {
      const row = { id: 'a1', project_id: 'p1', name: 'Updated', type: 'file', parent_id: null, path: null, url: null }
      vi.mocked(assetsService.updateAsset).mockResolvedValue(row)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).patch(`${basePath}/a1`).send({ name: 'Updated' }).expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when not found', async () => {
      vi.mocked(assetsService.updateAsset).mockResolvedValue(null)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).patch(`${basePath}/missing`).send({ name: 'X' })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /:assetId', () => {
    it('deletes asset and returns 204', async () => {
      vi.mocked(assetsService.deleteAsset).mockResolvedValue(true)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      await request(app).delete(`${basePath}/a1`).expect(204)
      expect(assetsService.deleteAsset).toHaveBeenCalledWith(pool, 'p1', 'a1')
    })

    it('returns 404 when not found', async () => {
      vi.mocked(assetsService.deleteAsset).mockResolvedValue(false)
      const router = createAssetsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/projects/:projectId/assets', router)
      const res = await request(app).delete(`${basePath}/missing`)
      expect(res.status).toBe(404)
    })
  })
})

describe('work-item assets routes (link asset)', () => {
  let pool: Pool
  const basePath = '/api/projects/p1/work-items/w1/assets'

  beforeEach(() => {
    vi.mocked(workItemsService.getWorkItem).mockReset()
    vi.mocked(assetsService.linkAssetToWorkItem).mockReset()
    pool = createMockPool(vi.fn())
  })

  it('returns 400 when asset_id is required', async () => {
    const router = createWorkItemAssetsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api/projects/:projectId/work-items/:workItemId/assets', router)
    const res = await request(app).post(basePath).send({})
    expect(res.status).toBe(400)
    const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
    expect(err).toMatch(/asset_id|required/i)
  })

  it('returns 404 when work item not found', async () => {
    vi.mocked(workItemsService.getWorkItem).mockResolvedValue(null)
    const router = createWorkItemAssetsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api/projects/:projectId/work-items/:workItemId/assets', router)
    const res = await request(app).post(basePath).send({ asset_id: 'a1' })
    expect(res.status).toBe(404)
  })

  it('links asset and returns 201 when linked', async () => {
    vi.mocked(workItemsService.getWorkItem).mockResolvedValue({ id: 'w1' } as never)
    vi.mocked(assetsService.linkAssetToWorkItem).mockResolvedValue({ linked: true })
    const router = createWorkItemAssetsRouter({ getPool: createMockGetPool(pool) })
    const app = appWithRouter('/api/projects/:projectId/work-items/:workItemId/assets', router)
    const res = await request(app).post(basePath).send({ asset_id: 'a1' }).expect(201)
    expect(res.body).toEqual({ linked: true })
  })
})
