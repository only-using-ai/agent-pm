import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgentStream, runAgent } from '../langchain-runner.js'
import type { AgentRecord, AgentContext } from '../types.js'

const mockStream = async function* () {
  yield { content: 'Hello' }
  yield { content: ' world' }
}

vi.mock('deepagents', () => ({
  createDeepAgent: vi.fn(() => ({
    stream: vi.fn().mockImplementation(() => mockStream()),
    invoke: vi.fn().mockResolvedValue({
      messages: [
        {
          _getType: () => 'ai',
          content: 'Invoked response',
          tool_calls: [],
        },
      ],
    }),
  })),
}))

const mockAgent: AgentRecord = {
  id: 'agent-1',
  name: 'Test',
  team_id: 'team-1',
  instructions: 'Help.',
  ai_provider: 'ollama',
  model: 'llama3',
}

const mockContext: AgentContext = {
  userMessage: 'Hi',
  context: {},
  variables: {},
}

describe('langchain-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('runAgentStream', () => {
    it('yields content chunks from stream', async () => {
      const chunks: Array<{ type: string; text?: string }> = []
      for await (const chunk of runAgentStream(mockAgent, mockContext)) {
        chunks.push(chunk)
      }
      expect(chunks.some((c) => c.type === 'content' && c.text)).toBe(true)
      const contentChunks = chunks.filter((c) => c.type === 'content')
      const fullText = contentChunks.map((c) => (c as { text: string }).text).join('')
      expect(fullText).toContain('Hello')
      expect(fullText).toContain('world')
    })

    it('yields thinking chunks from additional_kwargs and content blocks', async () => {
      const thinkingStream = async function* () {
        yield { additional_kwargs: { thinking: 'Let me consider...' } }
        yield { additional_kwargs: { reasoning_content: ' step by step.' } }
        yield {
          content: [
            { type: 'reasoning', reasoning: ' Block reasoning here.' },
            { type: 'text', text: 'Final answer.' },
          ],
        }
      }
      const { createDeepAgent } = await import('deepagents')
      vi.mocked(createDeepAgent).mockReturnValueOnce({
        stream: vi.fn().mockImplementation(() => thinkingStream()),
        invoke: vi.fn(),
      } as unknown as ReturnType<typeof createDeepAgent>)
      const chunks: Array<{ type: string; text?: string }> = []
      for await (const chunk of runAgentStream(mockAgent, mockContext)) {
        chunks.push(chunk)
      }
      const thinkingChunks = chunks.filter((c) => c.type === 'thinking')
      expect(thinkingChunks.length).toBeGreaterThanOrEqual(1)
      const thinkingText = thinkingChunks.map((c) => (c as { text: string }).text).join('')
      expect(thinkingText).toContain('Let me consider')
      expect(thinkingText).toContain('step by step')
      expect(thinkingText).toContain('Block reasoning here')
      const contentChunks = chunks.filter((c) => c.type === 'content')
      const contentText = contentChunks.map((c) => (c as { text: string }).text).join('')
      expect(contentText).toContain('Final answer')
    })
  })

  describe('runAgent', () => {
    it('returns content and optional toolCalls from invoke', async () => {
      const result = await runAgent(mockAgent, mockContext)
      expect(result.content).toBe('Invoked response')
      expect(result.toolCalls).toEqual([])
    })
  })
})
