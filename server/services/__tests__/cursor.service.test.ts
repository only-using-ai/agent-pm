import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCursorModelsFromApi, fetchCursorModels } from '../cursor.service.js'
import { execFile } from 'node:child_process'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockExecFile = vi.fn((bin: string, args: string[], opts: any, cb?: (err: Error | null, stdout: string, stderr: string) => void) => {
    const callback = (typeof opts === 'function' ? opts : cb) as ((err: Error | null, stdout: string, stderr: string) => void) | undefined
    if (callback) callback(null, 'model-id - Display Name\n', '')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {} as any
  })
  const mock = { ...actual, execFile: mockExecFile }
  return { ...mock, default: mock }
})

vi.mock('../../config.js', () => ({
  getCursorApiKey: () => process.env.CURSOR_API_KEY ?? '',
  getCursorCliPath: () => 'cursor',
}))

describe('cursor.service', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.CURSOR_API_KEY

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.CURSOR_API_KEY = ''
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
    process.env.CURSOR_API_KEY = originalEnv
  })

  describe('fetchCursorModelsFromApi', () => {
    it('returns models on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: ['gpt-4', 'claude-3'] }),
        text: () => Promise.resolve(''),
      } as unknown as Response)
      const result = await fetchCursorModelsFromApi('key')
      expect(result).toEqual({ ok: true, models: ['gpt-4', 'claude-3'] })
      expect(fetch).toHaveBeenCalledWith(
        'https://api.cursor.com/v0/models',
        expect.objectContaining({
          headers: { Authorization: expect.stringContaining('Basic') },
        })
      )
    })

    it('returns error when not ok', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid key'),
      } as unknown as Response)
      const result = await fetchCursorModelsFromApi('bad')
      expect(result.ok).toBe(false)
      expect((result as { error: string }).error).toContain('Cursor API')
    })

    it('returns error on fetch throw', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
      const result = await fetchCursorModelsFromApi('key')
      expect(result.ok).toBe(false)
    })
  })

  describe('fetchCursorModels', () => {
    it('uses API when apiKey provided and returns models', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: ['model-1'] }),
        text: () => Promise.resolve(''),
      } as unknown as Response)
      const result = await fetchCursorModels('key')
      expect(result).toEqual({ ok: true, models: ['model-1'] })
      expect(execFile).not.toHaveBeenCalled()
    })

    it('falls back to CLI when API returns empty', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
        text: () => Promise.resolve(''),
      } as unknown as Response)
      const result = await fetchCursorModels('key')
      expect(execFile).toHaveBeenCalledWith('cursor', ['agent', 'models'], expect.any(Object), expect.any(Function))
      if (result.ok) expect(result.models).toBeDefined()
    })

    it('uses CLI when no apiKey', async () => {
      const result = await fetchCursorModels()
      expect(execFile).toHaveBeenCalledWith('cursor', ['agent', 'models'], expect.any(Object), expect.any(Function))
      expect(result.ok).toBe(true)
      expect(Array.isArray(result.models)).toBe(true)
    })
  })
})
