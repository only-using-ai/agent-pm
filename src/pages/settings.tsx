import { useCallback, useEffect, useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { Database, Upload, Trash2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useTheme } from '@/contexts/theme-context'
import {
  getPrompt,
  updatePrompt,
  getContext,
  updateContext,
  listContextFiles,
  uploadContextFile,
  deleteContextFile,
  listDatabaseTables,
  executeDatabaseQuery,
  deleteDatabaseRow,
  type ContextFileEntry,
  type DatabaseTableInfo,
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

  const [databaseTables, setDatabaseTables] = useState<DatabaseTableInfo[]>([])
  const [databaseTablesLoading, setDatabaseTablesLoading] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<{
    columns: string[]
    rows: Record<string, unknown>[]
  } | null>(null)
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(
    () => new Set()
  )
  const [deleteTableRef, setDeleteTableRef] = useState('')
  const [deleteRowLoading, setDeleteRowLoading] = useState(false)
  const [deleteRowError, setDeleteRowError] = useState<string | null>(null)

  const loadContextFiles = useCallback(async () => {
    try {
      const list = await listContextFiles()
      setContextFiles(list)
    } catch (e) {
      setContextError(e instanceof Error ? e.message : 'Failed to list files')
    }
  }, [])

  const loadDatabaseTables = useCallback(async () => {
    setDatabaseTablesLoading(true)
    setQueryError(null)
    try {
      const tables = await listDatabaseTables()
      setDatabaseTables(tables)
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : 'Failed to list tables')
    } finally {
      setDatabaseTablesLoading(false)
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

  /** Infer schema.table from a simple SELECT ... FROM schema.table query. */
  const inferTableFromQuery = (query: string): string => {
    const fromMatch = query.trim().replace(/\s+/g, ' ').match(/\bFROM\s+([^\s,);]+)/i)
    if (!fromMatch) return ''
    return fromMatch[1].replace(/^["']|["']$/g, '')
  }

  const handleExecuteQuery = async () => {
    const q = queryText.trim()
    if (!q) return
    setQueryLoading(true)
    setQueryError(null)
    setDeleteRowError(null)
    setQueryResult(null)
    setSelectedRowIndices(new Set())
    try {
      const result = await executeDatabaseQuery(q)
      setQueryResult(result)
      const inferred = inferTableFromQuery(q)
      if (inferred) setDeleteTableRef(inferred)
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setQueryLoading(false)
    }
  }

  const toggleRowSelection = (index: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleDeleteSelectedRows = async () => {
    const tableRef = deleteTableRef.trim()
    if (!tableRef || selectedRowIndices.size === 0 || !queryResult) return
    const parts = tableRef.split('.')
    const tableSchema = parts.length >= 2 ? parts[0] : 'public'
    const tableName = parts.length >= 2 ? parts.slice(1).join('.') : parts[0]
    if (!tableName) return
    setDeleteRowError(null)
    setDeleteRowLoading(true)
    try {
      const indices = Array.from(selectedRowIndices)
      for (const i of indices) {
        const row = queryResult.rows[i]
        if (row) await deleteDatabaseRow(tableSchema, tableName, row)
      }
      setSelectedRowIndices(new Set())
      await handleExecuteQuery()
    } catch (e) {
      setDeleteRowError(e instanceof Error ? e.message : 'Failed to delete row(s)')
    } finally {
      setDeleteRowLoading(false)
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

      <Tabs
        defaultValue="general"
        onValueChange={(v) => {
          if (v === 'database') loadDatabaseTables()
        }}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="context">Additional context</TabsTrigger>
          <TabsTrigger value="context-files">Context files</TabsTrigger>
          <TabsTrigger value="database">
            <Database className="size-4 mr-1.5" />
            Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
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
        </TabsContent>

        <TabsContent value="prompts" className="mt-4">
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
        </TabsContent>

        <TabsContent value="context" className="mt-4">
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
        </TabsContent>

        <TabsContent value="context-files" className="mt-4">
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
        </TabsContent>

        <TabsContent value="database" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Database</CardTitle>
              <CardDescription>
                View database tables and run read-only SQL (SELECT only). Tables are from the current schema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Tables</Label>
                {databaseTablesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading tables…</p>
                ) : databaseTables.length === 0 && !queryError ? (
                  <p className="text-sm text-muted-foreground">
                    No tables found. Switch to this tab to load.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {databaseTables.map((t) => (
                      <span
                        key={`${t.table_schema}.${t.table_name}`}
                        className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs"
                        title={`${t.table_schema}.${t.table_name}`}
                      >
                        {t.table_schema}.{t.table_name}
                      </span>
                    ))}
                  </div>
                )}
                {queryError && databaseTables.length === 0 && (
                  <p className="text-sm text-destructive">{queryError}</p>
                )}
                {databaseTables.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadDatabaseTables}
                    disabled={databaseTablesLoading}
                  >
                    Refresh tables
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-query">Query (SELECT only)</Label>
                <Textarea
                  id="db-query"
                  placeholder="SELECT * FROM projects LIMIT 10"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      e.preventDefault()
                      handleExecuteQuery()
                    }
                  }}
                  className="min-h-[120px] font-mono text-sm"
                  disabled={queryLoading}
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleExecuteQuery}
                    disabled={queryLoading || !queryText.trim()}
                  >
                    {queryLoading ? 'Running…' : 'Execute'}
                  </Button>
                  {queryError && queryResult === null && (
                    <span className="text-sm text-destructive">{queryError}</span>
                  )}
                </div>
              </div>

              {queryResult && (
                <div className="space-y-2">
                  <Label>Results</Label>
                  {(selectedRowIndices.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="delete-table-ref" className="text-muted-foreground text-xs">
                        Table for delete (e.g. public.projects):
                      </Label>
                      <input
                        id="delete-table-ref"
                        type="text"
                        value={deleteTableRef}
                        onChange={(e) => {
                          setDeleteTableRef(e.target.value)
                          setDeleteRowError(null)
                        }}
                        placeholder="schema.table"
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelectedRows}
                        disabled={
                          deleteRowLoading ||
                          !deleteTableRef.trim() ||
                          selectedRowIndices.size === 0
                        }
                      >
                        <Trash2 className="size-4 mr-2" />
                        {deleteRowLoading
                          ? 'Deleting…'
                          : `Delete selected (${selectedRowIndices.size})`}
                      </Button>
                      {deleteRowError && (
                        <span className="text-sm text-destructive">
                          {deleteRowError}
                        </span>
                      )}
                    </div>
                  )) || null}
                  <ScrollArea className="w-full rounded-md border border-border">
                    <div className="min-w-0 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="w-10 px-2 py-2 text-left font-medium">
                              <span className="sr-only">Select row</span>
                            </th>
                            {queryResult.columns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left font-medium"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={queryResult.columns.length + 1}
                                className="px-3 py-4 text-center text-muted-foreground"
                              >
                                No rows
                              </td>
                            </tr>
                          ) : (
                            queryResult.rows.map((row, i) => (
                              <tr
                                key={i}
                                className="border-b border-border/50 hover:bg-muted/30"
                              >
                                <td className="w-10 px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedRowIndices.has(i)}
                                    onChange={() => toggleRowSelection(i)}
                                    className="h-4 w-4 rounded border-border"
                                    aria-label={`Select row ${i + 1}`}
                                  />
                                </td>
                                {queryResult.columns.map((col) => (
                                  <td
                                    key={col}
                                    className="px-3 py-2 font-mono text-xs max-w-[200px] truncate"
                                    title={
                                      row[col] != null
                                        ? String(row[col])
                                        : ''
                                    }
                                  >
                                    {row[col] != null ? String(row[col]) : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {queryResult.rows.length} row{queryResult.rows.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
