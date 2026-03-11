/**
 * Minimal API client for the CLI: list projects/agents, create work item.
 */

export type Project = { id: string; name: string }
export type Agent = { id: string; name: string }
export type WorkItem = {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  status: string
  created_at: string
}

export async function listProjects(apiUrl: string): Promise<Project[]> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/projects`)
  if (!res.ok) throw new Error(`Failed to list projects: ${res.status} ${res.statusText}`)
  const rows = (await res.json()) as { id: string; name: string }[]
  return rows
}

export async function listAgents(apiUrl: string): Promise<Agent[]> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/agents`)
  if (!res.ok) throw new Error(`Failed to list agents: ${res.status} ${res.statusText}`)
  const rows = (await res.json()) as { id: string; name: string }[]
  return rows
}

export async function createWorkItem(
  apiUrl: string,
  projectId: string,
  body: {
    title: string
    description?: string | null
    assigned_to?: string | null
    require_approval?: boolean
  }
): Promise<WorkItem> {
  const base = apiUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/api/projects/${projectId}/work-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Failed to create work item: ${res.status}`)
  }
  return (await res.json()) as WorkItem
}
