import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'
import { createTeamsRouter } from '../teams.js'
import { createMockPool, createMockGetPool, appWithRouter, responseBody } from './helpers.js'

vi.mock('../../services/teams.service.js', () => ({
  listTeams: vi.fn(),
  createTeam: vi.fn(),
}))

import * as teamsService from '../../services/teams.service.js'

describe('teams routes', () => {
  let pool: Pool

  beforeEach(() => {
    vi.mocked(teamsService.listTeams).mockReset()
    vi.mocked(teamsService.createTeam).mockReset()
    pool = createMockPool(vi.fn())
  })

  describe('GET /', () => {
    it('returns list of teams', async () => {
      const rows = [
        { id: 't1', name: 'Team A', created_at: '2025-01-01' },
        { id: 't2', name: 'Team B', created_at: '2025-01-02' },
      ]
      vi.mocked(teamsService.listTeams).mockResolvedValue(rows)
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      const res = await request(app).get('/api/teams').expect(200)
      expect(res.body).toEqual(rows)
      expect(teamsService.listTeams).toHaveBeenCalledWith(pool)
    })

    it('returns 500 when service throws', async () => {
      vi.mocked(teamsService.listTeams).mockRejectedValue(new Error('db error'))
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      const res = await request(app).get('/api/teams')
      expect(res.status).toBe(500)
      const bodyOrText = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(bodyOrText.length > 0).toBe(true)
      expect(bodyOrText).toMatch(/unexpected|error/i)
    })
  })

  describe('POST /', () => {
    it('creates team and returns 201', async () => {
      const row = { id: 't1', name: 'New Team', created_at: '2025-01-01' }
      vi.mocked(teamsService.createTeam).mockResolvedValue(row)
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      const res = await request(app).post('/api/teams').send({ name: 'New Team' }).expect(201)
      expect(res.body).toEqual(row)
      expect(teamsService.createTeam).toHaveBeenCalledWith(pool, 'New Team')
    })

    it('trims name and creates team', async () => {
      const row = { id: 't1', name: 'Trimmed', created_at: '2025-01-01' }
      vi.mocked(teamsService.createTeam).mockResolvedValue(row)
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      await request(app).post('/api/teams').send({ name: '  Trimmed  ' }).expect(201)
      expect(teamsService.createTeam).toHaveBeenCalledWith(pool, '  Trimmed  ')
    })

    it('returns 400 when name is required error', async () => {
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      const res = await request(app).post('/api/teams').send({ name: '' })
      expect(res.status).toBe(400)
      const err = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(err).toMatch(/name|required/i)
      expect(teamsService.createTeam).not.toHaveBeenCalled()
    })

    it('returns 500 when service throws', async () => {
      vi.mocked(teamsService.createTeam).mockRejectedValue(new Error('db error'))
      const router = createTeamsRouter({ getPool: createMockGetPool(pool) })
      const app = appWithRouter('/api/teams', router)
      const res = await request(app).post('/api/teams').send({ name: 'X' })
      expect(res.status).toBe(500)
      const bodyOrText = String(responseBody(res).error ?? (res as { text?: string }).text ?? '')
      expect(bodyOrText.length > 0).toBe(true)
      expect(bodyOrText).toMatch(/unexpected|error/i)
    })
  })
})
