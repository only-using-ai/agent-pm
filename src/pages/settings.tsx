import { useCallback, useEffect, useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { Upload, Trash2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/contexts/theme-context'
import {
  getPrompt,
  updatePrompt,
  getContext,
  updateContext,
  listContextFiles,
  uploadContextFile,
  deleteContextFile,
  type ContextFileEntry,
} from '@/lib/api'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const AGENT_SYSTEM_PROMPT_KEY = 'agent_system_prompt'

const PROMPT_VARIABLES = [
  'WORK_ITEM_ID',
  'WORK_ITEM_TITLE',
  'WORK_ITEM_DESCRIPTION',
  'WORK_ITEM_PRIORITY',
  'WORK_ITEM_STATUS',
  'WORK_ITEM_REQUIRE_APPROVAL',
  'WORK_ITEM_COMMENTS',
  'PROJECT_ID',
  'AGENT_INSTRUCTIONS',
  'AGENT_PROVIDER',
  'CURSOR_ACTIONS_BLOCK',
  'AREA_CONTEXT',
  'PROJECT_CONTEXT',
] as const

export function SettingsPage() {
  const { effectiveTheme } = useTheme()
  const [promptContent, setPromptContent] = useState('')
  const [promptName, setPromptName] = useState('Agent System Prompt')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [contextContent, setContextContent] = useState('')
  const [contextFiles, setContextFiles] = useState<ContextFileEntry[]>([])
  const [contextLoading, setContextLoading] = useState(true)
  const [contextSaving, setContextSaving] = useState(false)
  const [contextUploading, setContextUploading] = useState(false)
  const [contextDeletingId, setContextDeletingId] = useState<string | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextSaved, setContextSaved] = useState(false)

  const loadContextFiles = useCallback(async () => {
    try {
      const list = await listContextFiles()
      setContextFiles(list)
    } catch (e) {
      setContextError(e instanceof Error ? e.message : 'Failed to list files')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPrompt(AGENT_SYSTEM_PROMPT_KEY)
      .then((p) => {
        if (cancelled) return
        if (p) {
          setPromptName(p.name)
          setPromptContent(p.content)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load prompt')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setContextLoading(true)
    Promise.all([getContext(), listContextFiles()])
      .then(([contextData, fileList]) => {
        if (cancelled) return
        setContextContent(contextData.content)
        setContextFiles(fileList)
      })
      .catch((e) => {
        if (!cancelled) setContextError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updatePrompt(AGENT_SYSTEM_PROMPT_KEY, { content: promptContent })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleContextSave = async () => {
    setContextSaving(true)
    setContextError(null)
    setContextSaved(false)
    try {
      await updateContext(contextContent)
      setContextSaved(true)
      setTimeout(() => setContextSaved(false), 2000)
    } catch (e) {
      setContextError(e instanceof Error ? e.message : 'Failed to save context')
    } finally {
      setContextSaving(false)
    }
  }

  const handleContextFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setContextUploading(true)
    setContextError(null)
    try {
      await uploadContextFile(file)
      await loadContextFiles()
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setContextUploading(false)
      e.target.value = ''
    }
  }

  const handleContextFileDelete = async (name: string) => {
    setContextDeletingId(name)
    setContextError(null)
    try {
      await deleteContextFile(name)
      await loadContextFiles()
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Failed to delete file')
    } finally {
      setContextDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Application and account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings options will appear here.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>
            Edit prompt templates used when running agents. Use variables in single quotes (e.g. &apos;WORK_ITEM_TITLE&apos;) — they are replaced when the agent runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="agent-system-prompt">{promptName}</Label>
                <div
                  data-color-mode={effectiveTheme}
                  className="overflow-hidden rounded-md border border-input [&_.w-md-editor]:min-h-[280px] [&_.w-md-editor-toolbar]:rounded-t-md [&_.w-md-editor-content]:rounded-b-md"
                >
                  <MDEditor
                    id="agent-system-prompt"
                    value={promptContent}
                    onChange={(val) => setPromptContent(val ?? '')}
                    height={280}
                    visibleDragbar={false}
                    preview="edit"
                    commands={[commands.codeEdit, commands.codePreview]}
                    extraCommands={[]}
                    textareaProps={{
                      disabled: saving,
                    }}
                  />
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Available variables (use in single quotes, e.g. &apos;WORK_ITEM_TITLE&apos;)
                </p>
                <ul className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {PROMPT_VARIABLES.map((v) => (
                    <li key={v} className="font-mono">
                      &apos;{v}&apos;
                    </li>
                  ))}
                </ul>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                {saved && (
                  <span className="text-sm text-muted-foreground">Saved.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional context</CardTitle>
          <CardDescription>
            Markdown content to provide additional context (similar to the Agent System Prompt). Stored in .agent-pm/context.md. Supports formatting and structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contextLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="context-markdown">Context (Markdown)</Label>
                <div
                  data-color-mode={effectiveTheme}
                  className="overflow-hidden rounded-md border border-input [&_.w-md-editor]:min-h-[280px] [&_.w-md-editor-toolbar]:rounded-t-md [&_.w-md-editor-content]:rounded-b-md"
                >
                  <MDEditor
                    id="context-markdown"
                    value={contextContent}
                    onChange={(val) => setContextContent(val ?? '')}
                    height={280}
                    visibleDragbar={false}
                    preview="edit"
                    commands={[commands.codeEdit, commands.codePreview]}
                    extraCommands={[]}
                    textareaProps={{
                      disabled: contextSaving,
                    }}
                  />
                </div>
              </div>
              {contextError && (
                <p className="text-sm text-destructive">{contextError}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleContextSave}
                  disabled={contextSaving || contextLoading}
                >
                  {contextSaving ? 'Saving…' : 'Save context'}
                </Button>
                {contextSaved && (
                  <span className="text-sm text-muted-foreground">Saved.</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Context files</CardTitle>
          <CardDescription>
            Files are stored in .agent-pm/files. Upload to add; they are listed from that directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="context-file-upload" className="sr-only">
              Upload file
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={contextUploading}
              onClick={() => document.getElementById('context-file-upload')?.click()}
            >
              <Upload className="size-4 mr-2" />
              {contextUploading ? 'Uploading…' : 'Upload file'}
            </Button>
            <input
              id="context-file-upload"
              type="file"
              className="hidden"
              onChange={handleContextFileSelect}
              disabled={contextUploading}
            />
          </div>
          {contextFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet. Upload to add.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {contextFiles.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatSize(f.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8"
                    disabled={contextDeletingId === f.name}
                    onClick={() => handleContextFileDelete(f.name)}
                    aria-label={`Delete ${f.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
