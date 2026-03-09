import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMcp } from '@/contexts/mcp-context'
import { ArrowLeft } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function parseArgs(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseEnv(value: string): Record<string, string> {
  const trimmed = value.trim()
  if (!trimmed) return {}
  const out: Record<string, string> = {}
  for (const line of trimmed.split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) {
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim()
      if (k) out[k] = v
    }
  }
  return out
}

export function AddMcpPage() {
  const navigate = useNavigate()
  const { addTool } = useMcp()
  const [name, setName] = useState('')
  const [type, setType] = useState<'command' | 'url'>('command')
  const [command, setCommand] = useState('')
  const [argsStr, setArgsStr] = useState('')
  const [url, setUrl] = useState('')
  const [envStr, setEnvStr] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!name.trim()) {
      setSubmitError('Name is required')
      return
    }
    if (type === 'command' && !command.trim()) {
      setSubmitError('Command is required for command-type MCP')
      return
    }
    if (type === 'url' && !url.trim()) {
      setSubmitError('URL is required for URL-type MCP')
      return
    }
    setSubmitting(true)
    try {
      const tool = await addTool({
        name: name.trim(),
        type,
        command: type === 'command' ? command.trim() : undefined,
        args: type === 'command' ? parseArgs(argsStr) : undefined,
        url: type === 'url' ? url.trim() : undefined,
        env: envStr.trim() ? parseEnv(envStr) : undefined,
        description: description.trim() || undefined,
      })
      navigate(`/mcp/${tool.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add MCP tool')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/mcp"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Add MCP / Tool</CardTitle>
            <CardDescription>
              Register an MCP (Model Context Protocol) server or tool. Use command to run a local process, or URL for a remote MCP endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mcp-name">Name</Label>
              <Input
                id="mcp-name"
                placeholder="e.g. Filesystem MCP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'command' | 'url')}>
                <SelectTrigger id="mcp-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="command">Command (run local process)</SelectItem>
                  <SelectItem value="url">URL (remote MCP endpoint)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'command' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mcp-command">Command</Label>
                  <Input
                    id="mcp-command"
                    placeholder="e.g. npx or /usr/bin/python"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Executable to run (e.g. npx, node, python).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcp-args">Arguments (comma-separated)</Label>
                  <Input
                    id="mcp-args"
                    placeholder="e.g. -y, @modelcontextprotocol/server-filesystem"
                    value={argsStr}
                    onChange={(e) => setArgsStr(e.target.value)}
                  />
                </div>
              </>
            )}

            {type === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="mcp-url">URL</Label>
                <Input
                  id="mcp-url"
                  placeholder="e.g. https://mcp.example.com/sse"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mcp-env">Environment variables (KEY=VALUE per line)</Label>
              <Textarea
                id="mcp-env"
                placeholder={'e.g.\nAPI_KEY=secret\nPATH=/custom/path'}
                value={envStr}
                onChange={(e) => setEnvStr(e.target.value)}
                rows={3}
                className="resize-y font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-description">Description (optional)</Label>
              <Textarea
                id="mcp-description"
                placeholder="What this MCP or tool does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-y"
              />
            </div>
          </CardContent>
          {submitError && (
            <p className="px-6 text-sm text-destructive">{submitError}</p>
          )}
          <CardFooter className="gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add MCP / Tool'}
            </Button>
            <Link to="/mcp" className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
