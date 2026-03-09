/**
 * Services index: re-export all services and the SSE broadcaster factory.
 * Use this for a single import surface; index.ts can also import from individual files.
 */

export * from './types.js'
export * from './agents.service.js'
export * from './teams.service.js'
export * from './projects.service.js'
export * from './project-columns.service.js'
export * from './work-items.service.js'
export * from './ollama.service.js'
export * from './cursor.service.js'
export * from './anthropic.service.js'
export { createSseBroadcaster, type SseBroadcaster } from './sse.service.js'
export {
  createWorkItemCreatedHandler,
  type WorkItemCreatedHandlerDeps,
  type AgentStreamChunk,
} from './work-item-created-handler.js'
