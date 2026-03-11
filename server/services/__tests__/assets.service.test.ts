import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import {
  listAssetsByProject,
  buildAssetTree,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  linkAssetToWorkItem,
  getAssetIdsForWorkItem,
  setWorkItemAssets,
  getAssetsForWorkItem,
} from '../assets.service.js'
import type { AssetRow } from '../types.js'

describe('assets.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let mockConnect: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    mockConnect = vi.fn()
    pool = {
      query: mockQuery,
      connect: mockConnect,
    } as unknown as Pool
  })

  const assetRow: AssetRow = {
    id: 'a1',
    project_id: 'p1',
    parent_id: null,
    name: 'Asset',
    type: 'file',
    path: null,
    url: null,
    created_at: '2025-01-01',
  }

  describe('listAssetsByProject', () => {
    it('returns flat list of assets', async () => {
      mockQuery.mockResolvedValue({ rows: [assetRow] })
      const result = await listAssetsByProject(pool, 'p1')
      expect(result).toEqual([assetRow])
    })
  })

  describe('buildAssetTree', () => {
    it('builds tree from flat list with parent_id', () => {
      const flat: AssetRow[] = [
        { ...assetRow, id: 'root', parent_id: null },
        { ...assetRow, id: 'child', parent_id: 'root', name: 'Child' },
      ]
      const result = buildAssetTree(flat)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('root')
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children[0].id).toBe('child')
    })

    it('puts orphan parent_id in roots', () => {
      const flat: AssetRow[] = [
        { ...assetRow, id: 'orphan', parent_id: 'missing', name: 'Orphan' },
      ]
      const result = buildAssetTree(flat)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('orphan')
    })
  })

  describe('getAsset', () => {
    it('returns asset when found', async () => {
      mockQuery.mockResolvedValue({ rows: [assetRow] })
      const result = await getAsset(pool, 'p1', 'a1')
      expect(result).toEqual(assetRow)
    })

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getAsset(pool, 'p1', 'missing')
      expect(result).toBeNull()
    })
  })

  describe('createAsset', () => {
    it('inserts and returns row', async () => {
      mockQuery.mockResolvedValue({ rows: [assetRow] })
      const result = await createAsset(pool, 'p1', { name: 'Asset', type: 'file' })
      expect(result).toEqual(assetRow)
    })

    it('throws when name is empty', async () => {
      await expect(
        createAsset(pool, 'p1', { name: '', type: 'file' })
      ).rejects.toThrow('name is required')
    })
  })

  describe('updateAsset', () => {
    it('updates and returns row', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...assetRow, name: 'Updated' }] })
      const result = await updateAsset(pool, 'p1', 'a1', { name: 'Updated' })
      expect(result?.name).toBe('Updated')
    })

    it('throws when type is invalid', async () => {
      await expect(
        updateAsset(pool, 'p1', 'a1', { type: 'invalid' as 'file' })
      ).rejects.toThrow('type must be file, link, or folder')
    })

    it('returns getAsset when no updates', async () => {
      mockQuery.mockResolvedValue({ rows: [assetRow] })
      const result = await updateAsset(pool, 'p1', 'a1', {})
      expect(result).toEqual(assetRow)
    })
  })

  describe('deleteAsset', () => {
    it('returns true when row deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 })
      const result = await deleteAsset(pool, 'p1', 'a1')
      expect(result).toBe(true)
    })

    it('returns false when no row deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 })
      const result = await deleteAsset(pool, 'p1', 'a1')
      expect(result).toBe(false)
    })
  })

  describe('linkAssetToWorkItem', () => {
    it('returns linked true when inserted', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [assetRow] })
        .mockResolvedValueOnce({ rowCount: 1 })
      const result = await linkAssetToWorkItem(pool, 'p1', 'wi1', 'a1')
      expect(result).toEqual({ linked: true })
    })

    it('throws when asset not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      await expect(linkAssetToWorkItem(pool, 'p1', 'wi1', 'a1')).rejects.toThrow(
        'Asset not found'
      )
    })
  })

  describe('getAssetIdsForWorkItem', () => {
    it('returns asset ids', async () => {
      mockQuery.mockResolvedValue({ rows: [{ asset_id: 'a1' }, { asset_id: 'a2' }] })
      const result = await getAssetIdsForWorkItem(pool, 'wi1')
      expect(result).toEqual(['a1', 'a2'])
    })
  })

  describe('setWorkItemAssets', () => {
    it('deletes existing and inserts new links', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }
      mockConnect.mockResolvedValue(mockClient)
      await setWorkItemAssets(pool, 'p1', 'wi1', ['a1', 'a2'])
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM work_item_assets WHERE work_item_id = $1',
        ['wi1']
      )
      expect(mockClient.release).toHaveBeenCalled()
    })
  })

  describe('getAssetsForWorkItem', () => {
    it('returns assets linked to work item', async () => {
      mockQuery.mockResolvedValue({ rows: [assetRow] })
      const result = await getAssetsForWorkItem(pool, 'p1', 'wi1')
      expect(result).toEqual([assetRow])
    })
  })
})
