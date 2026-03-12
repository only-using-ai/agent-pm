/**
 * LangChain model factory: creates the appropriate chat model for a given provider id.
 * Supports: ollama (OpenAI-compatible API), openai, anthropic.
 *
 * Cursor and Gemini are not created here: agent runs use the CLI via cursor-cli-runner
 * and gemini-cli-runner (see langchain-runner). Model lists come from cursor.service and gemini.service.
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { config as serverConfig } from '../config.js'

export type ProviderConfig = Record<string, string | number | boolean | undefined>

/**
 * Create a LangChain chat model for the given provider id.
 * Uses env vars for API keys and defaults when not in config.
 */
export function createModel(
  providerId: string,
  options?: { model?: string | null; config?: ProviderConfig }
): BaseChatModel {
  const id = providerId.toLowerCase()
  const modelName = options?.model ?? undefined
  const config = options?.config ?? {}

  switch (id) {
    case 'ollama': {
      // Ollama exposes OpenAI-compatible API at baseUrl/v1; no real API key needed
      const base = (config.baseUrl as string) ?? serverConfig.ollama.baseUrl
      const baseUrl = base.replace(/\/$/, '').endsWith('/v1') ? base.replace(/\/$/, '') : `${base.replace(/\/$/, '')}/v1`
      const model = (modelName ?? config.model ?? serverConfig.ollama.defaultModel) as string
      return new ChatOpenAI({
        apiKey: 'ollama', // placeholder; Ollama does not validate it (ChatOpenAI only reads fields.apiKey, not openAIApiKey)
        configuration: { baseURL: baseUrl },
        model,
        temperature: config.temperature as number | undefined,
        maxTokens: config.maxTokens as number | undefined,
      })
    }
    case 'openai': {
      const apiKey = (config.apiKey as string) ?? serverConfig.openai.apiKey
      if (!apiKey) {
        throw new Error(
          'OpenAI API key required. Set OPENAI_API_KEY or use a different agent provider (e.g. ollama).'
        )
      }
      const baseUrl = (config.baseUrl as string) ?? serverConfig.openai.baseUrl
      const model = (modelName ?? config.model ?? serverConfig.openai.defaultModel) as string
      return new ChatOpenAI({
        apiKey,
        configuration: baseUrl ? { baseURL: baseUrl } : undefined,
        model,
        temperature: config.temperature as number | undefined,
        maxTokens: config.maxTokens as number | undefined,
      })
    }
    case 'cursor':
      throw new Error(
        'Cursor uses the CLI for agent runs, not the API. createModel("cursor") is not used; runAgentStream/runAgent handle cursor via cursor-cli-runner.'
      )
    case 'gemini':
      throw new Error(
        'Gemini uses the CLI for agent runs, not the API. createModel("gemini") is not used; runAgentStream/runAgent handle gemini via gemini-cli-runner.'
      )
    case 'anthropic': {
      const apiKey = (config.apiKey as string) ?? serverConfig.anthropic.apiKey
      const model = (modelName ?? config.model ?? serverConfig.anthropic.defaultModel) as string
      return new ChatAnthropic({
        anthropicApiKey: apiKey || undefined,
        model,
        temperature: config.temperature as number | undefined,
        maxTokens: config.maxTokens as number | undefined,
      })
    }
    default:
      throw new Error(
        `Unknown AI provider: ${providerId}. Supported: ollama, openai, anthropic (cursor and gemini use CLI, not createModel)`
      )
  }
}
