import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Link as LinkIcon,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjects } from '@/contexts/projects-context'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DialogRoot,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import {
  listAssets,
  listProjectFiles,
  getProjectFileContent,
  updateProjectFileContent,
  deleteProjectFile,
  createAsset as createAssetApi,
  deleteAsset as deleteAssetApi,
  type Asset,
  type AssetTreeNode,
  type AssetType,
  type CreateAssetBody,
  type FileSystemTreeNode,
} from '@/lib/api'
import MDEditor from '@uiw/react-md-editor'
import { Textarea } from '@/components/ui/textarea'

type FileComment = { highlightedText?: string; comment: string }

function FileTreeRow({
  node,
  level,
  expandedIds,
  onToggle,
  onSelectFile,
  onDeleteFile,
  deletingFilePath,
}: {
  node: FileSystemTreeNode
  level: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelectFile: (node: FileSystemTreeNode) => void
  onDeleteFile?: (node: FileSystemTreeNode) => void
  deletingFilePath: string | null
}) {
  const isFolder = node.type === 'folder'
  const isExpanded = expandedIds.has(node.id)
  const isFile = node.type === 'file'

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 pr-2 rounded-md hover:bg-muted/60 cursor-pointer',
          level > 0 && 'pl-2'
        )}
        style={{ paddingLeft: level * 20 + 8 }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.id)
            return
          }
          onSelectFile(node)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (isFolder) onToggle(node.id)
            else onSelectFile(node)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <button
          type="button"
          className="shrink-0 p-0.5 rounded hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation()
            if (isFolder) onToggle(node.id)
          }}
          aria-expanded={isFolder ? isExpanded : undefined}
        >
          {isFolder ? (
            isExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          ) : (
            <span className="size-4 inline-block" aria-hidden />
          )}
        </button>
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-amber-600" />
          ) : (
            <Folder className="size-4 shrink-0 text-amber-600" />
          )
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-medium flex-1 min-w-0">{node.name}</span>
        {node.path !== node.name && (
          <span className="truncate text-xs text-muted-foreground ml-1" title={node.path}>
            {node.path}
          </span>
        )}
        {isFile && onDeleteFile && (
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity shrink-0 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteFile(node)
              }}
              disabled={deletingFilePath === node.path}
              aria-label={`Delete ${node.name}`}
            >
              {deletingFilePath === node.path ? (
                <span className="text-xs">…</span>
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>
      {isFolder && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <FileTreeRow
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              deletingFilePath={deletingFilePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TreeRow({
  node,
  basePath,
  level,
  expandedIds,
  onToggle,
  onDelete,
  deletingId,
}: {
  node: AssetTreeNode
  basePath: string
  level: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const isFolder = node.type === 'folder'
  const isExpanded = expandedIds.has(node.id)
  const displayPath = node.path ? `${basePath}/${node.path}`.replace(/\/+/g, '/') : basePath

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 pr-2 rounded-md hover:bg-muted/60',
          level > 0 && 'pl-2'
        )}
        style={{ paddingLeft: level * 20 + 8 }}
      >
        <button
          type="button"
          className="shrink-0 p-0.5 rounded hover:bg-muted"
          onClick={() => isFolder && onToggle(node.id)}
          aria-expanded={isFolder ? isExpanded : undefined}
        >
          {isFolder ? (
            isExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )
          ) : (
            <span className="size-4 inline-block" aria-hidden />
          )}
        </button>
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-amber-600" />
          ) : (
            <Folder className="size-4 shrink-0 text-amber-600" />
          )
        ) : node.type === 'link' ? (
          <LinkIcon className="size-4 shrink-0 text-blue-600" />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-medium flex-1 min-w-0">{node.name}</span>
        {node.path && (
          <span className="truncate text-xs text-muted-foreground ml-1" title={displayPath}>
            {node.path}
          </span>
        )}
        {node.type === 'link' && node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate max-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            {node.url}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity shrink-0 group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node.id)
            }}
            disabled={deletingId === node.id}
            aria-label={`Delete ${node.name}`}
          >
            {deletingId === node.id ? (
              <span className="text-xs">…</span>
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
      {isFolder && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              basePath={displayPath}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onDelete={onDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AssetsPage() {
  const { projects, loading: projectsLoading } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileSystemTreeNode[]>([])
  const [fileTreeLoading, setFileTreeLoading] = useState(false)
  const [fileTreeError, setFileTreeError] = useState<string | null>(null)
  const [tree, setTree] = useState<AssetTreeNode[]>([])
  const [flat, setFlat] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createType, setCreateType] = useState<AssetType>('file')
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [createPath, setCreatePath] = useState('')
  const [createUrl, setCreateUrl] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingFilePath, setDeletingFilePath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileSystemTreeNode | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileContentLoading, setFileContentLoading] = useState(false)
  const [fileContentError, setFileContentError] = useState<string | null>(null)
  const [fileComments, setFileComments] = useState<FileComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [selectionRect, setSelectionRect] = useState<{ right: number; top: number; height: number } | null>(null)
  const [commentPanelOpen, setCommentPanelOpen] = useState(false)
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null)
  const fileContentRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const updateSelectionRect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !fileContentRef.current) {
      setSelectionRect(null)
      return
    }
    try {
      if (!fileContentRef.current.contains(sel.anchorNode) || !fileContentRef.current.contains(sel.focusNode)) {
        setSelectionRect(null)
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectionRect({ right: rect.right, top: rect.top, height: rect.height })
    } catch {
      setSelectionRect(null)
    }
  }, [])

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    setSelectionRect(null)
  }, [])

  const openCommentPanel = useCallback(() => {
    const text = window.getSelection()?.toString()?.trim() ?? ''
    setPendingHighlight(text || null)
    setCommentPanelOpen(true)
    setCommentInput('')
    clearSelection()
  }, [clearSelection])

  const addPendingComment = useCallback(() => {
    const comment = commentInput.trim()
    if (!comment) return
    setFileComments((prev) => [...prev, { highlightedText: pendingHighlight || undefined, comment }])
    setCommentInput('')
    setPendingHighlight(null)
    setCommentPanelOpen(false)
  }, [commentInput, pendingHighlight])

  const closeCommentPanel = useCallback(() => {
    setCommentPanelOpen(false)
    setPendingHighlight(null)
    setCommentInput('')
  }, [])

  useEffect(() => {
    if (!selectedFile) return
    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel?.rangeCount || sel.isCollapsed) setSelectionRect(null)
      else updateSelectionRect()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [selectedFile, updateSelectionRect])

  const { effectiveTheme } = useTheme()
  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null
  const basePath = selectedProject?.path?.trim() || '(project root)'

  const loadAssets = useCallback(async () => {
    if (!selectedProjectId) return
    setLoading(true)
    setError(null)
    try {
      const { tree: t, flat: f } = await listAssets(selectedProjectId)
      setTree(t)
      setFlat(f)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  const loadFileTree = useCallback(async () => {
    if (!selectedProjectId) return
    setFileTreeLoading(true)
    setFileTreeError(null)
    try {
      const { tree: t } = await listProjectFiles(selectedProjectId)
      setFileTree(t)
    } catch (e) {
      setFileTreeError(e instanceof Error ? e.message : 'Failed to load project files')
    } finally {
      setFileTreeLoading(false)
    }
  }, [selectedProjectId])

  // Default to the first (top-most) project when projects load
  useEffect(() => {
    if (projects.length > 0) {
      const currentExists = selectedProjectId && projects.some((p) => p.id === selectedProjectId)
      if (!currentExists) {
        setSelectedProjectId(projects[0].id)
      }
    } else {
      setSelectedProjectId(null)
    }
  }, [projects])

  useEffect(() => {
    if (selectedProjectId) {
      loadAssets()
      loadFileTree()
    } else {
      setTree([])
      setFlat([])
      setFileTree([])
    }
  }, [selectedProjectId, loadAssets, loadFileTree])

  useEffect(() => {
    if (!selectedFile || !selectedProjectId || selectedFile.type !== 'file') {
      setFileContent(null)
      setFileContentError(null)
      return
    }
    let cancelled = false
    setFileContentLoading(true)
    setFileContentError(null)
    getProjectFileContent(selectedProjectId, selectedFile.path)
      .then(({ content }) => {
        if (!cancelled) {
          setFileContent(content)
          setFileContentError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setFileContentError(e instanceof Error ? e.message : 'Failed to load file')
          setFileContent(null)
        }
      })
      .finally(() => {
        if (!cancelled) setFileContentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedProjectId, selectedFile])

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = useCallback(
    async (assetId: string) => {
      if (!selectedProjectId) return
      setDeletingId(assetId)
      try {
        await deleteAssetApi(selectedProjectId, assetId)
        await loadAssets()
      } catch {
        // could toast
      } finally {
        setDeletingId(null)
      }
    },
    [selectedProjectId, loadAssets]
  )

  const handleSelectFile = useCallback(
    (node: FileSystemTreeNode) => {
      if (node.type !== 'file') return
      const name = node.name.toLowerCase()
      if (name.endsWith('.html')) {
        if (!selectedProjectId) return
        getProjectFileContent(selectedProjectId, node.path)
          .then(({ content }) => {
            const blob = new Blob([content], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank', 'noopener,noreferrer')
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
          })
          .catch(() => {
            setFileContentError('Failed to load file')
          })
        return
      }
      setSelectedFile(node)
    },
    [selectedProjectId]
  )

  const handleDeleteFileFromTree = useCallback(
    async (node: FileSystemTreeNode) => {
      if (node.type !== 'file' || !selectedProjectId) return
      setDeletingFilePath(node.path)
      setFileTreeError(null)
      try {
        await deleteProjectFile(selectedProjectId, node.path)
        const asset = flat.find((a) => a.type === 'file' && a.path === node.path)
        if (asset) await deleteAssetApi(selectedProjectId, asset.id)
        await Promise.all([loadFileTree(), loadAssets()])
        if (selectedFile?.path === node.path) {
          setSelectedFile(null)
          setFileContent(null)
          setFileContentError(null)
        }
      } catch {
        setFileTreeError('Failed to delete file')
      } finally {
        setDeletingFilePath(null)
      }
    },
    [selectedProjectId, flat, loadFileTree, loadAssets, selectedFile?.path]
  )

  const handleMarkdownCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return
      if (!selectedProjectId || !selectedFile || selectedFile.type !== 'file' || fileContent === null) return
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget
      const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))
      const index = checkboxes.indexOf(target)
      if (index < 0) return
      const lines = fileContent.split('\n')
      const taskListLineIndices: number[] = []
      const taskListRe = /^\s*[-*+]\s+\[[ x]\]/
      lines.forEach((line, i) => {
        if (taskListRe.test(line)) taskListLineIndices.push(i)
      })
      if (index >= taskListLineIndices.length) return
      const lineIdx = taskListLineIndices[index]
      const line = lines[lineIdx]
      const newLine = line.replace(/\[([ x])\]/i, (_, c) => (c === ' ' ? '[x]' : '[ ]'))
      lines[lineIdx] = newLine
      const newContent = lines.join('\n')
      setFileContent(newContent)
      updateProjectFileContent(selectedProjectId, selectedFile.path, newContent).catch(() => {
        setFileContent(fileContent)
      })
    },
    [selectedProjectId, selectedFile, fileContent]
  )

  const openCreate = useCallback(() => {
    setCreateName('')
    setCreateType('file')
    setCreateParentId(null)
    setCreatePath('')
    setCreateUrl('')
    setCreateError(null)
    setCreateOpen(true)
  }, [])

  const submitCreate = useCallback(async () => {
    if (!selectedProjectId || !createName.trim()) return
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const body: CreateAssetBody = {
        name: createName.trim(),
        type: createType,
        parent_id: createParentId || null,
        path: createPath.trim() || null,
        url: createType === 'link' ? (createUrl.trim() || null) : undefined,
      }
      await createAssetApi(selectedProjectId, body)
      await loadAssets()
      setCreateOpen(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create asset')
    } finally {
      setCreateSubmitting(false)
    }
  }, [selectedProjectId, createName, createType, createParentId, createPath, createUrl, loadAssets])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Project directory tree and saved assets. Select a project to list all files in its base path.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={selectedProjectId ?? ''}
            onValueChange={(v) => setSelectedProjectId(v || null)}
            disabled={projectsLoading}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={projects.length === 0 ? 'No projects' : 'Select a project'}>
                {selectedProject ? selectedProject.name : null}
              </SelectValue>
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
        {selectedProjectId && (
          <div className="flex items-end gap-2">
            <Button onClick={openCreate} size="sm">
              <Plus className="size-4 mr-1" />
              Add asset
            </Button>
          </div>
        )}
      </div>

      {(error || fileTreeError) && (
        <p className="text-sm text-destructive">{fileTreeError ?? error}</p>
      )}

      {selectedProjectId && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-2 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">Base path: </span>
            <span className="text-sm font-mono">{basePath}</span>
          </div>
          {fileTreeLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : fileTree.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {basePath === '(project root)'
                ? 'Set a project path in project settings to list files.'
                : 'Directory is empty or not accessible.'}
            </div>
          ) : (
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {fileTree.map((node) => (
                <FileTreeRow
                  key={node.id}
                  node={node}
                  level={0}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                  onSelectFile={handleSelectFile}
                  onDeleteFile={handleDeleteFileFromTree}
                  deletingFilePath={deletingFilePath}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedProjectId && !loading && tree.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-2 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">Saved assets</span>
          </div>
          <div className="p-2 max-h-[40vh] overflow-y-auto">
            {tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                basePath={basePath}
                level={0}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        </div>
      )}

      {!selectedProjectId && !projectsLoading && projects.length > 0 && (
        <p className="text-sm text-muted-foreground">Select a project to view its assets.</p>
      )}

      <Sheet
        open={!!selectedFile}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedFile(null)
            setFileContent(null)
            setFileContentError(null)
            setFileComments([])
            setCommentInput('')
            setCommentPanelOpen(false)
            setPendingHighlight(null)
            setSelectionRect(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            '!w-[50vw] !max-w-[50vw] flex flex-col gap-0 p-0 h-full transition-[width] duration-200',
            commentPanelOpen && '!w-[75vw] !max-w-[75vw]'
          )}
        >
          {selectionRect && (
            <button
              type="button"
              onClick={openCommentPanel}
              className="fixed z-[100] flex size-8 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted hover:border-primary/50 transition-colors"
              style={{
                left: selectionRect.right + 8,
                top: selectionRect.top + selectionRect.height / 2 - 16,
              }}
              aria-label="Add comment to selection"
              title="Add comment"
            >
              <MessageSquarePlus className="size-4 text-muted-foreground" />
            </button>
          )}
          <SheetHeader className="border-b border-border px-4 py-2 shrink-0">
            <SheetTitle className="text-sm">{selectedFile?.name ?? 'File'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
              <div
                ref={fileContentRef}
                className={cn(
                  'flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden',
                  commentPanelOpen && 'pr-2'
                )}
                onMouseUp={fileContent !== null && !fileContentError ? updateSelectionRect : undefined}
                onTouchEnd={fileContent !== null && !fileContentError ? updateSelectionRect : undefined}
              >
                {fileContentLoading ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
                ) : fileContentError ? (
                  <div className="flex-1 flex items-center p-4">
                    <p className="text-sm text-destructive">{fileContentError}</p>
                  </div>
                ) : fileContent !== null && selectedFile ? (
                  selectedFile.name.toLowerCase().endsWith('.md') ? (
                    <div
                      data-color-mode={effectiveTheme}
                      className="h-full min-h-0 flex flex-col overflow-hidden select-text [&_.w-md-editor]:!h-full [&_.w-md-editor]:!min-h-0 [&_.w-md-editor-toolbar]:!hidden [&_.w-md-editor-area]:!overflow-auto"
                      onClick={handleMarkdownCheckboxClick}
                    >
                      <MDEditor
                        value={fileContent}
                        visibleDragbar={false}
                        hideToolbar
                        preview="preview"
                        height="100%"
                        enableScroll={true}
                      />
                    </div>
                  ) : (
                    <pre className="h-full min-h-0 overflow-auto p-4 text-sm whitespace-pre-wrap break-words select-text bg-muted/30">
                      {fileContent}
                    </pre>
                  )
                ) : null}
              </div>
              {commentPanelOpen && fileContent !== null && !fileContentError && (
                <div className="w-[320px] shrink-0 border-l border-border pl-4 flex flex-col gap-3 bg-muted/20 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Add comment
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={closeCommentPanel}
                      aria-label="Close comment panel"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  {pendingHighlight && (
                    <div className="rounded border border-border bg-background/80 p-2 text-xs text-muted-foreground italic">
                      <span className="font-medium text-foreground/80 not-italic">Selected:</span>
                      <blockquote className="mt-1 truncate max-h-[4.5rem] overflow-hidden">
                        {pendingHighlight.slice(0, 200)}
                        {pendingHighlight.length > 200 ? '…' : ''}
                      </blockquote>
                    </div>
                  )}
                  <Textarea
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write your comment…"
                    rows={4}
                    className="resize-y min-h-[80px] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addPendingComment}
                    disabled={!commentInput.trim()}
                  >
                    <MessageSquarePlus className="size-4 mr-1" />
                    Add comment
                  </Button>
                </div>
              )}
            </div>
            {fileComments.length > 0 && (
              <div className="shrink-0 rounded-lg border border-border bg-muted/30 p-3 mx-4 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Comments ({fileComments.length})</p>
                <ul className="space-y-1.5 text-sm">
                  {fileComments.map((fc, i) => (
                    <li key={i} className="border-l-2 border-primary/50 pl-2 py-0.5">
                      {fc.highlightedText && (
                        <blockquote className="text-muted-foreground text-xs italic border-l border-border pl-2 my-0.5">
                          {fc.highlightedText.slice(0, 120)}
                          {fc.highlightedText.length > 120 ? '…' : ''}
                        </blockquote>
                      )}
                      <span>{fc.comment}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 pb-4 border-t border-border shrink-0 px-4 mt-2">
              {fileComments.length > 0 ? (
                <Button
                  type="button"
                  onClick={() => {
                    const assetName = selectedFile?.name ?? 'Asset'
                    const description = [
                      `**Asset:** ${assetName}`,
                      '',
                      '**Comments:**',
                      ...fileComments.flatMap((fc) => {
                        const parts: string[] = []
                        if (fc.highlightedText) {
                          parts.push('', '> ' + fc.highlightedText.replace(/\n/g, '\n> '), '')
                        }
                        parts.push(fc.comment)
                        return parts
                      }),
                    ]
                      .filter(Boolean)
                      .join('\n')
                    navigate('/work-items', {
                      state: {
                        openCreate: true,
                        title: assetName,
                        description,
                        project_id: selectedProjectId ?? undefined,
                      },
                    })
                    setSelectedFile(null)
                    setFileContent(null)
                    setFileContentError(null)
                    setFileComments([])
                    setCommentInput('')
                  }}
                >
                  Create work item
                </Button>
              ) : (
                <SheetClose
                  render={
                    <Button
                      variant="outline"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
                    >
                      Close
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DialogRoot open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-w-md">
            <DialogTitle>Add asset</DialogTitle>
            <div className="flex flex-col gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="asset-name">Name</Label>
                <Input
                  id="asset-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. README.md or Documentation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-type">Type</Label>
                <Select
                  value={createType}
                  onValueChange={(v) => setCreateType(v as AssetType)}
                >
                  <SelectTrigger id="asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {flat.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="asset-parent">Parent (folder)</Label>
                  <Select
                    value={createParentId ?? ''}
                    onValueChange={(v) => setCreateParentId(v || null)}
                  >
                    <SelectTrigger id="asset-parent">
                      <SelectValue placeholder="None (root)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (root)</SelectItem>
                      {flat.filter((a) => a.type === 'folder').map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="asset-path">Relative path (optional)</Label>
                <Input
                  id="asset-path"
                  value={createPath}
                  onChange={(e) => setCreatePath(e.target.value)}
                  placeholder="e.g. docs/setup.md"
                />
              </div>
              {createType === 'link' && (
                <div className="space-y-2">
                  <Label htmlFor="asset-url">URL</Label>
                  <Input
                    id="asset-url"
                    type="url"
                    value={createUrl}
                    onChange={(e) => setCreateUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
                  disabled={createSubmitting}
                >
                  Cancel
                </DialogClose>
                <Button
                  onClick={submitCreate}
                  disabled={!createName.trim() || createSubmitting}
                >
                  {createSubmitting ? 'Adding…' : 'Add asset'}
                </Button>
              </div>
            </div>
          </DialogPopup>
        </DialogPortal>
      </DialogRoot>
    </div>
  )
}
