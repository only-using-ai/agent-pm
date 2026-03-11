import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  listAllWorkItems,
  listProjects,
  listProjectColumns,
  listWorkItems,
  createWorkItem,
  type WorkItemWithProject,
  type WorkItemPriority,
  type CreateWorkItemBody,
  type ProjectColumn,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAgents } from '@/contexts/agents-context'
import { useInbox } from '@/contexts/inbox-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DialogRoot,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  canceled: 'Canceled',
}

const PRIORITY_CLASS: Record<string, string> = {
  Low: 'text-muted-foreground',
  Medium: '',
  High: 'text-amber-600 dark:text-amber-400',
  Critical: 'text-red-600 dark:text-red-400 font-medium',
}

const PRIORITIES: WorkItemPriority[] = ['Low', 'Medium', 'High', 'Critical']

type CreateForm = {
  project_id: string
  title: string
  description: string
  priority: WorkItemPriority
  assigned_to: string | null
  depends_on: string | null
  status: string
  require_approval: boolean
}

const defaultCreateForm: CreateForm = {
  project_id: '',
  title: '',
  description: '',
  priority: 'Medium',
  assigned_to: null,
  depends_on: null,
  status: 'todo',
  require_approval: false,
}

export function WorkItemsPage() {
  const { agents } = useAgents()
  const { refetch: refetchInbox } = useInbox()
  const location = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState<WorkItemWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreateForm)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [columns, setColumns] = useState<ProjectColumn[]>([])
  const [projectWorkItems, setProjectWorkItems] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    setLoading(true)
    listAllWorkItems()
      .then(setItems)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load work items')
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!createModalOpen) return
    listProjects().then((list) => setProjects(list.map((p) => ({ id: p.id, name: p.name }))))
  }, [createModalOpen])

  useEffect(() => {
    if (!createForm.project_id) {
      setColumns([])
      setProjectWorkItems([])
      setCreateForm((f) => ({ ...f, status: 'todo', depends_on: null }))
      return
    }
    listProjectColumns(createForm.project_id).then((cols) => {
      setColumns(cols)
      const todoId = cols.find((c) => c.id === 'todo')?.id ?? cols[0]?.id ?? 'todo'
      setCreateForm((f) => ({ ...f, status: todoId }))
    })
    listWorkItems(createForm.project_id).then((list) =>
      setProjectWorkItems(list.map((w) => ({ id: w.id, title: w.title })))
    )
  }, [createForm.project_id])

  const openCreateModal = useCallback(() => {
    setCreateForm(defaultCreateForm)
    setCreateError(null)
    setCreateModalOpen(true)
  }, [])

  // Open create modal when navigated with state.openCreate (e.g. from dashboard or assets page)
  useEffect(() => {
    const state = location.state as {
      openCreate?: boolean
      title?: string
      description?: string
      project_id?: string
    } | null
    if (state?.openCreate && !loading) {
      setCreateForm((_prev) => ({
        ...defaultCreateForm,
        ...(state.title != null && { title: state.title }),
        ...(state.description != null && { description: state.description }),
        ...(state.project_id != null && { project_id: state.project_id }),
      }))
      setCreateError(null)
      setCreateModalOpen(true)
      navigate('/work-items', { replace: true, state: {} })
    }
  }, [location.state, loading, navigate])

  const submitCreateWorkItem = useCallback(async () => {
    if (!createForm.project_id || !createForm.title.trim()) return
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const body: CreateWorkItemBody = {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || null,
        priority: createForm.priority,
        assigned_to: createForm.assigned_to || null,
        depends_on: createForm.depends_on || null,
        status: createForm.status,
        require_approval: createForm.require_approval,
      }
      const created = await createWorkItem(createForm.project_id, body)
      setItems((prev) => [
        { ...created, project_name: projects.find((p) => p.id === created.project_id)?.name ?? '' },
        ...prev,
      ])
      setCreateModalOpen(false)
      if (createForm.require_approval) await refetchInbox()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create work item')
    } finally {
      setCreateSubmitting(false)
    }
  }, [createForm, projects, refetchInbox])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h2 className="text-xl font-semibold">Work Items</h2>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h2 className="text-xl font-semibold">Work Items</h2>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Work Items</h2>
        <Button onClick={openCreateModal}>
          <Plus className="size-4" />
          Create Work Item
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {items.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            No work items yet. Create items from a project board or use the button above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/projects/${item.project_id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/projects/${item.project_id}`}
                        className="text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {item.project_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(PRIORITY_CLASS[item.priority])}>
                        {item.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogRoot open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-xl border-l-4 border-l-primary">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Create work item
            </div>
            <DialogTitle className="sr-only">Create Work Item</DialogTitle>
            <form
              className="mt-3 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                submitCreateWorkItem()
              }}
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Project</Label>
                <Select
                  value={createForm.project_id}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, project_id: v || '' }))
                  }
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-title" className="text-xs font-medium text-muted-foreground">
                  Summary
                </Label>
                <Input
                  id="create-title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Enter a short summary"
                  className="text-base font-medium"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-description" className="text-xs font-medium text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  id="create-description"
                  value={createForm.description ?? ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in more detail…"
                  rows={4}
                  className="resize-y min-h-[100px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
                <Select
                  value={createForm.assigned_to ?? ''}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, assigned_to: v || null }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
                  <Select
                    value={createForm.priority ?? 'Medium'}
                    onValueChange={(v) =>
                      setCreateForm((f) => ({ ...f, priority: v as WorkItemPriority }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(v) =>
                      setCreateForm((f) => ({ ...f, status: v ?? 'todo' }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todo" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                      {columns.length === 0 && (
                        <SelectItem value="todo">Todo</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Depends on</Label>
                <Select
                  value={createForm.depends_on ?? ''}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, depends_on: v || null }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {projectWorkItems.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="create-require-approval" className="text-sm font-medium cursor-pointer">
                    Require approval before starting
                  </Label>
                  <Switch
                    id="create-require-approval"
                    checked={createForm.require_approval}
                    onCheckedChange={(checked) =>
                      setCreateForm((f) => ({ ...f, require_approval: checked ?? false }))
                    }
                  />
                </div>
                {createForm.require_approval && (
                  <p className="text-xs text-muted-foreground">
                    Item will appear in Inbox; the agent starts after you approve.
                  </p>
                )}
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
                  disabled={createSubmitting}
                >
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={createSubmitting || !createForm.title.trim() || !createForm.project_id}
                >
                  {createSubmitting ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>
    </div>
  )
}
