import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAnthropicModels } from '../anthropic.service.js'

describe('anthropic.service', () => {
  const originalFetch = globalThis.fetch
  const originalEnv = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.ANTHROPIC_API_KEY = ''
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
    process.env.ANTHROPIC_API_KEY = originalEnv
  })

  it('returns error when no API key', async () => {
    const result = await fetchAnthropicModels()
    expect(result).toEqual({
      ok: false,
      error: 'Anthropic API key required. Set ANTHROPIC_API_KEY.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns models when API key provided and request succeeds', async () => {
    process.env.ANTHROPIC_API_KEY = 'key'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'claude-3-opus' }, { id: 'claude-3-sonnet' }] }),
      text: () => Promise.resolve(''),
    } as any)
    const result = await fetchAnthropicModels()
    expect(result).toEqual({ ok: true, models: ['claude-3-opus', 'claude-3-sonnet'] })
  })

  it('returns error when response not ok', async () => {
    process.env.ANTHROPIC_API_KEY = 'key'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid key'),
    } as any)
    const result = await fetchAnthropicModels()
    expect(result.ok).toBe(false)
    expect((result as any).error).toContain('Failed to fetch Anthropic models')
  })

  it('returns error on fetch throw', async () => {
    process.env.ANTHROPIC_API_KEY = 'key'
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchAnthropicModels()
    expect(result.ok).toBe(false)
    expect((result as any).error).toContain('Cannot reach Anthropic API')
  })
})
