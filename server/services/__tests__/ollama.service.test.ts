import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOllamaModels } from '../ollama.service.js'

describe('ollama.service', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
    )
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
  })

  it('returns models on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
      text: () => Promise.resolve(''),
    } as unknown as Response)
    const result = await fetchOllamaModels('http://localhost:11434')
    expect(result).toEqual({ ok: true, models: ['llama3', 'mistral'] })
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags')
  })

  it('strips trailing slash from baseUrl', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
      text: () => Promise.resolve(''),
    } as unknown as Response)
    await fetchOllamaModels('http://localhost:11434/')
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags')
  })

  it('returns error when response not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      text: () => Promise.resolve('not found'),
    } as unknown as Response)
    const result = await fetchOllamaModels()
    expect(result).toEqual({
      ok: false,
      error: 'Failed to fetch Ollama models',
      detail: 'not found',
    })
  })

  it('returns error on fetch throw', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchOllamaModels()
    expect(result).toEqual({
      ok: false,
      error: 'Cannot reach Ollama. Is it running?',
      detail: 'Network error',
    })
  })

  it('handles non-Error throw', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('string error')
    const result = await fetchOllamaModels()
    expect(result.ok).toBe(false)
    expect(result.detail).toBe('string error')
  })
})
