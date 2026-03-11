import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import * as fs from 'node:fs/promises'
import {
  getProfile,
  updateProfile,
  saveAvatar,
  getAvatarFilePath,
  readAvatarFile,
} from '../profile.service.js'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const mock = {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
  }
  return { ...mock, default: mock }
})

describe('profile.service', () => {
  let mockQuery: ReturnType<typeof vi.fn>
  let pool: Pool

  beforeEach(() => {
    mockQuery = vi.fn()
    pool = { query: mockQuery } as unknown as Pool
    vi.mocked(fs.readdir).mockResolvedValue([])
  })

  describe('getProfile', () => {
    it('returns profile with avatar_url when avatar_path set', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'default',
            first_name: 'John',
            last_name: 'Doe',
            avatar_path: 'avatar.png',
            updated_at: '2025-01-01',
          },
        ],
      })
      const result = await getProfile(pool)
      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: '/api/profile/avatar',
      })
    })

    it('returns null when no row', async () => {
      mockQuery.mockResolvedValue({ rows: [] })
      const result = await getProfile(pool)
      expect(result).toBeNull()
    })
  })

  describe('updateProfile', () => {
    it('updates first_name and last_name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ first_name: 'Old', last_name: 'Name' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'default',
              first_name: 'New',
              last_name: 'Name',
              avatar_path: null,
              updated_at: '2025-01-01',
            },
          ],
        })
      const result = await updateProfile(pool, { first_name: 'New' })
      expect(result.first_name).toBe('New')
    })
  })

  describe('saveAvatar', () => {
    it('writes file and updates DB', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'default',
              first_name: '',
              last_name: '',
              avatar_path: 'avatar.jpg',
              updated_at: '2025-01-01',
            },
          ],
        })
      const result = await saveAvatar(pool, Buffer.from('x'), 'image/jpeg')
      expect(result.avatar_url).toBe('/api/profile/avatar')
    })

    it('throws when profile not found after avatar save', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      mockQuery.mockResolvedValue({ rows: [] })
      await expect(
        saveAvatar(pool, Buffer.from('x'), 'image/jpeg')
      ).rejects.toThrow('Profile not found after avatar save')
    })
  })

  describe('getAvatarFilePath', () => {
    it('returns full path when avatar_path set', async () => {
      mockQuery.mockResolvedValue({ rows: [{ avatar_path: 'avatar.png' }] })
      const result = await getAvatarFilePath(pool)
      expect(result).toContain('avatar.png')
    })

    it('returns null when no path', async () => {
      mockQuery.mockResolvedValue({ rows: [{ avatar_path: null }] })
      const result = await getAvatarFilePath(pool)
      expect(result).toBeNull()
    })
  })

  describe('readAvatarFile', () => {
    it('returns buffer from path', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('image'))
      const result = await readAvatarFile('/path/to/avatar.png')
      expect(result).toEqual(Buffer.from('image'))
    })
  })
})
