/**
 * AI agent: LangChain-based providers + prompt builder.
 *
 * - Models: ollama, openai, cursor, anthropic via createModel() in langchain-model.
 * - Prompt: buildAgentPrompt(agent, context) returns ChatMessage[].
 * - Run: runAgentStream(agent, context, options) streams StreamChunk (content, thinking, tool_call).
 */

export type {
  ChatMessage,
  ChatCompletionResult,
  ChatCompletionOptions,
  StreamChunk,
  Tool,
  ToolCall,
  ToolParameterSchema,
  ChatProvider,
  ProviderConfig,
  ProviderFactory,
  AgentRecord,
  AgentContext,
} from './types.js'

export { buildAgentPrompt, buildSystemMessage, buildUserMessage } from './prompt-builder.js'
export {
  buildContextForWorkItemCreated,
  buildContextForWorkItemAssignmentChange,
  buildContextForWorkItemApproved,
  buildContextForWorkItemCommented,
} from './event-prompts.js'
export { runAgentStream, runAgent } from './langchain-runner.js'
export { createModel } from './langchain-model.js'
export {
  LANGCHAIN_TOOLS,
  updateWorkItemStatusTool,
  addWorkItemCommentTool,
  listAvailableAgentsTool,
  createWorkItemAndAssignTool,
  requestForApprovalTool,
  createWorkItemTools,
  WORK_ITEM_STATUS_VALUES,
} from './langchain-tools.js'
export type { WorkItemToolContext } from './langchain-tools.js'
export type { DeepAgentRunOptions } from './langchain-runner.js'
