/**
 * Assets service: list (flat + tree by project), get, create, update, delete.
 * Work item linking via work_item_assets junction.
 */

import type { Pool } from 'pg'
import type {
  AssetRow,
  AssetTreeNode,
  CreateAssetInput,
  UpdateAssetInput,
} from './types.js'

const ASSET_COLUMNS = 'id, project_id, parent_id, name, type, path, url, created_at'

export async function listAssetsByProject(
  pool: Pool,
  projectId: string
): Promise<AssetRow[]> {
  const { rows } = await pool.query(
    `SELECT ${ASSET_COLUMNS} FROM assets WHERE project_id = $1 ORDER BY name`,
    [projectId]
  )
  return rows as AssetRow[]
}

export function buildAssetTree(flat: AssetRow[]): AssetTreeNode[] {
  const byId = new Map<string, AssetTreeNode>()
  for (const row of flat) {
    byId.set(row.id, { ...row, children: [] })
  }
  const roots: AssetTreeNode[] = []
  for (const node of byId.values()) {
    if (node.parent_id == null) {
      roots.push(node)
    } else {
      const parent = byId.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }
  const sortByName = (a: AssetTreeNode, b: AssetTreeNode) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  roots.sort(sortByName)
  for (const node of byId.values()) {
    node.children.sort(sortByName)
  }
  return roots
}

export async function getAsset(
  pool: Pool,
  projectId: string,
  id: string
): Promise<AssetRow | null> {
  const { rows } = await pool.query(
    `SELECT ${ASSET_COLUMNS} FROM assets WHERE id = $1 AND project_id = $2`,
    [id, projectId]
  )
  return (rows[0] as AssetRow) ?? null
}

export async function createAsset(
  pool: Pool,
  projectId: string,
  input: CreateAssetInput
): Promise<AssetRow> {
  const name =
    typeof input.name === 'string' && input.name.trim() ? input.name.trim() : ''
  if (!name) throw new Error('name is required')
  const type = input.type === 'file' || input.type === 'link' || input.type === 'folder'
    ? input.type
    : 'file'
  const parentId = input.parent_id ?? null
  const path = input.path?.trim() ?? null
  const url = input.url?.trim() ?? null

  const { rows } = await pool.query(
    `INSERT INTO assets (project_id, parent_id, name, type, path, url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${ASSET_COLUMNS}`,
    [projectId, parentId, name, type, path, url]
  )
  const asset = rows[0] as AssetRow
  if (input.work_item_ids?.length) {
    for (const workItemId of input.work_item_ids) {
      await pool.query(
        `INSERT INTO work_item_assets (work_item_id, asset_id) VALUES ($1, $2)
         ON CONFLICT (work_item_id, asset_id) DO NOTHING`,
        [workItemId, asset.id]
      )
    }
  }
  return asset
}

export async function updateAsset(
  pool: Pool,
  projectId: string,
  id: string,
  input: UpdateAssetInput
): Promise<AssetRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1
  if (input.name !== undefined) {
    const trimmed = typeof input.name === 'string' ? input.name.trim() : ''
    if (!trimmed) throw new Error('name cannot be empty')
    updates.push(`name = $${paramIndex++}`)
    values.push(trimmed)
  }
  if (input.type !== undefined) {
    if (input.type !== 'file' && input.type !== 'link' && input.type !== 'folder') {
      throw new Error('type must be file, link, or folder')
    }
    updates.push(`type = $${paramIndex++}`)
    values.push(input.type)
  }
  if (input.parent_id !== undefined) {
    updates.push(`parent_id = $${paramIndex++}`)
    values.push(input.parent_id || null)
  }
  if (input.path !== undefined) {
    updates.push(`path = $${paramIndex++}`)
    values.push(input.path?.trim() ?? null)
  }
  if (input.url !== undefined) {
    updates.push(`url = $${paramIndex++}`)
    values.push(input.url?.trim() ?? null)
  }
  if (updates.length === 0) {
    return getAsset(pool, projectId, id)
  }
  values.push(id, projectId)
  const { rows } = await pool.query(
    `UPDATE assets SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND project_id = $${paramIndex}
     RETURNING ${ASSET_COLUMNS}`,
    values
  )
  return (rows[0] as AssetRow) ?? null
}

export async function deleteAsset(
  pool: Pool,
  projectId: string,
  id: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM assets WHERE id = $1 AND project_id = $2',
    [id, projectId]
  )
  return (rowCount ?? 0) > 0
}

export async function linkAssetToWorkItem(
  pool: Pool,
  projectId: string,
  workItemId: string,
  assetId: string
): Promise<{ linked: boolean }> {
  const asset = await getAsset(pool, projectId, assetId)
  if (!asset) throw new Error('Asset not found')
  const { rowCount } = await pool.query(
    `INSERT INTO work_item_assets (work_item_id, asset_id) VALUES ($1, $2)
     ON CONFLICT (work_item_id, asset_id) DO NOTHING`,
    [workItemId, assetId]
  )
  return { linked: (rowCount ?? 0) > 0 }
}

export async function getAssetIdsForWorkItem(
  pool: Pool,
  workItemId: string
): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT asset_id FROM work_item_assets WHERE work_item_id = $1',
    [workItemId]
  )
  return (rows as { asset_id: string }[]).map((r) => r.asset_id)
}

export async function setWorkItemAssets(
  pool: Pool,
  projectId: string,
  workItemId: string,
  assetIds: string[]
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('DELETE FROM work_item_assets WHERE work_item_id = $1', [workItemId])
    for (const assetId of assetIds) {
      await client.query(
        `INSERT INTO work_item_assets (work_item_id, asset_id) VALUES ($1, $2)
         ON CONFLICT (work_item_id, asset_id) DO NOTHING`,
        [workItemId, assetId]
      )
    }
  } finally {
    client.release()
  }
}

export async function getAssetsForWorkItem(
  pool: Pool,
  projectId: string,
  workItemId: string
): Promise<AssetRow[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.project_id, a.parent_id, a.name, a.type, a.path, a.url, a.created_at
     FROM assets a
     JOIN work_item_assets wia ON wia.asset_id = a.id
     WHERE wia.work_item_id = $1 AND a.project_id = $2
     ORDER BY a.name`,
    [workItemId, projectId]
  )
  return rows as AssetRow[]
}
