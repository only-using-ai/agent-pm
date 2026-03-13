import type { Express } from 'express'
import { createAgentsRouter, createAiModelsRouter } from './agents.js'
import { createTeamsRouter } from './teams.js'
import { createProjectsRouter } from './projects.js'
import { createColumnsRouter } from './columns.js'
import { createMcpRouter } from './mcp.js'
import { createWorkItemsRouter, createProjectWorkItemsRouter } from './work-items.js'
import { createAssetsRouter, createWorkItemAssetsRouter } from './assets.js'
import { createInboxRouter } from './inbox.js'
import { createContextRouter } from './context.js'
import { createProfileRouter } from './profile.js'
import { createPromptsRouter } from './prompts.js'
import { createProjectFilesRouter } from './project-files.js'
import { createDatabaseRouter } from './database.js'
import type { RouteDeps } from './types.js'

/**
 * Mount all API route modules on the Express app under /api.
 */
export function mountRoutes(app: Express, deps: RouteDeps): void {
  app.use('/api/agents', createAgentsRouter(deps))
  app.use('/api', createAiModelsRouter(deps))
  app.use('/api/teams', createTeamsRouter(deps))
  app.use('/api/projects', createProjectsRouter(deps))
  app.use('/api/projects/:projectId/columns', createColumnsRouter(deps))
  app.use('/api/mcp', createMcpRouter(deps))
  app.use('/api/work-items', createWorkItemsRouter(deps))
  app.use('/api/projects/:projectId/work-items/:workItemId/assets', createWorkItemAssetsRouter(deps))
  app.use('/api/projects/:projectId/work-items', createProjectWorkItemsRouter(deps))
  app.use('/api/inbox', createInboxRouter(deps))
  app.use('/api/context', createContextRouter(deps))
  app.use('/api/profile', createProfileRouter(deps))
  app.use('/api/prompts', createPromptsRouter(deps))
  app.use('/api/projects/:projectId/files', createProjectFilesRouter(deps))
  app.use('/api/projects/:projectId/assets', createAssetsRouter(deps))
  app.use('/api/database', createDatabaseRouter(deps))
}
