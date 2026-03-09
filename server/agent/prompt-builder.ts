/**
 * Builds the chat message array (system + user) for an agent run.
 * Combines agent instructions with optional context and user message.
 */

import type { ChatMessage } from './types.js'
import type { AgentRecord, AgentContext } from './types.js'

const DEFAULT_SYSTEM_PREFIX = `You are an AI assistant. Follow the instructions below. Be concise and helpful.`

/**
 * Renders a simple template: replaces {{key}} with context.variables[key].
 */
function renderTemplate(template: string, variables: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return key in variables ? String(variables[key]) : `{{${key}}}`
  })
}

/**
 * Serialize context object into a readable block for the prompt.
 */
function formatContextBlock(context: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      lines.push(`## ${label}\n${JSON.stringify(value, null, 2)}`)
    } else {
      lines.push(`**${label}:** ${String(value)}`)
    }
  }
  return lines.join('\n\n')
}

/**
 * Build the system message: agent instructions (with optional template variables)
 * plus any inline context block.
 */
export function buildSystemMessage(agent: AgentRecord, ctx: AgentContext = {}): string {
  const parts: string[] = []

  const instructions = agent.instructions?.trim()
  if (instructions) {
    const variables = ctx.variables ?? {}
    parts.push(renderTemplate(instructions, variables))
  } else {
    parts.push(DEFAULT_SYSTEM_PREFIX)
  }

  if (ctx.context && Object.keys(ctx.context).length > 0) {
    parts.push('\n\n---\n**Current context (use this to inform your response):**\n')
    parts.push(formatContextBlock(ctx.context))
  }

  return parts.join('').trim()
}

/**
 * Build the user-facing message. If context has a userMessage, use it;
 * otherwise a generic prompt so the model still has a clear “request”.
 */
export function buildUserMessage(ctx: AgentContext = {}): string {
  if (ctx.userMessage?.trim()) {
    return ctx.userMessage.trim()
  }
  if (ctx.context && Object.keys(ctx.context).length > 0) {
    return 'Based on the context provided above, respond appropriately (e.g. summarize, suggest, or answer).'
  }
  return 'Please respond based on your instructions.'
}

/**
 * Build the full message array for a provider: one system message, then one user message.
 * Use this before calling provider.chat(messages, options).
 */
export function buildAgentPrompt(agent: AgentRecord, context: AgentContext = {}): ChatMessage[] {
  const system = buildSystemMessage(agent, context)
  const user = buildUserMessage(context)
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
