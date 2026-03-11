import { describe, it, expect } from 'vitest'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { chatMessagesToLangChain, langChainToChatMessages } from '../langchain-messages.js'
import type { ChatMessage } from '../types.js'

describe('langchain-messages', () => {
  describe('chatMessagesToLangChain', () => {
    it('converts system and user messages', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ]
      const lc = chatMessagesToLangChain(messages)
      expect(lc).toHaveLength(2)
      expect(lc[0]._getType()).toBe('system')
      expect(lc[0].content).toBe('You are helpful.')
      expect(lc[1]._getType()).toBe('human')
      expect(lc[1].content).toBe('Hello')
    })

    it('converts assistant message with tool_calls', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call_1', name: 'update_work_item_status', arguments: '{"status":"in_progress"}' },
          ],
        },
      ]
      const lc = chatMessagesToLangChain(messages)
      expect(lc).toHaveLength(1)
      expect(lc[0]._getType()).toBe('ai')
      const ai = lc[0] as { tool_calls?: Array<{ id?: string; name: string; args: unknown }> }
      expect(ai.tool_calls).toHaveLength(1)
      expect(ai.tool_calls![0].name).toBe('update_work_item_status')
      expect(ai.tool_calls![0].args).toEqual({ status: 'in_progress' })
      expect(ai.tool_calls![0].id).toBe('call_1')
    })

    it('converts tool message', () => {
      const messages: ChatMessage[] = [
        { role: 'tool', content: 'Done.', tool_call_id: 'call_1' },
      ]
      const lc = chatMessagesToLangChain(messages)
      expect(lc).toHaveLength(1)
      expect(lc[0]._getType()).toBe('tool')
      expect((lc[0] as { tool_call_id: string }).tool_call_id).toBe('call_1')
      expect(lc[0].content).toBe('Done.')
    })
  })

  describe('langChainToChatMessages', () => {
    it('converts back to ChatMessage[]', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ]
      const lc = chatMessagesToLangChain(messages)
      const back = langChainToChatMessages(lc)
      expect(back).toHaveLength(2)
      expect(back[0]).toEqual({ role: 'system', content: 'You are helpful.' })
      expect(back[1]).toEqual({ role: 'user', content: 'Hi' })
    })

    it('round-trips assistant with tool_calls', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'x', name: 'update_work_item_status', arguments: '{"status":"completed"}' },
          ],
        },
      ]
      const lc = chatMessagesToLangChain(messages)
      const back = langChainToChatMessages(lc)
      expect(back).toHaveLength(1)
      expect(back[0].role).toBe('assistant')
      expect(back[0].tool_calls).toHaveLength(1)
      expect(back[0].tool_calls![0].name).toBe('update_work_item_status')
      expect(back[0].tool_calls![0].arguments).toBe('{"status":"completed"}')
    })

    it('assistant with invalid JSON in tool arguments uses empty object', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', name: 'tool', arguments: 'not json' }],
        },
      ]
      const lc = chatMessagesToLangChain(messages)
      expect(lc).toHaveLength(1)
      const ai = lc[0] as { tool_calls?: Array<{ args: unknown }> }
      expect(ai.tool_calls![0].args).toEqual({})
    })

    it('tool message with undefined tool_call_id uses empty string', () => {
      const messages: ChatMessage[] = [
        { role: 'tool', content: 'ok', tool_call_id: undefined as unknown as string },
      ]
      const lc = chatMessagesToLangChain(messages)
      expect(lc).toHaveLength(1)
      expect((lc[0] as { tool_call_id: string }).tool_call_id).toBe('')
    })

    it('assistant with tool_calls arguments as object (not string)', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', name: 't', arguments: { status: 'done' } }],
        },
      ]
      const lc = chatMessagesToLangChain(messages)
      const ai = lc[0] as { tool_calls?: Array<{ args: unknown }> }
      expect(ai.tool_calls![0].args).toEqual({ status: 'done' })
    })
  })

  describe('langChainToChatMessages edge cases', () => {
    it('handles AI message with args as string (not object)', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', name: 't', arguments: '{"a":1}' }],
        },
      ]
      const lc = chatMessagesToLangChain(messages)
      const back = langChainToChatMessages(lc)
      expect(back[0].tool_calls![0].arguments).toBe('{"a":1}')
    })

    it('handles message with non-string content (array) as empty string', () => {
      const sys = new SystemMessage('hello')
      const withArrayContent = Object.create(sys)
      withArrayContent.content = []
      const back = langChainToChatMessages([withArrayContent])
      expect(back[0].content).toBe('')
    })

    it('unknown message type maps to user', () => {
      const human = new HumanMessage('hi')
      const unknownType = Object.create(human)
      unknownType._getType = () => 'unknown'
      const back = langChainToChatMessages([unknownType])
      expect(back[0].role).toBe('user')
      expect(back[0].content).toBe('hi')
    })
  })
})
