/**
 * Deep agent runner: uses createDeepAgent (LangChain Deep Agents SDK) to run the
 * agent with planning, filesystem, and tool execution. Streams response as our StreamChunk shape.
 *
 * Thinking/reasoning tokens: we use streamMode "messages" and map contentBlocks with
 * type "reasoning" (and provider "thinking") to StreamChunk type "thinking" so the
 * client can stream model reasoning in real time. See:
 * https://docs.langchain.com/oss/javascript/langchain/streaming/overview#streaming-thinking-reasoning-tokens
 */

import type { AgentRecord, AgentContext, StreamChunk, ChatMessage } from './types.js'
import { chatMessagesToLangChain } from './langchain-messages.js'
import { buildAgentPrompt } from './prompt-builder.js'
import { createDeepAgent } from 'deepagents'
import { ChatAnthropic } from '@langchain/anthropic'
import { createModel } from './langchain-model.js'
import { LANGCHAIN_TOOLS, createWorkItemTools, writeFileTool } from './langchain-tools.js'
import type { WorkItemToolContext } from './langchain-tools.js'
import { createMcpLangChainTools } from './mcp-langchain.js'
import type { McpToolRow } from '../services/types.js'
import type { BaseMessage } from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { BaseLanguageModel } from '@langchain/core/language_models/base'
import { runCursorCLIStream, runCursorCLI } from './cursor-cli-runner.js'

const DEFAULT_MODELS: Record<string, string> = {
  ollama: 'llama3',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  cursor: 'claude-4.5-sonnet-thinking',
}

/** Build provider:model string for createDeepAgent so it uses initChatModel (same dependency tree → getName/bindTools work). */
function toDeepAgentModelString(provider: string, model?: string | null): string {
  const p = (provider ?? 'ollama').toLowerCase()
  const m = (model?.trim() || DEFAULT_MODELS[p] || 'llama3').trim()
  return `${p}:${m}`
}

/**
 * Resolve model for createDeepAgent. Always returns a BaseLanguageModel instance so
 * LangChain never sees provider:model strings like "cursor:auto" (which it cannot infer).
 * - Anthropic: ChatAnthropic with thinking enabled for reasoning tokens.
 * - Others: createModel() so cursor/ollama/openai use the right client and "auto" → default.
 */
function resolveModel(
  modelString: string,
  provider: string
): BaseLanguageModel {
  const p = (provider ?? 'ollama').toLowerCase()
  const modelId = modelString.includes(':') ? modelString.slice(modelString.indexOf(':') + 1) : modelString
  const effectiveModel =
    (modelId === 'auto' && p === 'cursor') ? undefined : (modelId || undefined)

  if (p === 'anthropic') {
    return new ChatAnthropic({
      model: modelId || 'claude-3-5-sonnet-20241022',
      thinking: { type: 'enabled', budget_tokens: 5000 },
    })
  }
  return createModel(p, { model: effectiveModel ?? null })
}

export type DeepAgentRunOptions = {
  messages?: ChatMessage[]
  model?: string
  /** When provided, work-item tools will execute real DB updates and broadcast. */
  toolContext?: WorkItemToolContext
  /** MCP tool configs from DB; each is connected and registered as LangChain tools. */
  mcpToolConfigs?: McpToolRow[]
  /** Project path (e.g. from DB). When set, Cursor CLI runs with this as cwd and --workspace. */
  workspace?: string
}

/**
 * Run agent with Deep Agents: create agent per run with model, system prompt, and tools;
 * stream using LangGraph streamMode "messages" and map to StreamChunk.
 */
export async function* runAgentStream(
  agent: AgentRecord,
  context: AgentContext,
  options?: DeepAgentRunOptions
): AsyncIterable<StreamChunk> {
  const messages = options?.messages ?? buildAgentPrompt(agent, context)
  const provider = (agent.ai_provider ?? 'ollama').toLowerCase()

  // Cursor: use CLI instead of API (stream-json + stream-partial-output for content; thinking not available in CLI print mode).
  // When toolContext is set, __AGENT_ACTION__ lines in the stream are executed as work-item tools.
  // When workspace is set, CLI runs with cwd and --workspace so the agent runs in the project directory.
  if (provider === 'cursor') {
    const model = options?.model ?? agent.model ?? DEFAULT_MODELS.cursor
    yield* runCursorCLIStream(messages, {
      model: model ?? undefined,
      toolContext: options?.toolContext,
      workspace: options?.workspace ?? undefined,
    })
    return
  }

  const lcMessages: BaseMessage[] = chatMessagesToLangChain(messages)
  const modelString = toDeepAgentModelString(provider, options?.model ?? agent.model)
  const model = resolveModel(modelString, provider)
  const workItemTools: StructuredToolInterface[] = options?.toolContext
    ? createWorkItemTools(options.toolContext)
    : LANGCHAIN_TOOLS
  const mcpTools =
    (options?.mcpToolConfigs?.length ?? 0) > 0
      ? await createMcpLangChainTools(options.mcpToolConfigs ?? [])
      : []
  const tools: StructuredToolInterface[] = [
    ...workItemTools,
    ...(options?.toolContext ? [writeFileTool] : []),
    ...mcpTools,
  ]

  const systemPrompt =
    messages.find((m) => m.role === 'system')?.content ?? 'You are a helpful assistant.'
  const deepAgent = createDeepAgent({
    model,
    systemPrompt,
    tools,
  })

  const input = { messages: lcMessages }
  const config = {
    configurable: { thread_id: `run-${agent.id}-${Date.now()}` },
    streamMode: 'messages' as const,
  }

  const stream = await deepAgent.stream(input, config)

  for await (const event of stream) {
    const chunk = event as unknown
    if (!chunk || typeof chunk !== 'object') continue

    // LangGraph streamMode "messages" can yield [token, metadata] or wrapped events
    const token = Array.isArray(chunk) ? chunk[0] : (chunk as { token?: unknown }).token ?? chunk
    if (!token || typeof token !== 'object') continue

    const content = (token as { content?: unknown }).content
    const additional_kwargs = (token as { additional_kwargs?: Record<string, unknown> })
      .additional_kwargs
    const tool_call_chunks = (token as { tool_call_chunks?: Array<{ name?: string; args?: string; index?: number | string }> })
      .tool_call_chunks
    const tool_calls = (token as { tool_calls?: Array<{ id?: string; name: string; args?: unknown }> })
      .tool_calls
    const contentBlocks = (token as {
      contentBlocks?: Array<{ type?: string; text?: string; reasoning?: string; thinking?: string; input?: string }>
    }).contentBlocks

    // Content as string
    if (typeof content === 'string' && content) {
      yield { type: 'content', text: content }
    }

    // Content blocks (reasoning/thinking + text). LangChain normalizes to "reasoning"; providers may send "thinking".
    if (Array.isArray(contentBlocks)) {
      for (const block of contentBlocks) {
        if (!block || typeof block !== 'object') continue
        const b = block as {
          type?: string
          text?: string
          reasoning?: string
          thinking?: string
          input?: string
        }
        const isReasoningBlock = b.type === 'reasoning' || b.type === 'thinking'
        if (isReasoningBlock) {
          const thinkingText =
            typeof b.reasoning === 'string'
              ? b.reasoning
              : typeof b.thinking === 'string'
                ? b.thinking
                : typeof b.text === 'string'
                  ? b.text
                  : typeof b.input === 'string'
                    ? b.input
                    : ''
          if (thinkingText) yield { type: 'thinking', text: thinkingText }
        }
        if (b.type === 'text' && typeof b.text === 'string' && b.text) {
          yield { type: 'content', text: b.text }
        }
      }
    }

    // Array content (multi-block)
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === 'object' && 'type' in block) {
          const b = block as {
            type: string
            text?: string
            reasoning?: string
            thinking?: string
            input?: string
          }
          const isReasoningBlock = b.type === 'reasoning' || b.type === 'thinking'
          if (isReasoningBlock) {
            const t =
              typeof b.reasoning === 'string'
                ? b.reasoning
                : typeof b.thinking === 'string'
                  ? b.thinking
                  : typeof b.text === 'string'
                    ? b.text
                    : typeof b.input === 'string'
                      ? b.input
                      : ''
            if (t) yield { type: 'thinking', text: t }
          }
          if (b.type === 'text' && typeof b.text === 'string' && b.text) {
            yield { type: 'content', text: b.text }
          }
        }
      }
    }

    // additional_kwargs reasoning/thinking
    if (additional_kwargs) {
      if (
        typeof additional_kwargs.reasoning_content === 'string' &&
        additional_kwargs.reasoning_content
      ) {
        yield { type: 'thinking', text: additional_kwargs.reasoning_content }
      }
      if (
        typeof additional_kwargs.thinking === 'string' &&
        additional_kwargs.thinking
      ) {
        yield { type: 'thinking', text: additional_kwargs.thinking }
      }
    }

    // Tool call chunks
    if (Array.isArray(tool_call_chunks)) {
      for (const tc of tool_call_chunks) {
        const name = tc?.name ?? ''
        const args = tc?.args ?? ''
        const id =
          typeof tc?.index === 'number'
            ? `call_${tc.index}`
            : typeof tc?.index === 'string'
              ? tc.index
              : `call_${name}`
        if (name) {
          yield {
            type: 'tool_call',
            id,
            name,
            arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
          }
        }
      }
    }

    // Full tool_calls
    if (Array.isArray(tool_calls)) {
      for (const tc of tool_calls) {
        const args =
          typeof tc.args === 'object' && tc.args !== null
            ? JSON.stringify(tc.args)
            : (tc.args as string) ?? '{}'
        yield {
          type: 'tool_call',
          id: tc.id ?? `call_${tc.name}`,
          name: tc.name,
          arguments: args,
        }
      }
    }
  }
}

/**
 * Non-streaming run: invoke the deep agent once and return final content + tool calls.
 */
export async function runAgent(
  agent: AgentRecord,
  context: AgentContext,
  options?: DeepAgentRunOptions
): Promise<{
  content: string
  toolCalls?: Array<{ id?: string; name: string; arguments: string | Record<string, unknown> }>
}> {
  const messages = options?.messages ?? buildAgentPrompt(agent, context)
  const provider = (agent.ai_provider ?? 'ollama').toLowerCase()

  // Cursor: use CLI (--output-format json); CLI result does not expose tool_calls in response
  if (provider === 'cursor') {
    const model = options?.model ?? agent.model ?? DEFAULT_MODELS.cursor
    const { content } = await runCursorCLI(messages, {
      model: model ?? undefined,
      workspace: options?.workspace ?? undefined,
    })
    return { content }
  }

  const lcMessages: BaseMessage[] = chatMessagesToLangChain(messages)
  const modelString = toDeepAgentModelString(provider, options?.model ?? agent.model)
  const model = resolveModel(modelString, provider)
  const workItemTools: StructuredToolInterface[] = options?.toolContext
    ? createWorkItemTools(options.toolContext)
    : LANGCHAIN_TOOLS
  const mcpTools =
    (options?.mcpToolConfigs?.length ?? 0) > 0
      ? await createMcpLangChainTools(options.mcpToolConfigs ?? [])
      : []
  const tools: StructuredToolInterface[] = [
    ...workItemTools,
    ...(options?.toolContext ? [writeFileTool] : []),
    ...mcpTools,
  ]

  const systemPrompt =
    messages.find((m) => m.role === 'system')?.content ?? 'You are a helpful assistant.'
  const deepAgent = createDeepAgent({ model, systemPrompt, tools })

  const input = { messages: lcMessages }
  const config = { configurable: { thread_id: `run-${agent.id}-${Date.now()}` } }

  const result = (await deepAgent.invoke(input, config)) as {
    messages?: BaseMessage[]
  }
  const lastMessages = result?.messages ?? []
  const lastAi = lastMessages.filter((m) => (m as { _getType?: () => string })._getType?.() === 'ai').pop() as
    | { content?: string; tool_calls?: Array<{ id?: string; name: string; args?: unknown }> }
    | undefined
  const content = typeof lastAi?.content === 'string' ? lastAi.content : ''
  const rawCalls = lastAi?.tool_calls
  const toolCalls = rawCalls?.map((tc) => ({
    id: tc.id,
    name: tc.name,
    arguments:
      typeof tc.args === 'string'
        ? tc.args
        : (typeof tc.args === 'object' && tc.args !== null ? tc.args : {}) as
            | string
            | Record<string, unknown>,
  }))
  return { content, toolCalls }
}
