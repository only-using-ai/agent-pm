import { useEffect, useState } from 'react'
import MDEditor, { commands } from '@uiw/react-md-editor'
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
import { getPrompt, updatePrompt } from '@/lib/api'

const AGENT_SYSTEM_PROMPT_KEY = 'agent_system_prompt'

const PROMPT_VARIABLES = [
  'WORK_ITEM_ID',
  'WORK_ITEM_TITLE',
  'WORK_ITEM_DESCRIPTION',
  'WORK_ITEM_PRIORITY',
  'WORK_ITEM_STATUS',
  'WORK_ITEM_REQUIRE_APPROVAL',
  'PROJECT_ID',
  'AGENT_INSTRUCTIONS',
  'AGENT_PROVIDER',
  'CURSOR_ACTIONS_BLOCK',
] as const

export function SettingsPage() {
  const { effectiveTheme } = useTheme()
  const [promptContent, setPromptContent] = useState('')
  const [promptName, setPromptName] = useState('Agent System Prompt')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
    </div>
  )
}
