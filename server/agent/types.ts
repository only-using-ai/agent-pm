/**
 * Shared types for the AI agent architecture.
 * Providers implement ChatProvider; the registry maps provider ids to factories.
 */

/** A single message in a chat (role + content). Assistant may include tool_calls; tool results use role 'tool' and tool_call_id. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** For assistant messages: tool calls requested by the model. */
  tool_calls?: ToolCall[]
  /** For tool result messages: id of the tool call this result answers. */
  tool_call_id?: string
}

/** Response from a provider after completion. */
export interface ChatCompletionResult {
  content: string
  /** Optional provider-specific metadata (e.g. model, usage). */
  meta?: Record<string, unknown>
  /** Tool calls requested by the model when tools were provided. */
  toolCalls?: ToolCall[]
}

/** JSON Schema for a tool parameter (subset used for tool definitions). */
export type ToolParameterSchema = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: string[] | number[] | boolean[]
  properties?: Record<string, ToolParameterSchema>
  items?: ToolParameterSchema
  required?: string[]
}

/** A tool the model can call. Providers send these to the LLM and handle tool_call responses. */
export interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties?: Record<string, ToolParameterSchema>
    required?: string[]
  }
}

/** A single tool call returned by the model (name + raw arguments string). */
export interface ToolCall {
  id?: string
  name: string
  arguments: string | Record<string, unknown>
}

/** Options passed when calling a provider (model override, temperature, etc.). */
export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  /** Tools to make available to the model. When provided, provider may return toolCalls. */
  tools?: Tool[]
}

/** A single chunk from a streaming response; can be content, thinking, or tool call. */
export type StreamChunk =
  | { type: 'content'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; arguments: string | Record<string, unknown>; id?: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }

/**
 * Provider-specific config (API keys, base URLs). Keys depend on the provider.
 * Loaded from env or passed when registering.
 */
export type ProviderConfig = Record<string, string | number | boolean | undefined>

/**
 * A pluggable AI chat provider (Ollama, Claude, Cursor, etc.).
 * Each provider is created by a factory that receives config.
 */
export interface ChatProvider {
  readonly id: string

  /**
   * Run a completion with the given messages and optional options.
   * When options.tools is provided, the provider may return toolCalls in the result.
   */
  chat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>

  /**
   * Stream a completion; yields content, thinking, and/or tool_call chunks.
   * When options.tools is provided, the provider may yield tool_call or tool_calls chunks.
   */
  stream?(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncIterable<string | StreamChunk>
}

/**
 * Factory that creates a provider instance. Called when the provider
 * is first requested (lazy). Config typically comes from env (e.g. API keys).
 */
export type ProviderFactory = (config?: ProviderConfig) => ChatProvider

/** Agent record as stored (e.g. from DB); used by prompt builder. */
export interface AgentRecord {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider?: string | null
  model?: string | null
}

/** Context passed to the prompt builder (e.g. work item, project, user request). */
export interface AgentContext {
  /** Optional task or user request (e.g. "Summarize this work item"). */
  userMessage?: string
  /** Optional structured context to include (work item, comment, project, etc.). */
  context?: Record<string, unknown>
  /** Optional key-value pairs to render in the prompt (e.g. work_item_title, project_name). */
  variables?: Record<string, string>
}
