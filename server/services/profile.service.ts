/**
 * User profile service: single app user profile (first name, last name, avatar).
 * Avatar is stored under .agent-pm/profile/avatar.<ext> and path in DB.
 */

import type { Pool } from 'pg'
import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const PROFILE_DIR = resolve(process.cwd(), '.agent-pm', 'profile')
const AVATAR_BASENAME = 'avatar'

const PROFILE_ID = 'default'

export type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_path: string | null
  updated_at: string
}

export type ProfileResponse = {
  first_name: string
  last_name: string
  avatar_url: string | null
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/webp') return '.webp'
  return '.jpg'
}

function extFromFilename(name: string): string {
  const lower = name.toLowerCase()
  for (const e of ALLOWED_EXT) {
    if (lower.endsWith(e)) return e
  }
  return '.jpg'
}

export async function getProfile(p: Pool): Promise<ProfileResponse | null> {
  const { rows } = await p.query<UserProfile>(
    `SELECT id, first_name, last_name, avatar_path, updated_at FROM user_profile WHERE id = $1`,
    [PROFILE_ID]
  )
  const row = rows[0]
  if (!row) return null
  const first_name = row.first_name ?? ''
  const last_name = row.last_name ?? ''
  const avatar_url = row.avatar_path ? `/api/profile/avatar` : null
  return { first_name, last_name, avatar_url }
}

export async function updateProfile(
  p: Pool,
  input: { first_name?: string; last_name?: string }
): Promise<ProfileResponse> {
  if (input.first_name !== undefined || input.last_name !== undefined) {
    const { rows: existing } = await p.query<UserProfile>(
      `SELECT first_name, last_name FROM user_profile WHERE id = $1`,
      [PROFILE_ID]
    )
    const cur = existing[0]
    const first_name = input.first_name !== undefined ? input.first_name : (cur?.first_name ?? '')
    const last_name = input.last_name !== undefined ? input.last_name : (cur?.last_name ?? '')
    await p.query(
      `INSERT INTO user_profile (id, first_name, last_name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3, updated_at = now()`,
      [PROFILE_ID, first_name || null, last_name || null]
    )
  }
  const profile = await getProfile(p)
  if (!profile) throw new Error('Profile not found after update')
  return profile
}

/** Save avatar file to disk and set avatar_path in DB. Returns new profile. */
export async function saveAvatar(
  p: Pool,
  buffer: Buffer,
  mimeType: string,
  originalName?: string
): Promise<ProfileResponse> {
  await mkdir(PROFILE_DIR, { recursive: true })
  const ext = originalName ? extFromFilename(originalName) : extFromMime(mimeType)
  if (!ALLOWED_EXT.has(ext)) throw new Error('Invalid image type')
  const filename = `${AVATAR_BASENAME}${ext}`
  const filePath = join(PROFILE_DIR, filename)
  await writeFile(filePath, buffer)
  await removeOtherAvatarFiles(filename)
  await p.query(
    `UPDATE user_profile SET avatar_path = $1, updated_at = now() WHERE id = $2`,
    [filename, PROFILE_ID]
  )
  const profile = await getProfile(p)
  if (!profile) throw new Error('Profile not found after avatar save')
  return profile
}

/** Remove old avatar files (other extensions) so only one avatar exists. */
async function removeOtherAvatarFiles(keepFilename: string): Promise<void> {
  try {
    const entries = await readdir(PROFILE_DIR)
    for (const name of entries) {
      if (name.startsWith(AVATAR_BASENAME) && name !== keepFilename) {
        await unlink(join(PROFILE_DIR, name))
      }
    }
  } catch {
    // ignore
  }
}

/** Get path to current avatar file on disk, or null. */
export async function getAvatarFilePath(p: Pool): Promise<string | null> {
  const { rows } = await p.query<{ avatar_path: string | null }>(
    `SELECT avatar_path FROM user_profile WHERE id = $1`,
    [PROFILE_ID]
  )
  const path = rows[0]?.avatar_path
  if (!path) return null
  const full = join(PROFILE_DIR, path)
  return full
}

/** Read avatar buffer for serving. Call getAvatarFilePath first to resolve path. */
export async function readAvatarFile(fullPath: string): Promise<Buffer> {
  return readFile(fullPath)
}
