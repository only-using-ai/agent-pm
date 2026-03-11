/**
 * React Query hooks for the frontend data layer.
 * Provides caching, automatic refetch, and mutation invalidation so callers
 * don't need to manually refetch after mutations.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import * as api from '@/lib/api'

// —— Projects ——
export function useProjectsQuery(
  options?: Omit<UseQueryOptions<api.Project[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: api.listProjects,
    ...options,
  })
}

export function useProjectQuery(
  id: string | undefined | null,
  options?: Omit<UseQueryOptions<api.Project | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? ''),
    queryFn: () => api.getProject(id!),
    enabled: !!id,
    ...options,
  })
}

export function useCreateProjectMutation(
  opts?: UseMutationOptions<api.Project, Error, api.CreateProjectBody>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.all() })
    },
    ...opts,
  })
}

export function useUpdateProjectMutation(
  opts?: UseMutationOptions<api.Project, Error, { id: string; body: api.UpdateProjectBody }>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => api.updateProject(id, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.projects.detail(data.id) })
    },
    ...opts,
  })
}

export function useArchiveProjectMutation(
  opts?: UseMutationOptions<api.Project, Error, string>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveProject,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.projects.detail(data.id) })
    },
    ...opts,
  })
}

// —— Agents ——
export function useAgentsQuery(
  options?: Omit<UseQueryOptions<api.Agent[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.agents.all(),
    queryFn: api.listAgents,
    ...options,
  })
}

export function useCreateAgentMutation(
  opts?: UseMutationOptions<api.Agent, Error, api.CreateAgentBody>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createAgent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agents.all() })
    },
    ...opts,
  })
}

export function useArchiveAgentMutation(
  opts?: UseMutationOptions<
    { id: string; name: string; archived_at: string },
    Error,
    string
  >
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.archiveAgent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.agents.all() })
    },
    ...opts,
  })
}

// —— Teams ——
export function useTeamsQuery(
  options?: Omit<UseQueryOptions<api.Team[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.teams.all(),
    queryFn: api.listTeams,
    ...options,
  })
}

export function useCreateTeamMutation(
  opts?: UseMutationOptions<api.Team, Error, string>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTeam,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.teams.all() })
    },
    ...opts,
  })
}

// —— Inbox ——
export function useInboxQuery(
  options?: { status?: 'pending' | 'all' } & Omit<
    UseQueryOptions<api.InboxItemRow[]>,
    'queryKey' | 'queryFn'
  >
) {
  const { status = 'pending', ...rest } = options ?? {}
  return useQuery({
    queryKey: queryKeys.inbox.all(status),
    queryFn: () => api.listInbox({ status }),
    ...rest,
  })
}

export function useApproveInboxItemMutation(
  opts?: UseMutationOptions<api.InboxItemRow, Error, string>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.approveInboxItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inbox.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.inbox.all('all') })
    },
    ...opts,
  })
}

export function useRejectInboxItemMutation(
  opts?: UseMutationOptions<api.InboxItemRow, Error, string>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.rejectInboxItem,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inbox.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.inbox.all('all') })
    },
    ...opts,
  })
}

// —— MCP ——
export function useMcpToolsQuery(
  options?: Omit<UseQueryOptions<api.McpTool[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.mcp.all(),
    queryFn: api.listMcpTools,
    ...options,
  })
}

export function useCreateMcpToolMutation(
  opts?: UseMutationOptions<api.McpTool, Error, api.CreateMcpToolBody>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createMcpTool,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mcp.all() })
    },
    ...opts,
  })
}

export function useUpdateMcpToolMutation(
  opts?: UseMutationOptions<api.McpTool, Error, { id: string; body: api.UpdateMcpToolBody }>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }) => api.updateMcpTool(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mcp.all() })
    },
    ...opts,
  })
}

export function useDeleteMcpToolMutation(
  opts?: UseMutationOptions<void, Error, string>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteMcpTool,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mcp.all() })
    },
    ...opts,
  })
}

// —— Work items (for invalidation from mutations) ——
export function useWorkItemsByProjectQuery(
  projectId: string | undefined | null,
  params?: { includeArchived?: boolean },
  options?: Omit<UseQueryOptions<api.WorkItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.workItems.byProject(projectId ?? '', params),
    queryFn: () => api.listWorkItems(projectId!, params),
    enabled: !!projectId,
    ...options,
  })
}

export function useAllWorkItemsQuery(
  params?: { includeArchived?: boolean },
  options?: Omit<UseQueryOptions<api.WorkItemWithProject[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.workItems.all(params),
    queryFn: () => api.listAllWorkItems(params),
    ...options,
  })
}

export function useWorkItemQuery(
  projectId: string | undefined | null,
  workItemId: string | undefined | null,
  options?: Omit<UseQueryOptions<api.WorkItemWithComments | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.workItems.detail(projectId ?? '', workItemId ?? ''),
    queryFn: () => api.getWorkItem(projectId!, workItemId!),
    enabled: !!projectId && !!workItemId,
    ...options,
  })
}

export function useCreateWorkItemMutation(
  projectId: string,
  opts?: UseMutationOptions<api.WorkItem, Error, api.CreateWorkItemBody>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.createWorkItem(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.workItems.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.workItems.byProject(projectId) })
    },
    ...opts,
  })
}

export function useUpdateWorkItemMutation(
  projectId: string,
  workItemId: string,
  opts?: UseMutationOptions<api.WorkItem, Error, api.UpdateWorkItemBody>
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.updateWorkItem(projectId, workItemId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.workItems.all() })
      void qc.invalidateQueries({ queryKey: queryKeys.workItems.byProject(projectId) })
      void qc.invalidateQueries({
        queryKey: queryKeys.workItems.detail(projectId, workItemId),
      })
    },
    ...opts,
  })
}

export function useAddWorkItemCommentMutation(
  projectId: string,
  workItemId: string,
  opts?: UseMutationOptions<
    api.WorkItemComment,
    Error,
    string
  >
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) =>
      api.addWorkItemComment(projectId, workItemId, body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.workItems.detail(projectId, workItemId),
      })
      void qc.invalidateQueries({ queryKey: queryKeys.workItems.byProject(projectId) })
    },
    ...opts,
  })
}
