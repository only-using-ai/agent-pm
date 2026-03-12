import { describe, it, expect } from 'vitest'
import { AI_PROVIDERS, type AiProviderId } from './ai-providers'

describe('ai-providers', () => {
  it('exports expected provider ids', () => {
    expect(AI_PROVIDERS).toHaveLength(4)
    const ids = AI_PROVIDERS.map((p) => p.id)
    expect(ids).toContain('ollama')
    expect(ids).toContain('cursor')
    expect(ids).toContain('gemini')
    expect(ids).toContain('anthropic')
  })

  it('each provider has id and label', () => {
    for (const p of AI_PROVIDERS) {
      expect(typeof p.id).toBe('string')
      expect(typeof p.label).toBe('string')
    }
  })

  it('AiProviderId is one of the provider ids', () => {
    const id: AiProviderId = 'ollama'
    expect(AI_PROVIDERS.some((p) => p.id === id)).toBe(true)
  })
})
