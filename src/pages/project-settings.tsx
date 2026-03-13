import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmAlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useQueryClient } from '@tanstack/react-query'
import { getProject, updateProject, archiveProject } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useCompleteProjectMutation } from '@/hooks/queries'
import { useProjects } from '@/contexts/projects-context'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/api'

const PROJECT_COLORS = [
  null,
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const

const PROJECT_ICONS = [
  { value: null, label: 'None' },
  { value: '📁', label: 'Folder' },
  { value: '📋', label: 'Clipboard' },
  { value: '🚀', label: 'Rocket' },
  { value: '💼', label: 'Briefcase' },
  { value: '🔧', label: 'Wrench' },
  { value: '📌', label: 'Pin' },
  { value: '⭐', label: 'Star' },
] as const

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { refetch } = useProjects()
  const queryClient = useQueryClient()
  const completeProjectMutation = useCompleteProjectMutation()
  const { effectiveTheme } = useTheme()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [pathValue, setPathValue] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [contextValue, setContextValue] = useState('')
  const [savingContext, setSavingContext] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextSaved, setContextSaved] = useState(false)
  const [colorValue, setColorValue] = useState<string | null>(null)
  const [iconValue, setIconValue] = useState<string | null>(null)
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [appearanceError, setAppearanceError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getProject(projectId)
      .then((p) => {
        if (!cancelled) {
          setProject(p ?? null)
          if (p) {
            setNameValue(p.name)
            setPathValue(p.path ?? '')
            setContextValue(p.project_context ?? '')
            setColorValue(p.color ?? null)
            setIconValue(p.icon ?? null)
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load project')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleSaveName = async () => {
    if (!projectId || !project) return
    const trimmed = nameValue.trim()
    if (!trimmed) {
      setNameError('Project name cannot be empty')
      return
    }
    if (trimmed === project.name) return
    setNameError(null)
    setSavingName(true)
    try {
      const updated = await updateProject(projectId, { name: trimmed })
      setProject(updated)
      await refetch()
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to save name')
    } finally {
      setSavingName(false)
    }
  }

  const handleArchiveConfirm = async () => {
    if (!projectId) return
    setArchiving(true)
    try {
      await archiveProject(projectId)
      await refetch()
      navigate('/')
    } finally {
      setArchiving(false)
    }
  }

  const handleCompleteConfirm = async () => {
    if (!projectId) return
    setCompleting(true)
    try {
      await completeProjectMutation.mutateAsync(projectId)
      await refetch()
      navigate('/')
    } finally {
      setCompleting(false)
      setCompleteDialogOpen(false)
    }
  }

  const handleSavePath = async () => {
    if (!projectId || !project) return
    const trimmed = pathValue.trim()
    // Allow clearing the path; no additional validation for now
    const nextPath: string | null = trimmed || null
    if ((project.path ?? '') === (nextPath ?? '')) return
    setPathError(null)
    setSavingPath(true)
    try {
      const updated = await updateProject(projectId, { path: nextPath })
      setProject(updated)
      await refetch()
    } catch (e) {
      setPathError(e instanceof Error ? e.message : 'Failed to save path')
    } finally {
      setSavingPath(false)
    }
  }

  const handleSaveContext = async () => {
    if (!projectId || !project) return
    const nextContext = contextValue.trim() || ''
    if ((project.project_context ?? '') === nextContext) return
    setContextError(null)
    setContextSaved(false)
    setSavingContext(true)
    try {
      const updated = await updateProject(projectId, { project_context: nextContext || null })
      setProject(updated)
      await refetch()
      setContextSaved(true)
      setTimeout(() => setContextSaved(false), 2000)
    } catch (e) {
      setContextError(e instanceof Error ? e.message : 'Failed to save context')
    } finally {
      setSavingContext(false)
    }
  }

  const handleSaveAppearance = async () => {
    if (!projectId || !project) return
    const nextColor = colorValue && colorValue.trim() ? colorValue.trim() : null
    const nextIcon = iconValue && iconValue.trim() ? iconValue.trim() : null
    if ((project.color ?? null) === nextColor && (project.icon ?? null) === nextIcon) return
    setAppearanceError(null)
    setSavingAppearance(true)
    try {
      const updated = await updateProject(projectId, { color: nextColor, icon: nextIcon })
      setProject(updated)
      await refetch()
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) })
      }
    } catch (e) {
      setAppearanceError(e instanceof Error ? e.message : 'Failed to save appearance')
    } finally {
      setSavingAppearance(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
            <CardDescription>Loading…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
            <CardDescription>
              {error ?? 'Project not found.'}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link to="/">Go to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{project.name}</span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project settings</CardTitle>
          <CardDescription>Manage this project. Complete moves it to the Completed section; archiving removes it from the sidebar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <div className="flex gap-2">
              <Input
                id="project-name"
                value={nameValue}
                onChange={(e) => {
                  setNameValue(e.target.value)
                  setNameError(null)
                }}
                onBlur={handleSaveName}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="Project name"
                disabled={savingName}
                className="max-w-sm"
              />
              <Button onClick={handleSaveName} disabled={savingName || nameValue.trim() === project.name}>
                {savingName ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-path">Project path</Label>
            <div className="flex gap-2">
              <Input
                id="project-path"
                value={pathValue}
                onChange={(e) => {
                  setPathValue(e.target.value)
                  setPathError(null)
                }}
                onBlur={handleSavePath}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePath()}
                placeholder="e.g. /Users/yourname/Documents/project-name"
                disabled={savingPath}
                className="max-w-sm"
              />
              <Button
                onClick={handleSavePath}
                disabled={savingPath || (pathValue.trim() || null) === (project.path ?? null)}
              >
                {savingPath ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {pathError && <p className="text-sm text-destructive">{pathError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-context">Additional context</Label>
            <p className="text-sm text-muted-foreground">
              Markdown content included in the agent prompt for this project. Use the variable &apos;PROJECT_CONTEXT&apos; in the Agent System Prompt (Settings → Prompts) to inject this content.
            </p>
            <div
              data-color-mode={effectiveTheme}
              className="overflow-hidden rounded-md border border-input [&_.w-md-editor]:min-h-[200px] [&_.w-md-editor-toolbar]:rounded-t-md [&_.w-md-editor-content]:rounded-b-md"
            >
              <MDEditor
                id="project-context"
                value={contextValue}
                onChange={(val) => setContextValue(val ?? '')}
                height={200}
                visibleDragbar={false}
                preview="edit"
                commands={[commands.codeEdit, commands.codePreview]}
                extraCommands={[]}
                textareaProps={{
                  disabled: savingContext,
                }}
              />
            </div>
            {contextError && <p className="text-sm text-destructive">{contextError}</p>}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveContext}
                disabled={savingContext || (project.project_context ?? '') === contextValue.trim()}
              >
                {savingContext ? 'Saving…' : 'Save context'}
              </Button>
              {contextSaved && (
                <span className="text-sm text-muted-foreground">Saved.</span>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <Label>Appearance</Label>
            <p className="text-sm text-muted-foreground">
              Set a project color or icon. The color appears as a small square next to the project in the sidebar.
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Project color</p>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c ?? 'none'}
                      type="button"
                      onClick={() => {
                        setColorValue(c)
                      }}
                      className={cn(
                        'size-8 rounded-md border-2 transition-shadow shrink-0',
                        colorValue === c
                          ? 'border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground/20'
                          : 'border-transparent hover:ring-2 hover:ring-offset-2 hover:ring-offset-background hover:ring-muted-foreground/30'
                      )}
                      style={c ? { backgroundColor: c } : undefined}
                      title={c ? c : 'No color'}
                      aria-label={c ? `Color ${c}` : 'No color'}
                    >
                      {!c && (
                        <span className="text-muted-foreground text-xs font-medium">—</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Project icon</p>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_ICONS.map(({ value, label }) => (
                    <button
                      key={value ?? 'none'}
                      type="button"
                      onClick={() => setIconValue(value)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-md border text-lg transition-colors shrink-0',
                        iconValue === value
                          ? 'border-foreground bg-sidebar-accent'
                          : 'border-border hover:bg-sidebar-accent'
                      )}
                      title={label}
                      aria-label={label}
                    >
                      {value ?? '—'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {appearanceError && (
              <p className="text-sm text-destructive">{appearanceError}</p>
            )}
            <Button
              onClick={handleSaveAppearance}
              disabled={
                savingAppearance ||
                ((project.color ?? null) === (colorValue ?? null) &&
                  (project.icon ?? null) === (iconValue ?? null))
              }
            >
              {savingAppearance ? 'Saving…' : 'Save appearance'}
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Complete project</h3>
            <p className="mt-1 text-sm">
              Mark this project as complete. It will move to the &quot;Completed&quot; section in the sidebar. All data is kept.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Danger zone</h3>
            <p className="mt-1 text-sm">
              Archiving this project will remove it from the sidebar. The project and its data are kept and can be restored later.
            </p>
          </div>
        </CardContent>
        <CardFooter className="gap-2 flex-wrap">
          {!project.completed_at && (
            <Button
              variant="secondary"
              onClick={() => setCompleteDialogOpen(true)}
              disabled={completing}
            >
              Complete project
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setArchiveDialogOpen(true)}
            disabled={archiving}
          >
            Archive project
          </Button>
          <Button asChild variant="outline">
            <Link to={`/projects/${project.id}`}>Cancel</Link>
          </Button>
        </CardFooter>
      </Card>

      <ConfirmAlertDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        title="Complete this project?"
        description="This project will move to the Completed section in the sidebar. All data is kept and you can still open it."
        confirmLabel="Complete project"
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleCompleteConfirm}
      />
      <ConfirmAlertDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive this project?"
        description="This project will be removed from the sidebar. You can restore it later from archived projects."
        confirmLabel="Yes, archive"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleArchiveConfirm}
      />
    </div>
  )
}
