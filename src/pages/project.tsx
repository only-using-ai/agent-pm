import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, GripVertical, Plus, Settings2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjects } from '@/contexts/projects-context'
import { useAgents } from '@/contexts/agents-context'
import { useAgentStream } from '@/contexts/agent-stream-context'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  listProjectColumns,
  createProjectColumn,
  updateProjectColumn,
  deleteProjectColumn,
  listWorkItems,
  getWorkItem,
  createWorkItem,
  updateWorkItem,
  archiveWorkItem,
  addWorkItemComment,
  listAssets,
  type WorkItem,
  type WorkItemWithComments,
  type WorkItemComment,
  type WorkItemPriority,
  type CreateWorkItemBody,
  type ProjectColumn,
  type Asset,
} from '@/lib/api'

const COLOR_OPTIONS = [
  { value: 'bg-muted/50', label: 'Gray' },
  { value: 'bg-blue-500/10 border-blue-500/30', label: 'Blue' },
  { value: 'bg-green-500/10 border-green-500/30', label: 'Green' },
  { value: 'bg-amber-500/10 border-amber-500/30', label: 'Amber' },
  { value: 'bg-red-500/10 border-red-500/30', label: 'Red' },
  { value: 'bg-purple-500/10 border-purple-500/30', label: 'Purple' },
  { value: 'bg-cyan-500/10 border-cyan-500/30', label: 'Cyan' },
] as const

const PRIORITIES: WorkItemPriority[] = ['Low', 'Medium', 'High', 'Critical']

export type KanbanColumn = ProjectColumn

export interface KanbanItem {
  id: string
  title: string
  status: string
}

function KanbanCard({
  item,
  isDragging,
  onClick,
}: {
  item: KanbanItem
  isDragging?: boolean
  onClick?: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm transition-shadow cursor-pointer hover:border-primary/50 hover:bg-muted/30',
        isDragging && 'opacity-90 shadow-md ring-2 ring-primary'
      )}
    >
      {item.title}
    </div>
  )
}

function DroppableColumn({
  column,
  items,
  onMoveItem,
  onRemoveColumn,
  onEditColumn,
  onAddItem,
  onItemClick,
  onDragStartItem,
  onDragEndItem,
  canRemove,
  headerLeft,
  isColumnDropTarget,
  onColumnDrop,
  isColumnDragActive,
  onColumnDragOver,
  onColumnDragLeave,
}: {
  column: KanbanColumn
  items: KanbanItem[]
  onMoveItem: (itemId: string, columnId: string) => void
  onRemoveColumn: () => void
  onEditColumn?: () => void
  onAddItem?: (columnId: string) => void
  onItemClick?: (itemId: string) => void
  onDragStartItem?: () => void
  onDragEndItem?: () => void
  canRemove: boolean
  headerLeft?: React.ReactNode
  isColumnDropTarget?: boolean
  onColumnDrop?: (draggedColumnId: string, targetColumnId: string) => void
  isColumnDragActive?: boolean
  onColumnDragOver?: () => void
  onColumnDragLeave?: () => void
}) {
  const [isOver, setIsOver] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (isColumnDragActive && onColumnDragOver) onColumnDragOver()
      setIsOver(true)
    },
    [isColumnDragActive, onColumnDragOver]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (onColumnDragLeave) onColumnDragLeave()
      setIsOver(false)
    },
    [onColumnDragLeave]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsOver(false)
      const columnId = e.dataTransfer.getData('application/x-kanban-column')
      if (columnId && columnId !== column.id && onColumnDrop) {
        onColumnDrop(columnId, column.id)
        return
      }
      const itemId = e.dataTransfer.getData('application/x-kanban-item')
      if (itemId) onMoveItem(itemId, column.id)
    },
    [column.id, onMoveItem, onColumnDrop]
  )

  return (
    <div
      className={cn(
        'flex min-w-[200px] flex-1 flex-col rounded-xl border-2 border-dashed p-3 transition-colors',
        column.color,
        isOver && 'border-primary bg-primary/5',
        isColumnDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-column-id={column.id}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {headerLeft}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {column.title}
          </h3>
        </div>
        {(onEditColumn || canRemove) && (
          <div
            className={cn(
              'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity',
              showActions && 'opacity-100'
            )}
          >
            {onEditColumn && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditColumn()
                }}
                aria-label={`Edit column ${column.title}`}
              >
                <Settings2 className="size-3.5" />
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveColumn()
                }}
                aria-label={`Remove column ${column.title}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-kanban-item', item.id)
              e.dataTransfer.effectAllowed = 'move'
              onDragStartItem?.()
            }}
            onDragEnd={() => onDragEndItem?.()}
            className="cursor-grab active:cursor-grabbing"
          >
            <KanbanCard
              item={item}
              onClick={() => {
                if (onItemClick) onItemClick(item.id)
              }}
            />
          </div>
        ))}
        {onAddItem && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAddItem(column.id)
            }}
            className={cn(
              'mt-1 flex min-h-[32px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent py-1.5 text-xs text-muted-foreground',
              'transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
            aria-label={`Add item to ${column.title}`}
          >
            <Plus className="size-3.5" />
            <span>Add card</span>
          </button>
        )}
      </div>
    </div>
  )
}

function workItemsToKanban(items: WorkItem[]): KanbanItem[] {
  return items.map((w) => ({ id: w.id, title: w.title, status: w.status }))
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects } = useProjects()
  const { agents } = useAgents()
  const { lastWorkItemStatusUpdate } = useAgentStream()
  const { refetch: refetchInbox } = useInbox()
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [columnsLoading, setColumnsLoading] = useState(true)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [newColumnColor, setNewColumnColor] = useState<string>(COLOR_OPTIONS[0].value)
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null)
  const [editColumnForm, setEditColumnForm] = useState<{ title: string; color: string }>({
    title: '',
    color: COLOR_OPTIONS[0].value,
  })
  const [editColumnSubmitting, setEditColumnSubmitting] = useState(false)
  const [editColumnError, setEditColumnError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateWorkItemBody>({
    title: '',
    description: '',
    priority: 'Medium',
    assigned_to: null,
    depends_on: null,
    status: 'todo',
    require_approval: false,
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingWorkItemId, setEditingWorkItemId] = useState<string | null>(null)
  const [editingWorkItem, setEditingWorkItem] = useState<WorkItemWithComments | null>(null)
  const [editForm, setEditForm] = useState<CreateWorkItemBody>({
    title: '',
    description: '',
    priority: 'Medium',
    assigned_to: null,
    depends_on: null,
    status: 'todo',
    require_approval: false,
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [mentionedAgentIds, setMentionedAgentIds] = useState<string[]>([])
  const [mentionDropdown, setMentionDropdown] = useState<{ show: boolean; filter: string; startIndex: number }>({
    show: false,
    filter: '',
    startIndex: 0,
  })
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)
  const [projectAssets, setProjectAssets] = useState<Asset[]>([])
  const [linkedAssetIds, setLinkedAssetIds] = useState<string[]>([])
  const [addAssetSelectValue, setAddAssetSelectValue] = useState('')
  const dragInProgressRef = useRef(false)
  /** Column IDs to hide from the board (status filter). */
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(new Set())
  const [columnDragId, setColumnDragId] = useState<string | null>(null)
  const [columnDropTargetId, setColumnDropTargetId] = useState<string | null>(null)
  const [, setReorderingColumns] = useState(false)

  const project = projectId ? projects.find((p) => p.id === projectId) : null
  const projectName = project?.name ?? 'Project'
  const items = workItemsToKanban(workItems)

  const fetchColumns = useCallback(async () => {
    if (!projectId) return
    setColumnsLoading(true)
    try {
      const data = await listProjectColumns(projectId)
      setColumns(data)
    } catch {
      setColumns([])
    } finally {
      setColumnsLoading(false)
    }
  }, [projectId])

  const fetchWorkItems = useCallback(async () => {
    if (!projectId) return
    setItemsLoading(true)
    try {
      const data = await listWorkItems(projectId)
      setWorkItems(data)
    } catch {
      setWorkItems([])
    } finally {
      setItemsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchColumns()
  }, [fetchColumns])

  useEffect(() => {
    fetchWorkItems()
  }, [fetchWorkItems])

  // Open work item modal when navigating with ?workItem=id (e.g. from command palette)
  const workItemParam = searchParams.get('workItem')
  useEffect(() => {
    if (!projectId || !workItemParam || workItems.length === 0) return
    const exists = workItems.some((w) => w.id === workItemParam)
    if (exists) setEditingWorkItemId(workItemParam)
  }, [projectId, workItemParam, workItems])

  // Sync work item status when an agent updates it via tool (e.g. update_work_item_status)
  useEffect(() => {
    const u = lastWorkItemStatusUpdate
    if (!u || !projectId || u.project_id !== projectId) return
    setWorkItems((prev) =>
      prev.map((w) => (w.id === u.work_item_id ? { ...w, status: u.status } : w))
    )
  }, [lastWorkItemStatusUpdate, projectId])

  const moveItem = useCallback(
    async (itemId: string, newStatus: string) => {
      if (!projectId) return
      const prev = workItems.find((w) => w.id === itemId)
      if (!prev || prev.status === newStatus) return
      setWorkItems((prevItems) =>
        prevItems.map((w) => (w.id === itemId ? { ...w, status: newStatus } : w))
      )
      try {
        await updateWorkItem(projectId, itemId, { status: newStatus })
      } catch {
        await fetchWorkItems()
      }
    },
    [projectId, workItems, fetchWorkItems]
  )

  const removeColumn = useCallback(
    async (columnId: string) => {
      if (!projectId || columns.length <= 1) return
      try {
        await deleteProjectColumn(projectId, columnId)
        setColumns((prev) => prev.filter((c) => c.id !== columnId))
        await fetchWorkItems()
      } catch {
        // Could toast or set error state
      }
    },
    [projectId, columns.length, fetchWorkItems]
  )

  const addColumn = useCallback(async () => {
    const title = newColumnTitle.trim()
    if (!title || !projectId) return
    try {
      const col = await createProjectColumn(projectId, {
        title,
        color: newColumnColor,
      })
      setColumns((prev) => [...prev, col])
      setNewColumnTitle('')
      setNewColumnColor(COLOR_OPTIONS[0].value)
      setAddingColumn(false)
    } catch {
      // Could toast or set error state
    }
  }, [projectId, newColumnTitle, newColumnColor])

  const cancelAddColumn = useCallback(() => {
    setAddingColumn(false)
    setNewColumnTitle('')
    setNewColumnColor(COLOR_OPTIONS[0].value)
  }, [])

  const openEditColumnModal = useCallback((column: KanbanColumn) => {
    setEditingColumn(column)
    setEditColumnForm({ title: column.title, color: column.color })
    setEditColumnError(null)
  }, [])

  const closeEditColumnModal = useCallback(() => {
    setEditingColumn(null)
    setEditColumnError(null)
  }, [])

  const submitEditColumn = useCallback(async () => {
    if (!projectId || !editingColumn || !editColumnForm.title.trim()) return
    setEditColumnSubmitting(true)
    setEditColumnError(null)
    try {
      const updated = await updateProjectColumn(projectId, editingColumn.id, {
        title: editColumnForm.title.trim(),
        color: editColumnForm.color,
      })
      setColumns((prev) =>
        prev.map((c) => (c.id === editingColumn.id ? updated : c))
      )
      closeEditColumnModal()
    } catch (e) {
      setEditColumnError(e instanceof Error ? e.message : 'Failed to update column')
    } finally {
      setEditColumnSubmitting(false)
    }
  }, [projectId, editingColumn, editColumnForm, closeEditColumnModal])

  const todoColumnId = columns.find((c) => c.id === 'todo')?.id ?? columns[0]?.id ?? 'todo'

  const openCreateModal = useCallback(() => {
    setCreateForm({
      title: '',
      description: '',
      priority: 'Medium',
      assigned_to: null,
      depends_on: null,
      status: todoColumnId,
    })
    setCreateError(null)
    setCreateModalOpen(true)
  }, [todoColumnId])

  const openCreateModalForColumn = useCallback(
    (columnId: string) => {
      setCreateForm({
        title: '',
        description: '',
        priority: 'Medium',
        assigned_to: null,
        depends_on: null,
        status: columnId,
      })
      setCreateError(null)
      setCreateModalOpen(true)
    },
    []
  )

  const submitCreateWorkItem = useCallback(async () => {
    if (!projectId || !createForm.title.trim()) return
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const created = await createWorkItem(projectId, {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || null,
        priority: createForm.priority,
        assigned_to: createForm.assigned_to || null,
        depends_on: createForm.depends_on || null,
        status: createForm.status,
        require_approval: createForm.require_approval ?? false,
      })
      setWorkItems((prev) => [created, ...prev])
      setCreateModalOpen(false)
      if (createForm.require_approval) await refetchInbox()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create work item')
    } finally {
      setCreateSubmitting(false)
    }
  }, [projectId, createForm, refetchInbox])

  useEffect(() => {
    if (!projectId || !editingWorkItemId) return
    let cancelled = false
    setEditingWorkItem(null)
    Promise.all([
      getWorkItem(projectId, editingWorkItemId),
      listAssets(projectId).then((r) => r.flat),
    ]).then(([data, flat]) => {
      if (!cancelled && data) {
        setEditingWorkItem(data)
        setEditForm({
          title: data.title,
          description: data.description ?? '',
          priority: data.priority,
          assigned_to: data.assigned_to ?? null,
          depends_on: data.depends_on ?? null,
          status: data.status,
          require_approval: data.require_approval ?? false,
        })
        setLinkedAssetIds(data.asset_ids ?? [])
        setEditError(null)
      }
      if (!cancelled) setProjectAssets(flat)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, editingWorkItemId])

  const openEditModal = useCallback((itemId: string) => {
    if (dragInProgressRef.current) return
    setEditingWorkItemId(itemId)
    setNewComment('')
  }, [])

  const closeEditModal = useCallback(() => {
    setEditingWorkItemId(null)
    setEditingWorkItem(null)
    setLinkedAssetIds([])
    setEditError(null)
    if (searchParams.has('workItem')) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('workItem')
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const submitEditWorkItem = useCallback(async () => {
    if (!projectId || !editingWorkItemId || !editForm.title.trim()) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      const updated = await updateWorkItem(projectId, editingWorkItemId, {
        title: editForm.title.trim(),
        description: editForm.description?.trim() || null,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        depends_on: editForm.depends_on || null,
        status: editForm.status,
        require_approval: editForm.require_approval ?? false,
        asset_ids: linkedAssetIds,
      })
      setWorkItems((prev) =>
        prev.map((w) => (w.id === editingWorkItemId ? updated : w))
      )
      setEditingWorkItem((prev) => (prev ? { ...prev, ...updated, asset_ids: linkedAssetIds } : null))
      closeEditModal()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update work item')
    } finally {
      setEditSubmitting(false)
    }
  }, [projectId, editingWorkItemId, editForm, linkedAssetIds, closeEditModal])

  const submitComment = useCallback(async () => {
    if (!projectId || !editingWorkItemId || !newComment.trim()) return
    setCommentSubmitting(true)
    try {
      const comment = await addWorkItemComment(
        projectId,
        editingWorkItemId,
        newComment.trim(),
        { author_type: 'user', mentioned_agent_ids: mentionedAgentIds }
      )
      setEditingWorkItem((prev) =>
        prev ? { ...prev, comments: [...prev.comments, comment] } : null
      )
      setNewComment('')
      setMentionedAgentIds([])
      setMentionDropdown((prev) => ({ ...prev, show: false }))
    } finally {
      setCommentSubmitting(false)
    }
  }, [projectId, editingWorkItemId, newComment, mentionedAgentIds])

  const filteredAgentsForMention = useMemo(
    () =>
      mentionDropdown.show
        ? agents.filter((a) =>
            a.name.toLowerCase().includes(mentionDropdown.filter.toLowerCase().trim())
          )
        : [],
    [mentionDropdown.show, mentionDropdown.filter, agents]
  )

  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      const start = e.target.selectionStart ?? 0
      setNewComment(text)
      const lastAt = text.slice(0, start).lastIndexOf('@')
      if (lastAt === -1) {
        setMentionDropdown((prev) => (prev.show ? { ...prev, show: false } : prev))
        return
      }
      const filter = text.slice(lastAt + 1, start)
      if (/\s/.test(filter)) {
        setMentionDropdown((prev) => (prev.show ? { ...prev, show: false } : prev))
        return
      }
      setMentionDropdown({ show: true, filter, startIndex: lastAt })
    },
    []
  )

  const handleCommentKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        submitComment()
        return
      }
      if (e.key === '@' && !mentionDropdown.show) {
        const ta = e.currentTarget
        const start = ta.selectionStart ?? 0
        setMentionDropdown({ show: true, filter: '', startIndex: start })
        return
      }
      if (mentionDropdown.show) {
        if (e.key === 'Escape') {
          setMentionDropdown((prev) => ({ ...prev, show: false }))
          e.preventDefault()
        } else if (e.key === 'Enter' && filteredAgentsForMention.length > 0) {
          e.preventDefault()
          const agent = filteredAgentsForMention[0]
          const ta = e.currentTarget
          const before = newComment.slice(0, mentionDropdown.startIndex)
          const after = newComment.slice(ta.selectionStart ?? 0)
          const insert = `@${agent.name} `
          setNewComment(before + insert + after)
          setMentionedAgentIds((prev) => (prev.includes(agent.id) ? prev : [...prev, agent.id]))
          setMentionDropdown({ show: false, filter: '', startIndex: 0 })
          setTimeout(() => {
            const newPos = (before + insert).length
            ta.setSelectionRange(newPos, newPos)
            ta.focus()
          }, 0)
        }
      }
    },
    [mentionDropdown, newComment, filteredAgentsForMention, submitComment]
  )

  const selectMentionAgent = useCallback(
    (agent: { id: string; name: string }) => {
      const ta = commentTextareaRef.current
      if (!ta) return
      const start = mentionDropdown.startIndex
      const end = ta.selectionStart ?? start
      const before = newComment.slice(0, start)
      const after = newComment.slice(end)
      const insert = `@${agent.name} `
      setNewComment(before + insert + after)
      setMentionedAgentIds((prev) => (prev.includes(agent.id) ? prev : [...prev, agent.id]))
      setMentionDropdown({ show: false, filter: '', startIndex: 0 })
      setTimeout(() => {
        const newPos = (before + insert).length
        ta.setSelectionRange(newPos, newPos)
        ta.focus()
      }, 0)
    },
    [mentionDropdown.startIndex, newComment]
  )

  const workItemsForDependsOn = workItems.filter((w) => w.id !== editingWorkItemId)

  const handleArchiveWorkItem = useCallback(async () => {
    if (!projectId || !editingWorkItemId) return
    setArchiveSubmitting(true)
    try {
      await archiveWorkItem(projectId, editingWorkItemId)
      setWorkItems((prev) => prev.filter((w) => w.id !== editingWorkItemId))
      closeEditModal()
    } finally {
      setArchiveSubmitting(false)
    }
  }, [projectId, editingWorkItemId, closeEditModal])

  const reorderColumns = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!projectId || fromIndex === toIndex) return
      const reordered = [...columns]
      const [removed] = reordered.splice(fromIndex, 1)
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      reordered.splice(insertIndex, 0, removed)
      setColumns(reordered)
      setReorderingColumns(true)
      try {
        await Promise.all(
          reordered.map((col, i) =>
            updateProjectColumn(projectId, col.id, { position: i })
          )
        )
      } catch {
        await fetchColumns()
      } finally {
        setReorderingColumns(false)
      }
    },
    [projectId, columns, fetchColumns]
  )

  const visibleColumns = columns.filter((c) => !hiddenColumnIds.has(c.id))

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">{projectName}</h1>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="size-4" />
          Create Work Item
        </Button>
      </div>

      {!columnsLoading && columns.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-normal text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              Status
              <span className="text-foreground">
                ({visibleColumns.length}/{columns.length})
              </span>
              <ChevronDown className="size-3.5 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={!hiddenColumnIds.has(col.id)}
                  onCheckedChange={(checked) => {
                    setHiddenColumnIds((prev) => {
                      const next = new Set(prev)
                      if (checked) next.delete(col.id)
                      else next.add(col.id)
                      return next
                    })
                  }}
                >
                  {col.title}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {columnsLoading || itemsLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            {visibleColumns.map((column) => (
              <DroppableColumn
                key={column.id}
                column={column}
                items={items.filter((i) => i.status === column.id)}
                onMoveItem={moveItem}
                onRemoveColumn={() => removeColumn(column.id)}
                onEditColumn={() => openEditColumnModal(column)}
                onAddItem={openCreateModalForColumn}
                onItemClick={openEditModal}
                onDragStartItem={() => {
                  dragInProgressRef.current = true
                }}
                onDragEndItem={() => {
                  setTimeout(() => {
                    dragInProgressRef.current = false
                  }, 0)
                }}
                canRemove={columns.length > 1}
                isColumnDragActive={columnDragId !== null}
                isColumnDropTarget={columnDropTargetId === column.id}
                onColumnDragOver={() => {
                  if (column.id !== columnDragId) setColumnDropTargetId(column.id)
                }}
                onColumnDragLeave={() => setColumnDropTargetId(null)}
                onColumnDrop={(draggedId, targetId) => {
                  const from = columns.findIndex((c) => c.id === draggedId)
                  const to = columns.findIndex((c) => c.id === targetId)
                  if (from !== -1 && to !== -1) reorderColumns(from, to)
                  setColumnDragId(null)
                  setColumnDropTargetId(null)
                }}
                headerLeft={
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-kanban-column', column.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setColumnDragId(column.id)
                    }}
                    onDragEnd={() => {
                      setColumnDragId(null)
                      setColumnDropTargetId(null)
                    }}
                    className="cursor-grab active:cursor-grabbing touch-none rounded p-0.5 -m-0.5 text-muted-foreground hover:text-foreground"
                    title="Drag to reorder column"
                  >
                    <GripVertical className="size-3.5" />
                  </div>
                }
              />
            ))}
            {addingColumn ? (
              <div className="flex min-w-[200px] flex-col rounded-xl border-2 border-dashed border-border bg-muted/20 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  New column
                </h3>
                <Input
                  placeholder="Column name"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addColumn()
                    if (e.key === 'Escape') cancelAddColumn()
                  }}
                  className="mb-2"
                  autoFocus
                />
                <select
                  value={newColumnColor}
                  onChange={(e) => setNewColumnColor(e.target.value)}
                  className="mb-3 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addColumn} disabled={!newColumnTitle.trim()}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelAddColumn}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className={cn(
                  'flex min-w-[200px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 p-4',
                  'text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/30 hover:text-foreground'
                )}
              >
                <Plus className="size-5" />
                Add column
              </button>
            )}
          </>
        )}
      </div>

      <DialogRoot open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-xl border-l-4 border-l-primary max-h-[90vh] flex flex-col">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Create issue
            </div>
            <DialogTitle className="sr-only">Create Work Item</DialogTitle>
            <form
              className="mt-3 flex flex-1 flex-col gap-4 overflow-y-auto min-h-0"
              onSubmit={(e) => {
                e.preventDefault()
                submitCreateWorkItem()
              }}
            >
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
                  rows={6}
                  className="resize-none min-h-[120px] max-h-[200px] overflow-y-auto"
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
                    <SelectValue placeholder="Unassigned">
                      {createForm.assigned_to
                        ? (agents.find((a) => a.id === createForm.assigned_to)?.name ?? 'Unassigned')
                        : undefined}
                    </SelectValue>
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
                  <Label className="text-xs font-medium text-muted-foreground">Depends on</Label>
                  <Select
                    value={createForm.depends_on ?? ''}
                    onValueChange={(v) =>
                      setCreateForm((f) => ({ ...f, depends_on: v || null }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None">
                        {createForm.depends_on
                          ? (workItems.find((w) => w.id === createForm.depends_on)?.title ?? '—')
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {workItems.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="create-require-approval" className="text-sm font-medium cursor-pointer">
                    Require approval before starting
                  </Label>
                  <Switch
                    id="create-require-approval"
                    checked={createForm.require_approval ?? false}
                    onCheckedChange={(checked) =>
                      setCreateForm((f) => ({ ...f, require_approval: checked ?? false }))
                    }
                  />
                </div>
                {(createForm.require_approval ?? false) && (
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
                <Button type="submit" disabled={createSubmitting || !createForm.title.trim()}>
                  {createSubmitting ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>

      <DialogRoot open={editingColumn !== null} onOpenChange={(open) => !open && closeEditColumnModal()}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-md border-l-4 border-l-primary">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Column settings
            </div>
            <DialogTitle className="sr-only">Edit Column</DialogTitle>
            <form
              className="mt-3 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                submitEditColumn()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="edit-column-title" className="text-xs font-medium text-muted-foreground">
                  Display name
                </Label>
                <Input
                  id="edit-column-title"
                  value={editColumnForm.title}
                  onChange={(e) =>
                    setEditColumnForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Column name"
                  className="text-base font-medium"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-column-color" className="text-xs font-medium text-muted-foreground">
                  Background color
                </Label>
                <select
                  id="edit-column-color"
                  value={editColumnForm.color}
                  onChange={(e) =>
                    setEditColumnForm((f) => ({ ...f, color: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {editColumnError && (
                <p className="text-sm text-destructive">{editColumnError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
                  disabled={editColumnSubmitting}
                >
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={editColumnSubmitting || !editColumnForm.title.trim()}>
                  {editColumnSubmitting ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>

      <DialogRoot open={editingWorkItemId !== null} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-4xl w-full border-l-4 border-l-primary max-h-[90vh] flex flex-col">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Edit issue
            </div>
            <DialogTitle className="sr-only">Edit Work Item</DialogTitle>
            {!editingWorkItem ? (
              <div className="py-8 text-center text-muted-foreground">Loading…</div>
            ) : (
              <div className="flex flex-1 min-h-0 gap-4 mt-3">
                {/* Left: issue form */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-title" className="text-xs font-medium text-muted-foreground">
                      Summary
                    </Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Enter a short summary"
                      className="text-base font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-description" className="text-xs font-medium text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      id="edit-description"
                      value={editForm.description ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Describe the issue in more detail…"
                      rows={6}
                      className="resize-none min-h-[120px] max-h-[200px] overflow-y-auto"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Assignee</Label>
                    <Select
                      value={editForm.assigned_to ?? ''}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, assigned_to: v || null }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned">
                          {editForm.assigned_to
                            ? (agents.find((a) => a.id === editForm.assigned_to)?.name ?? 'Unassigned')
                            : undefined}
                        </SelectValue>
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
                        value={editForm.priority ?? 'Medium'}
                        onValueChange={(v) =>
                          setEditForm((f) => ({ ...f, priority: v as WorkItemPriority }))
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
                      <Label className="text-xs font-medium text-muted-foreground">Depends on</Label>
                      <Select
                        value={editForm.depends_on ?? ''}
                        onValueChange={(v) =>
                          setEditForm((f) => ({ ...f, depends_on: v || null }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None">
                            {editForm.depends_on
                              ? (workItemsForDependsOn.find((w) => w.id === editForm.depends_on)?.title ?? '—')
                              : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {workItemsForDependsOn.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                    <Label htmlFor="edit-require-approval" className="text-sm font-medium cursor-pointer">
                      Require approval before starting
                    </Label>
                    <Switch
                      id="edit-require-approval"
                      checked={editForm.require_approval ?? false}
                      onCheckedChange={(checked) =>
                        setEditForm((f) => ({ ...f, require_approval: checked ?? false }))
                      }
                    />
                  </div>

                  <div className="space-y-2 border-t border-border pt-4">
                    <Label className="text-xs font-medium text-muted-foreground">Linked assets</Label>
                    <div className="flex flex-wrap gap-2">
                      {linkedAssetIds.map((assetId) => {
                        const asset = projectAssets.find((a) => a.id === assetId)
                        return (
                          <span
                            key={assetId}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                          >
                            {asset?.name ?? assetId.slice(0, 8)}
                            <button
                              type="button"
                              className="rounded p-0.5 hover:bg-muted"
                              onClick={() =>
                                setLinkedAssetIds((prev) => prev.filter((id) => id !== assetId))
                              }
                              aria-label={`Remove ${asset?.name ?? 'asset'}`}
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        )
                      })}
                      {projectAssets.filter((a) => !linkedAssetIds.includes(a.id)).length > 0 && (
                        <Select
                          value={addAssetSelectValue}
                          onValueChange={(value) => {
                            if (value) {
                              setLinkedAssetIds((prev) => [...prev, value])
                              setAddAssetSelectValue('')
                            }
                          }}
                        >
                          <SelectTrigger className="w-auto h-8 min-w-[120px]">
                            <SelectValue placeholder="Add asset…" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectAssets
                              .filter((a) => !linkedAssetIds.includes(a.id))
                              .map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {linkedAssetIds.length === 0 && projectAssets.length === 0 && (
                      <p className="text-sm text-muted-foreground">No assets in this project yet. Add assets from the Assets page.</p>
                    )}
                  </div>

                  {editError && (
                    <p className="text-sm text-destructive">{editError}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={handleArchiveWorkItem}
                      disabled={archiveSubmitting || editSubmitting}
                    >
                      {archiveSubmitting ? 'Archiving…' : 'Archive'}
                    </Button>
                    <div className="flex gap-2">
                      <DialogClose
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted hover:text-foreground"
                        disabled={editSubmitting || archiveSubmitting}
                      >
                        Cancel
                      </DialogClose>
                      <Button
                        type="button"
                        onClick={submitEditWorkItem}
                        disabled={editSubmitting || archiveSubmitting || !editForm.title.trim()}
                      >
                        {editSubmitting ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right: comments */}
                <div className="w-80 flex-shrink-0 flex flex-col border-l border-border pl-4 min-h-0">
                  <Label className="text-xs font-medium text-muted-foreground mb-2">Comments</Label>
                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
                    {editingWorkItem.comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {editingWorkItem.comments.map((c) => (
                          <CommentItem key={c.id} comment={c} agents={agents} />
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 pt-3 border-t border-border mt-2">
                    <div className="relative">
                      <Textarea
                        ref={commentTextareaRef}
                        placeholder="Add a comment… (type @ to mention an agent)"
                        value={newComment}
                        onChange={handleCommentChange}
                        onKeyDown={handleCommentKeyDown}
                        rows={2}
                        className="resize-none min-h-[60px] max-h-[120px] overflow-y-auto"
                      />
                      {mentionDropdown.show && (
                        <div
                          className="absolute z-10 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-[180px] overflow-y-auto"
                          role="listbox"
                        >
                          {filteredAgentsForMention.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No agents match
                            </div>
                          ) : (
                            filteredAgentsForMention.map((agent) => (
                              <button
                                key={agent.id}
                                type="button"
                                role="option"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                                onClick={() => selectMentionAgent(agent)}
                              >
                                {agent.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitComment}
                      disabled={!newComment.trim() || commentSubmitting}
                      className="w-fit"
                    >
                      {commentSubmitting ? 'Sending…' : 'Add comment'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>
    </div>
  )
}

function CommentItem({ comment, agents }: { comment: WorkItemComment; agents: { id: string; name: string }[] }) {
  const authorName =
    comment.author_type === 'agent' && comment.author_id
      ? agents.find((a) => a.id === comment.author_id)?.name ?? 'Agent'
      : 'You'
  const date = new Date(comment.created_at).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return (
    <li className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{authorName}</span>
        <span>{date}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
    </li>
  )
}
