import { useParams, Link } from 'react-router-dom'
import { useMcp } from '@/contexts/mcp-context'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Plug } from 'lucide-react'

export function McpDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { tools } = useMcp()
  const tool = id ? tools.find((t) => t.id === id) : null

  if (!id || !tool) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/mcp"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to MCP and Tools
        </Link>
        <p className="text-muted-foreground">MCP or tool not found.</p>
        <Link to="/mcp" className={buttonVariants({ variant: 'outline' })}>
          View all
        </Link>
      </div>
    )
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
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plug className="size-5 text-muted-foreground" />
            <CardTitle>{tool.name}</CardTitle>
          </div>
          {tool.description && (
            <CardDescription>{tool.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
            <p className="text-sm">{tool.type}</p>
          </div>
          {tool.type === 'command' && (
            <>
              {tool.command && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Command</p>
                  <p className="font-mono text-sm">{tool.command}</p>
                </div>
              )}
              {tool.args && tool.args.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Arguments</p>
                  <p className="font-mono text-sm">{tool.args.join(' ')}</p>
                </div>
              )}
            </>
          )}
          {tool.type === 'url' && tool.url && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">URL</p>
              <p className="font-mono text-sm break-all">{tool.url}</p>
            </div>
          )}
          {tool.env && Object.keys(tool.env).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Environment</p>
              <pre className="mt-1 rounded bg-muted p-2 font-mono text-xs overflow-x-auto">
                {Object.entries(tool.env)
                  .map(([k, v]) => `${k}=${v}`)
                  .join('\n')}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
