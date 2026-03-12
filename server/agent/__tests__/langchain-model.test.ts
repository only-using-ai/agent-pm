import { describe, it, expect } from 'vitest'
import { createModel } from '../langchain-model.js'

describe('langchain-model', () => {
  it('creates OpenAI-compatible model for ollama', () => {
    const model = createModel('ollama', { model: 'llama3' })
    expect(model).toBeDefined()
    expect(model._llmType()).toBeDefined()
  })

  it('creates ChatOpenAI for openai', () => {
    const model = createModel('openai', { model: 'gpt-4o-mini', config: { apiKey: 'test-key' } })
    expect(model).toBeDefined()
  })

  it('throws for cursor (cursor uses CLI via cursor-cli-runner)', () => {
    expect(() =>
      createModel('cursor', { model: 'claude-3.5-sonnet', config: { apiKey: 'test-key' } })
    ).toThrow(/Cursor uses the CLI/)
  })

  it('throws for gemini (gemini uses CLI via gemini-cli-runner)', () => {
    expect(() => createModel('gemini', { model: 'auto' })).toThrow(/Gemini uses the CLI/)
  })

  it('creates ChatAnthropic for anthropic', () => {
    const model = createModel('anthropic', {
      model: 'claude-3-5-sonnet-20241022',
      config: { apiKey: 'test-key' },
    })
    expect(model).toBeDefined()
  })

  it('throws for unknown provider', () => {
    expect(() => createModel('unknown')).toThrow('Unknown AI provider')
  })

  it('lowercases provider id', () => {
    const model = createModel('OLLAMA', { model: 'llama3' })
    expect(model).toBeDefined()
  })
})
