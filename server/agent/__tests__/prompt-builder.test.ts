import { describe, it, expect } from 'vitest'
import {
  buildSystemMessage,
  buildUserMessage,
  buildAgentPrompt,
} from '../prompt-builder.js'
import type { AgentRecord, AgentContext } from '../types.js'

const baseAgent: AgentRecord = {
  id: 'a1',
  name: 'Test',
  team_id: 't1',
  instructions: 'Help the user.',
  ai_provider: 'ollama',
  model: 'llama3',
}

describe('prompt-builder', () => {
  describe('buildSystemMessage', () => {
    it('uses agent instructions when present', () => {
      const out = buildSystemMessage(baseAgent, {})
      expect(out).toContain('Help the user.')
    })

    it('replaces {{key}} with context.variables[key]', () => {
      const agent: AgentRecord = { ...baseAgent, instructions: 'Hello {{name}}.' }
      const out = buildSystemMessage(agent, { variables: { name: 'World' } })
      expect(out).toBe('Hello World.')
    })

    it('keeps {{key}} when variable missing', () => {
      const agent: AgentRecord = { ...baseAgent, instructions: 'Hello {{name}}.' }
      const out = buildSystemMessage(agent, {})
      expect(out).toBe('Hello {{name}}.')
    })

    it('uses default prefix when instructions empty', () => {
      const agent: AgentRecord = { ...baseAgent, instructions: '' }
      const out = buildSystemMessage(agent, {})
      expect(out).toContain('You are an AI assistant')
    })

    it('appends context block when context provided', () => {
      const ctx: AgentContext = {
        context: { work_item_title: 'Fix bug', priority: 'High' },
      }
      const out = buildSystemMessage(baseAgent, ctx)
      expect(out).toContain('Current context')
      expect(out).toContain('Fix bug')
      expect(out).toContain('High')
    })

    it('formats nested object in context as JSON block', () => {
      const ctx: AgentContext = {
        context: { work_item: { id: 'wi-1', title: 'Task', nested: { a: 1 } } },
      }
      const out = buildSystemMessage(baseAgent, ctx)
      expect(out).toContain('Work_item')
      expect(out).toContain('"id": "wi-1"')
      expect(out).toContain('"nested"')
    })
  })

  describe('buildUserMessage', () => {
    it('uses userMessage when present', () => {
      const out = buildUserMessage({ userMessage: ' Do something ' })
      expect(out).toBe('Do something')
    })

    it('returns generic prompt when only context', () => {
      const out = buildUserMessage({
        context: { key: 'value' },
      })
      expect(out).toContain('Based on the context provided')
    })

    it('returns fallback when empty', () => {
      const out = buildUserMessage({})
      expect(out).toContain('Please respond')
    })
  })

  describe('buildAgentPrompt', () => {
    it('returns system and user message', () => {
      const messages = buildAgentPrompt(baseAgent, { userMessage: 'Hi' })
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[1].content).toBe('Hi')
    })
  })
})
