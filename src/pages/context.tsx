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

export function ContextPage() {
  const { effectiveTheme } = useTheme()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<ContextFileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const loadFiles = useCallback(async () => {
    try {
      const list = await listContextFiles()
      setFiles(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list files')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getContext(), listContextFiles()])
      .then(([contextData, fileList]) => {
        if (cancelled) return
        setContent(contextData.content)
        setFiles(fileList)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
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
      await updateContext(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save context')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      await uploadContextFile(file)
      await loadFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (name: string) => {
    setDeletingId(name)
    setError(null)
    try {
      await deleteContextFile(name)
      await loadFiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Context</h1>
        <p className="text-muted-foreground">
          Add extra context in Markdown and attach files. Stored in .agent-pm/context.md and .agent-pm/files.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Additional context</CardTitle>
          <CardDescription>
            Markdown content to provide additional context (similar to the Agent System Prompt). Supports formatting and structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
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
                    value={content}
                    onChange={(val) => setContent(val ?? '')}
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
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? 'Saving…' : 'Save context'}
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
          <CardTitle>Files</CardTitle>
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
              disabled={uploading}
              onClick={() => document.getElementById('context-file-upload')?.click()}
            >
              <Upload className="size-4 mr-2" />
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
            <input
              id="context-file-upload"
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet. Upload to add.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {files.map((f) => (
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
                    disabled={deletingId === f.name}
                    onClick={() => handleDelete(f.name)}
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
