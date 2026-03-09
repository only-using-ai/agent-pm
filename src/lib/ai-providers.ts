/**
 * AI provider options for agent configuration.
 * Ids must match server/agent/langchain-model.ts and API routes.
 */

export const AI_PROVIDERS = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'anthropic', label: 'Claude' },
] as const

export type AiProviderId = (typeof AI_PROVIDERS)[number]['id']
