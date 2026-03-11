import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAllWorkItems, type WorkItemWithProject } from '@/lib/api'
import { useAgents } from '@/contexts/agents-context'
import { useAgentStream } from '@/contexts/agent-stream-context'
import { useProjects } from '@/contexts/projects-context'
import {
  useInboxQuery,
  useApproveInboxItemMutation,
  useRejectInboxItemMutation,
} from '@/hooks/queries'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bot,
  Check,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Loader2,
  Plus,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const { agents, loading: agentsLoading } = useAgents()
  const { data: inboxItems = [], isLoading: inboxLoading } = useInboxQuery()
  const approveInbox = useApproveInboxItemMutation()
  const rejectInbox = useRejectInboxItemMutation()
  const { activeWorkItemIds, streamingAgentIds } = useAgentStream()
  const { projects, loading: projectsLoading } = useProjects()
  const [workItems, setWorkItems] = useState<WorkItemWithProject[]>([])
  const [workItemsLoading, setWorkItemsLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const handleApprove = async (id: string) => {
    setApprovingId(id)
    try {
      await approveInbox.mutateAsync(id)
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (id: string) => {
    setApprovingId(id)
    try {
      await rejectInbox.mutateAsync(id)
    } finally {
      setApprovingId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    setWorkItemsLoading(true)
    listAllWorkItems()
      .then((data) => {
        if (!cancelled) setWorkItems(data)
      })
      .catch(() => {
        if (!cancelled) setWorkItems([])
      })
      .finally(() => {
        if (!cancelled) setWorkItemsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const latestPendingApproval = inboxItems.find(
    (r) => r.type === 'approval' || r.type === undefined
  )
  const inProgressCount = workItems.filter((i) => i.status === 'in_progress').length
  const totalWorkItems = workItems.length
  const liveAgents = agents.filter((a) => streamingAgentIds.has(a.id))
  const workItemsBeingWorkedOn = workItems.filter((w) => activeWorkItemIds.has(w.id))
  const loading = agentsLoading || projectsLoading || workItemsLoading
  const approvalCardLoading = inboxLoading

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Overview of agents, projects, and work in progress.
          </p>
        </div>
        <Button
          onClick={() => navigate('/work-items', { state: { openCreate: true } })}
        >
          <Plus className="size-4" />
          New work item
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* In progress work items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In progress</CardTitle>
            <ListTodo className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-bold">{inProgressCount}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  work items in progress
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total work items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total work items</CardTitle>
            <ListTodo className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-bold">{totalWorkItems}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  across all projects
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Agents count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Bot className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-bold">{agents.length}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  configured agents
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Projects count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-bold">{projects.length}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  active projects
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latest pending approval */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ThumbsUp className="size-4 text-muted-foreground" />
            Latest pending approval
          </CardTitle>
          <Link
            to="/inbox"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View inbox
            <ChevronRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvalCardLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : latestPendingApproval ? (
            <>
              <Link
                to="/inbox"
                className="block transition-opacity hover:opacity-90 rounded-md -m-1 p-1"
              >
                <p className="text-sm font-medium line-clamp-1">
                  {latestPendingApproval.body.split('\n')[0]?.trim() ||
                    latestPendingApproval.body.slice(0, 80) + (latestPendingApproval.body.length > 80 ? '…' : '')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  From {latestPendingApproval.agent_name}
                  {' · '}
                  {new Date(latestPendingApproval.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(latestPendingApproval.id)}
                  disabled={approvingId === latestPendingApproval.id}
                  className="gap-1.5"
                >
                  {approvingId === latestPendingApproval.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(latestPendingApproval.id)}
                  disabled={approvingId === latestPendingApproval.id}
                  className="gap-1.5"
                >
                  <ThumbsDown className="size-4" />
                  Reject
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">No pending approvals</p>
              <Button size="sm" variant="outline" asChild>
                <Link to="/inbox">View inbox</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work items being worked on by agents */}
      {workItemsBeingWorkedOn.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  'inline-flex size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                )}
                aria-hidden
              />
              Being worked on by agent
            </CardTitle>
            <CardDescription>
              Work items that an agent is actively working on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {workItemsBeingWorkedOn.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/projects/${w.project_id}?workItem=${w.id}`}
                    className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn(
                        'shrink-0 size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                      )}
                    />
                    <span className="font-medium truncate">{w.title}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {projects.find((p) => p.id === w.project_id)?.name ?? w.project_id}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Live agents card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Live agents
            {liveAgents.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <span
                  className={cn(
                    'inline-flex size-2 rounded-full bg-emerald-500',
                    'dark:bg-emerald-400'
                  )}
                  aria-hidden
                />
                {liveAgents.length} streaming
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Agents currently running and streaming output.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : liveAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No agents are currently running.
            </p>
          ) : (
            <ul className="space-y-2">
              {liveAgents.map((agent) => (
                <li key={agent.id}>
                  <Link
                    to={`/agents/${agent.id}`}
                    className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="relative flex size-2">
                      <span
                        className={cn(
                          'absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75',
                          'dark:bg-emerald-500'
                        )}
                      />
                      <span
                        className={cn(
                          'relative inline-flex size-2 rounded-full bg-emerald-500',
                          'dark:bg-emerald-400'
                        )}
                      />
                    </span>
                    <span className="font-medium">{agent.name}</span>
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
