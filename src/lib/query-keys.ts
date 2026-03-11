/**
 * Central query key factory for cache consistency and invalidation.
 * All query keys used by the frontend data layer should be defined here.
 */
export const queryKeys = {
  all: ['agent-pm'] as const,
  projects: {
    all: () => [...queryKeys.all, 'projects'] as const,
    detail: (id: string) => [...queryKeys.projects.all(), id] as const,
  },
  agents: {
    all: () => [...queryKeys.all, 'agents'] as const,
    detail: (id: string) => [...queryKeys.agents.all(), id] as const,
  },
  teams: {
    all: () => [...queryKeys.all, 'teams'] as const,
  },
  inbox: {
    all: (status?: 'pending' | 'all') =>
      [...queryKeys.all, 'inbox', status ?? 'pending'] as readonly [string, string, string],
  },
  mcp: {
    all: () => [...queryKeys.all, 'mcp'] as const,
  },
  workItems: {
    all: (params?: { includeArchived?: boolean }) =>
      [...queryKeys.all, 'work-items', params ?? {}] as const,
    byProject: (projectId: string, params?: { includeArchived?: boolean }) =>
      [...queryKeys.all, 'work-items', 'project', projectId, params ?? {}] as const,
    detail: (projectId: string, workItemId: string) =>
      [...queryKeys.workItems.byProject(projectId), workItemId] as const,
  },
  columns: (projectId: string) => [...queryKeys.all, 'projects', projectId, 'columns'] as const,
  prompts: {
    all: () => [...queryKeys.all, 'prompts'] as const,
    detail: (key: string) => [...queryKeys.prompts.all(), key] as const,
  },
  context: () => [...queryKeys.all, 'context'] as const,
  contextFiles: () => [...queryKeys.all, 'context', 'files'] as const,
  profile: () => [...queryKeys.all, 'profile'] as const,
  projectFiles: (projectId: string) => [...queryKeys.all, 'projects', projectId, 'files'] as const,
  assets: (projectId: string) => [...queryKeys.all, 'projects', projectId, 'assets'] as const,
  asset: (projectId: string, assetId: string) =>
    [...queryKeys.assets(projectId), assetId] as const,
} as const
