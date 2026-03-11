'use client'

import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderKanban, Bot, ListTodo, Plus, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAgents } from '@/contexts/agents-context'
import { useProjects } from '@/contexts/projects-context'
import { listAllWorkItems, type WorkItemWithProject } from '@/lib/api'

export type CommandPaletteItem =
  | { type: 'action'; id: string; label: string; url: string }
  | { type: 'project'; id: string; label: string }
  | { type: 'agent'; id: string; label: string }
  | { type: 'work-item'; id: string; projectId: string; label: string; projectName: string }
  | { type: 'page'; id: string; label: string; url: string }

const CREATE_ACTIONS: CommandPaletteItem[] = [
  { type: 'action', id: 'action:create-work-item', label: 'Create work item', url: '/work-items' },
  { type: 'action', id: 'action:create-agent', label: 'Create agent', url: '/agents/new' },
  { type: 'action', id: 'action:create-project', label: 'Create project', url: '/projects/new' },
]

const APP_PAGES: CommandPaletteItem[] = [
  { type: 'page', id: 'page:dashboard', label: 'Dashboard', url: '/' },
  { type: 'page', id: 'page:inbox', label: 'Inbox', url: '/inbox' },
  { type: 'page', id: 'page:work-items', label: 'Work Items', url: '/work-items' },
  { type: 'page', id: 'page:context', label: 'Context', url: '/context' },
  { type: 'page', id: 'page:assets', label: 'Assets', url: '/assets' },
  { type: 'page', id: 'page:mcp', label: 'MCP and Tools', url: '/mcp' },
  { type: 'page', id: 'page:profile', label: 'Profile', url: '/profile' },
  { type: 'page', id: 'page:settings', label: 'Settings', url: '/settings' },
]

function getItemUrl(item: CommandPaletteItem): string {
  if (item.type === 'action') return item.url
  switch (item.type) {
    case 'project':
      return `/projects/${item.id}`
    case 'agent':
      return `/agents/${item.id}`
    case 'work-item':
      return `/projects/${item.projectId}?workItem=${item.id}`
    case 'page':
      return item.url
    default:
      return '/'
  }
}

function getItemIcon(item: CommandPaletteItem) {
  if (item.type === 'action') return <Plus className="size-4 shrink-0 text-muted-foreground" />
  switch (item.type) {
    case 'project':
      return <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
    case 'agent':
      return <Bot className="size-4 shrink-0 text-muted-foreground" />
    case 'work-item':
      return <ListTodo className="size-4 shrink-0 text-muted-foreground" />
    case 'page':
      return <FileText className="size-4 shrink-0 text-muted-foreground" />
    default:
      return null
  }
}

function getItemTypeLabel(item: CommandPaletteItem): string {
  if (item.type === 'action') return 'Action'
  switch (item.type) {
    case 'project':
      return 'Project'
    case 'agent':
      return 'Agent'
    case 'work-item':
      return 'Work item'
    case 'page':
      return 'Page'
    default:
      return ''
  }
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [workItems, setWorkItems] = React.useState<WorkItemWithProject[]>([])
  const [, setWorkItemsLoading] = React.useState(false)
  const { agents } = useAgents()
  const { projects } = useProjects()

  const items = React.useMemo((): CommandPaletteItem[] => {
    const list: CommandPaletteItem[] = [...CREATE_ACTIONS, ...APP_PAGES]
    projects.forEach((p) => list.push({ type: 'project', id: p.id, label: p.name }))
    agents.forEach((a) => list.push({ type: 'agent', id: a.id, label: a.name }))
    workItems.forEach((w) =>
      list.push({
        type: 'work-item',
        id: w.id,
        projectId: w.project_id,
        label: w.title,
        projectName: w.project_name,
      })
    )
    return list
  }, [projects, agents, workItems])

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CREATE_ACTIONS
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query])

  const selectedItem = filteredItems[selectedIndex] ?? null

  const loadWorkItems = React.useCallback(async () => {
    setWorkItemsLoading(true)
    try {
      const data = await listAllWorkItems()
      setWorkItems(data)
    } catch {
      setWorkItems([])
    } finally {
      setWorkItemsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      loadWorkItems()
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [open, loadWorkItems])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  React.useEffect(() => {
    setSelectedIndex((i) => {
      const max = Math.max(0, filteredItems.length - 1)
      return Math.min(i, max)
    })
  }, [filteredItems.length])

  React.useEffect(() => {
    const el = listRef.current
    if (!el || !selectedItem) return
    const option = el.querySelector(`[data-index="${selectedIndex}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, selectedItem])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        return
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % Math.max(1, filteredItems.length))
        return
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(
          (i) => (i - 1 + filteredItems.length) % Math.max(1, filteredItems.length)
        )
        return
      case 'Enter':
        e.preventDefault()
        if (selectedItem) {
          navigate(getItemUrl(selectedItem))
          onOpenChange(false)
        }
        return
      default:
        break
    }
  }

  const handleSelect = (item: CommandPaletteItem) => {
    navigate(getItemUrl(item))
    onOpenChange(false)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onOpenChange(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
      />
      <div
        className="relative z-10 w-full max-w-xl rounded-xl border border-border bg-card shadow-lg"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search projects, agents, work items, pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>
        <div
          ref={listRef}
          className="max-h-[min(60vh,400px)] overflow-y-auto py-2"
        >
          {filteredItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.trim() ? 'No results.' : 'Type to search projects, agents, work items, and pages.'}
            </div>
          ) : (
            <ul className="list-none p-0 m-0">
              {filteredItems.map((item, index) => (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    type="button"
                    data-index={index}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                      index === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50'
                    )}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => handleSelect(item)}
                  >
                    {getItemIcon(item)}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.type === 'work-item' && (
                      <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[120px]">
                        {item.projectName}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {getItemTypeLabel(item)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
