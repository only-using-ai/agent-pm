const API_BASE =
  (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:38472'

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, '')
}

export type Project = {
  id: string
  name: string
  priority: string | null
  description: string | null
  path: string | null
  project_context: string | null
  created_at: string
  archived_at?: string | null
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${getApiBase()}/api/projects`)
  if (!res.ok) throw new Error('Failed to list projects')
  return res.json()
}

export type CreateProjectBody = {
  name: string
  priority?: string | null
  description?: string | null
  path?: string | null
}

export async function createProject(body: CreateProjectBody): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to create project')
  }
  return res.json()
}

export async function getProject(id: string): Promise<Project | null> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch project')
  return res.json()
}

export type UpdateProjectBody = {
  name?: string
  priority?: string | null
  description?: string | null
  path?: string | null
  project_context?: string | null
}

export async function updateProject(id: string, body: UpdateProjectBody): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update project')
  }
  return res.json()
}

export async function archiveProject(id: string): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}/archive`, {
    method: 'PATCH',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to archive project')
  }
  return res.json()
}

export type Agent = {
  id: string
  name: string
  team_id: string
  instructions: string | null
  ai_provider: string | null
  model: string | null
  created_at: string
}

export async function listAgents(): Promise<Agent[]> {
  const res = await fetch(`${getApiBase()}/api/agents`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export type CreateAgentBody = {
  name: string
  team_id: string
  instructions?: string | null
  ai_provider?: string | null
  model?: string | null
}

export async function createAgent(body: CreateAgentBody): Promise<Agent> {
  const res = await fetch(`${getApiBase()}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name.trim(),
      team_id: body.team_id,
      instructions: body.instructions ?? null,
      ai_provider: body.ai_provider ?? null,
      model: body.model ?? null,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to create agent')
  return data as Agent
}

export async function archiveAgent(id: string): Promise<{ id: string; name: string; archived_at: string }> {
  const res = await fetch(`${getApiBase()}/api/agents/${id}/archive`, {
    method: 'PATCH',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to archive agent')
  }
  return res.json()
}

export type Team = {
  id: string
  name: string
  created_at: string
}

export async function listTeams(): Promise<Team[]> {
  const res = await fetch(`${getApiBase()}/api/teams`)
  if (!res.ok) throw new Error('Failed to fetch teams')
  return res.json()
}

export async function createTeam(name: string): Promise<Team> {
  const res = await fetch(`${getApiBase()}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed')
  return data as Team
}

// Project columns (Kanban)
export type ProjectColumn = {
  project_id: string
  id: string
  title: string
  color: string
  position: number
}

export async function listProjectColumns(projectId: string): Promise<ProjectColumn[]> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/columns`)
  if (!res.ok) throw new Error('Failed to list columns')
  return res.json()
}

export type CreateProjectColumnBody = {
  title: string
  color?: string
}

export async function createProjectColumn(
  projectId: string,
  body: CreateProjectColumnBody
): Promise<ProjectColumn> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to create column')
  }
  return res.json()
}

export type UpdateProjectColumnBody = {
  title?: string
  color?: string
  position?: number
}

export async function updateProjectColumn(
  projectId: string,
  columnId: string,
  body: UpdateProjectColumnBody
): Promise<ProjectColumn> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/columns/${encodeURIComponent(columnId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update column')
  }
  return res.json()
}

export async function deleteProjectColumn(
  projectId: string,
  columnId: string
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/columns/${encodeURIComponent(columnId)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to delete column')
  }
}

// Work items
export type WorkItemPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type WorkItemStatus = 'todo' | 'in_progress' | 'completed' | 'blocked' | 'canceled'

export type WorkItem = {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  priority: WorkItemPriority
  depends_on: string | null
  /** Column id (e.g. 'todo' or custom column id) */
  status: string
  require_approval: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type WorkItemComment = {
  id: string
  work_item_id: string
  author_type: 'user' | 'agent'
  author_id: string | null
  body: string
  created_at: string
  mentioned_agent_ids?: string[]
}

export type WorkItemWithComments = WorkItem & {
  comments: WorkItemComment[]
  asset_ids?: string[]
}

export type WorkItemWithProject = WorkItem & { project_name: string }

export async function listAllWorkItems(options?: {
  includeArchived?: boolean
}): Promise<WorkItemWithProject[]> {
  const url = new URL(`${getApiBase()}/api/work-items`)
  if (options?.includeArchived) url.searchParams.set('archived', '1')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to list work items')
  return res.json()
}

export async function listWorkItems(
  projectId: string,
  options?: { includeArchived?: boolean }
): Promise<WorkItem[]> {
  const url = new URL(`${getApiBase()}/api/projects/${projectId}/work-items`)
  if (options?.includeArchived) url.searchParams.set('archived', '1')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to list work items')
  return res.json()
}

export async function getWorkItem(projectId: string, workItemId: string): Promise<WorkItemWithComments | null> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/work-items/${workItemId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch work item')
  return res.json()
}

export type CreateWorkItemBody = {
  title: string
  description?: string | null
  assigned_to?: string | null
  priority?: WorkItemPriority
  depends_on?: string | null
  /** Column id (defaults to 'todo' if not provided) */
  status?: string
  require_approval?: boolean
  asset_ids?: string[]
}

export async function createWorkItem(projectId: string, body: CreateWorkItemBody): Promise<WorkItem> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/work-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to create work item')
  }
  return res.json()
}

export type UpdateWorkItemBody = Partial<{
  title: string
  description: string | null
  assigned_to: string | null
  priority: WorkItemPriority
  depends_on: string | null
  /** Column id when moving between columns */
  status: string
  require_approval: boolean
  asset_ids: string[]
}>

export async function updateWorkItem(
  projectId: string,
  workItemId: string,
  body: UpdateWorkItemBody
): Promise<WorkItem> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/work-items/${workItemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update work item')
  }
  return res.json()
}

export async function archiveWorkItem(projectId: string, workItemId: string): Promise<WorkItem> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/work-items/${workItemId}/archive`, {
    method: 'PATCH',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to archive work item')
  }
  return res.json()
}

export async function addWorkItemComment(
  projectId: string,
  workItemId: string,
  body: string,
  options?: {
    author_type?: 'user' | 'agent'
    author_id?: string | null
    mentioned_agent_ids?: string[]
  }
): Promise<WorkItemComment> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/work-items/${workItemId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body,
      author_type: options?.author_type ?? 'user',
      author_id: options?.author_id ?? null,
      mentioned_agent_ids: options?.mentioned_agent_ids ?? [],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to add comment')
  }
  return res.json()
}

// Inbox (approval requests and info requests)
export type InboxItemRow = {
  id: string
  project_id: string
  work_item_id: string
  agent_id: string | null
  agent_name: string
  body: string
  status: string
  created_at: string
  resolved_at: string | null
  type?: 'approval' | 'info_request'
}

export async function listInbox(options?: { status?: 'pending' | 'all' }): Promise<InboxItemRow[]> {
  const status = options?.status ?? 'pending'
  const url = status === 'all' ? `${getApiBase()}/api/inbox?status=all` : `${getApiBase()}/api/inbox`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to list inbox')
  return res.json()
}

export async function approveInboxItem(id: string): Promise<InboxItemRow> {
  const res = await fetch(`${getApiBase()}/api/inbox/${id}/approve`, { method: 'PATCH' })
  if (!res.ok) throw new Error('Failed to approve')
  return res.json()
}

export async function rejectInboxItem(id: string): Promise<InboxItemRow> {
  const res = await fetch(`${getApiBase()}/api/inbox/${id}/reject`, { method: 'PATCH' })
  if (!res.ok) throw new Error('Failed to reject')
  return res.json()
}

// MCP tools
export type McpTool = {
  id: string
  name: string
  type: 'command' | 'url'
  command?: string | null
  args?: string[] | null
  url?: string | null
  env?: Record<string, string> | null
  description?: string | null
  created_at: string
}

export async function listMcpTools(): Promise<McpTool[]> {
  const res = await fetch(`${getApiBase()}/api/mcp`)
  if (!res.ok) throw new Error('Failed to load MCP tools')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export type CreateMcpToolBody = {
  name: string
  type: 'command' | 'url'
  command?: string | null
  args?: string[]
  url?: string | null
  env?: Record<string, string>
  description?: string | null
}

export async function createMcpTool(body: CreateMcpToolBody): Promise<McpTool> {
  const res = await fetch(`${getApiBase()}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      type: body.type,
      command: body.command ?? null,
      args: body.args ?? [],
      url: body.url ?? null,
      env: body.env ?? {},
      description: body.description ?? null,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to add MCP tool')
  return data as McpTool
}

export type UpdateMcpToolBody = Partial<{
  name: string
  command: string | null
  args: string[] | null
  url: string | null
  env: Record<string, string> | null
  description: string | null
}>

export async function updateMcpTool(id: string, body: UpdateMcpToolBody): Promise<McpTool> {
  const res = await fetch(`${getApiBase()}/api/mcp/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to update MCP tool')
  return data as McpTool
}

export async function deleteMcpTool(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/mcp/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Failed to remove MCP tool')
  }
}

// Prompts (settings)
export type Prompt = {
  key: string
  name: string
  content: string
  updated_at: string
}

export async function listPrompts(): Promise<Prompt[]> {
  const res = await fetch(`${getApiBase()}/api/prompts`)
  if (!res.ok) throw new Error('Failed to list prompts')
  return res.json()
}

export async function getPrompt(key: string): Promise<Prompt | null> {
  const res = await fetch(`${getApiBase()}/api/prompts/${encodeURIComponent(key)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch prompt')
  return res.json()
}

export type UpdatePromptBody = {
  name?: string
  content?: string
}

export async function updatePrompt(
  key: string,
  body: UpdatePromptBody
): Promise<Prompt> {
  const res = await fetch(`${getApiBase()}/api/prompts/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update prompt')
  }
  return res.json()
}

// Context (additional context markdown + files in .agent-pm)
export type ContextFileEntry = {
  name: string
  size: number
  updatedAt: string
}

export async function getContext(): Promise<{ content: string }> {
  const res = await fetch(`${getApiBase()}/api/context`)
  if (!res.ok) throw new Error('Failed to load context')
  return res.json()
}

export async function updateContext(content: string): Promise<{ content: string }> {
  const res = await fetch(`${getApiBase()}/api/context`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to save context')
  }
  return res.json()
}

export async function listContextFiles(): Promise<ContextFileEntry[]> {
  const res = await fetch(`${getApiBase()}/api/context/files`)
  if (!res.ok) throw new Error('Failed to list context files')
  const data = await res.json()
  return data.files ?? []
}

export async function uploadContextFile(file: File): Promise<ContextFileEntry> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${getApiBase()}/api/context/files`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to upload file')
  }
  return res.json()
}

export async function deleteContextFile(name: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/context/files/${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  )
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to delete file')
  }
}

// Project directory tree (filesystem)
export type FileSystemTreeNode = {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children: FileSystemTreeNode[]
}

export async function listProjectFiles(
  projectId: string
): Promise<{ tree: FileSystemTreeNode[] }> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/files`)
  if (!res.ok) throw new Error('Failed to list project files')
  return res.json()
}

export async function getProjectFileContent(
  projectId: string,
  filePath: string
): Promise<{ content: string }> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to read file')
  }
  return res.json()
}

export async function updateProjectFileContent(
  projectId: string,
  filePath: string,
  content: string
): Promise<{ content: string }> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to write file')
  }
  return res.json()
}

export async function deleteProjectFile(
  projectId: string,
  filePath: string
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`,
    { method: 'DELETE' }
  )
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to delete file')
  }
}

// Assets (per project, tree follows project base path)
export type AssetType = 'file' | 'link' | 'folder'
export type Asset = {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  type: AssetType
  path: string | null
  url: string | null
  created_at: string
}
export type AssetTreeNode = Asset & { children: AssetTreeNode[] }

export async function listAssets(projectId: string): Promise<{ flat: Asset[]; tree: AssetTreeNode[] }> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/assets`)
  if (!res.ok) throw new Error('Failed to list assets')
  return res.json()
}

export async function getAsset(projectId: string, assetId: string): Promise<Asset | null> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/assets/${assetId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch asset')
  return res.json()
}

export type CreateAssetBody = {
  name: string
  type: AssetType
  parent_id?: string | null
  path?: string | null
  url?: string | null
  work_item_ids?: string[]
}

export async function createAsset(projectId: string, body: CreateAssetBody): Promise<Asset> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to create asset')
  }
  return res.json()
}

export type UpdateAssetBody = Partial<{
  name: string
  type: AssetType
  parent_id: string | null
  path: string | null
  url: string | null
}>

export async function updateAsset(
  projectId: string,
  assetId: string,
  body: UpdateAssetBody
): Promise<Asset> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update asset')
  }
  return res.json()
}

export async function deleteAsset(projectId: string, assetId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to delete asset')
  }
}

// Profile (current user)
export type Profile = {
  first_name: string
  last_name: string
  avatar_url: string | null
}

export async function getProfile(): Promise<Profile> {
  const res = await fetch(`${getApiBase()}/api/profile`)
  if (!res.ok) throw new Error('Failed to load profile')
  return res.json()
}

export type UpdateProfileBody = {
  first_name?: string
  last_name?: string
}

export async function updateProfile(body: UpdateProfileBody): Promise<Profile> {
  const res = await fetch(`${getApiBase()}/api/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update profile')
  }
  return res.json()
}

export async function uploadProfileAvatar(file: File): Promise<Profile> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${getApiBase()}/api/profile/avatar`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to upload avatar')
  }
  return res.json()
}

export function getProfileAvatarUrl(): string {
  return `${getApiBase()}/api/profile/avatar`
}

export async function linkAssetToWorkItem(
  projectId: string,
  workItemId: string,
  assetId: string
): Promise<{ linked: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/projects/${projectId}/work-items/${workItemId}/assets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to link asset to work item')
  }
  return res.json()
}
