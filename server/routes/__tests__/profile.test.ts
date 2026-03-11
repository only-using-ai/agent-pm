import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createProfileRouter } from '../profile.js'
import { createMockPool, createMockGetPool, createMockUpload, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/profile.service.js', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  saveAvatar: vi.fn(),
  getAvatarFilePath: vi.fn(),
  readAvatarFile: vi.fn(),
}))

import * as profileService from '../../services/profile.service.js'

describe('profile routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(profileService.getProfile).mockReset()
    vi.mocked(profileService.updateProfile).mockReset()
    vi.mocked(profileService.saveAvatar).mockReset()
    vi.mocked(profileService.getAvatarFilePath).mockReset()
    vi.mocked(profileService.readAvatarFile).mockReset()
    pool = createMockPool(vi.fn())
  })

  const deps = () => ({ getPool: createMockGetPool(pool), sse: { broadcastToAgent: () => {}, registerAgentStream: () => {}, registerStreamStatus: () => {} }, emit: () => {}, upload: createMockUpload() })

  describe('GET /', () => {
    it('returns profile when found', async () => {
      const row = { id: 'u1', first_name: 'John', last_name: 'Doe' }
      vi.mocked(profileService.getProfile).mockResolvedValue(row)
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).get('/api/profile').expect(200)
      expect(res.body).toEqual(row)
    })

    it('returns 404 when profile not found', async () => {
      vi.mocked(profileService.getProfile).mockResolvedValue(null)
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).get('/api/profile')
      expect(res.status).toBe(404)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('Profile not found')
    })
  })

  describe('PATCH /', () => {
    it('updates profile and returns 200', async () => {
      const row = { id: 'u1', first_name: 'Jane', last_name: 'Doe' }
      vi.mocked(profileService.updateProfile).mockResolvedValue(row)
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).patch('/api/profile').send({ first_name: 'Jane', last_name: 'Doe' }).expect(200)
      expect(res.body).toEqual(row)
    })
  })

  describe('POST /avatar', () => {
    it('returns 400 when no file uploaded', async () => {
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).post('/api/profile/avatar')
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('No file uploaded')
    })

    it('returns 400 when file is not an image', async () => {
      const upload = createMockUpload({ buffer: Buffer.from('x'), originalname: 'f.txt', mimetype: 'text/plain' })
      const router = createProfileRouter({ ...deps(), upload })
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).post('/api/profile/avatar')
      expect(res.status).toBe(400)
      expect(String(responseBody(res).error ?? (res as { text?: string }).text)).toContain('image')
    })

    it('saves avatar and returns 200 when image file present', async () => {
      vi.mocked(profileService.saveAvatar).mockResolvedValue({ id: 'u1', first_name: 'J', last_name: 'D', avatar_path: '/x.png' })
      const upload = createMockUpload({ buffer: Buffer.from('png'), originalname: 'a.png', mimetype: 'image/png' })
      const router = createProfileRouter({ ...deps(), upload })
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).post('/api/profile/avatar').expect(200)
      expect(res.body).toHaveProperty('avatar_path', '/x.png')
    })
  })

  describe('GET /avatar', () => {
    it('returns 404 when no avatar', async () => {
      vi.mocked(profileService.getAvatarFilePath).mockResolvedValue(null)
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).get('/api/profile/avatar')
      expect(res.status).toBe(404)
    })

    it('returns image when avatar exists', async () => {
      vi.mocked(profileService.getAvatarFilePath).mockResolvedValue('/path/to/a.png')
      vi.mocked(profileService.readAvatarFile).mockResolvedValue(Buffer.from('pngdata'))
      const router = createProfileRouter(deps())
      const app = appWithRouter('/api/profile', router)
      const res = await request(app).get('/api/profile/avatar').expect(200)
      expect(res.headers['content-type']).toMatch(/image\/png/)
    })
  })
})
