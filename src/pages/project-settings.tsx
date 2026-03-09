import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
import { getProject, updateProject, archiveProject } from '@/lib/api'
import { useProjects } from '@/contexts/projects-context'
import type { Project } from '@/lib/api'

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { refetch } = useProjects()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [pathValue, setPathValue] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

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
          <CardDescription>Manage this project. Archiving removes it from the sidebar.</CardDescription>
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
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Danger zone</h3>
            <p className="mt-1 text-sm">
              Archiving this project will remove it from the sidebar. The project and its data are kept and can be restored later.
            </p>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
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
