/**
 * Convert between our ChatMessage[] and LangChain BaseMessage[].
 */

import type { ChatMessage } from './types.js'
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages'

/**
 * Convert our ChatMessage[] to LangChain BaseMessage[] for invoke/stream.
 */
export function chatMessagesToLangChain(messages: ChatMessage[]): BaseMessage[] {
  return messages.map((m) => {
    const content = typeof m.content === 'string' ? m.content : ''
    switch (m.role) {
      case 'system':
        return new SystemMessage(content)
      case 'user':
        return new HumanMessage(content)
      case 'assistant': {
        const toolCalls = m.tool_calls?.map((tc) => ({
          name: tc.name,
          args: typeof tc.arguments === 'string' ? (() => {
            try {
              return JSON.parse(tc.arguments || '{}')
            } catch {
              return {}
            }
          })() : (tc.arguments as Record<string, unknown>),
          id: tc.id ?? `call_${tc.name}`,
        }))
        return new AIMessage({
          content: content || undefined,
          tool_calls: toolCalls?.length ? toolCalls : undefined,
        })
      }
      case 'tool':
        return new ToolMessage({
          content,
          tool_call_id: String(m.tool_call_id ?? ''),
        })
      default:
        return new HumanMessage(content)
    }
  })
}

/**
 * Convert LangChain BaseMessage[] back to our ChatMessage[] (e.g. for continuation).
 */
export function langChainToChatMessages(messages: BaseMessage[]): ChatMessage[] {
  return messages.map((m) => {
    const content = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? '' : String(m.content ?? '')
    if (m._getType() === 'system') return { role: 'system' as const, content }
    if (m._getType() === 'human') return { role: 'user' as const, content }
    if (m._getType() === 'ai') {
      const ai = m as AIMessage
      const toolCalls = ai.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: typeof tc.args === 'object' ? JSON.stringify(tc.args) : (tc.args as string),
      }))
      return {
        role: 'assistant' as const,
        content,
        tool_calls: toolCalls?.length ? toolCalls : undefined,
      }
    }
    if (m._getType() === 'tool') {
      const tool = m as ToolMessage
      return {
        role: 'tool' as const,
        content,
        tool_call_id: tool.tool_call_id,
      }
    }
    return { role: 'user' as const, content }
  })
}
