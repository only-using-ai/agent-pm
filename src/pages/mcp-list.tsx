import { Link } from 'react-router-dom'
import { useMcp } from '@/contexts/mcp-context'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Plug } from 'lucide-react'

export function McpListPage() {
  const { tools, loading, error } = useMcp()

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">MCP and Tools</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">MCP and Tools</h1>
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">MCP and Tools</h1>
          <p className="text-muted-foreground">
            Manage Model Context Protocol servers and tools available to agents.
          </p>
        </div>
        <Link to="/mcp/new" className={buttonVariants()}>
          + MCP / Tool
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered MCPs &amp; Tools</CardTitle>
          <CardDescription>
            {tools.length === 0
              ? 'No MCPs or tools yet. Add one to get started.'
              : `${tools.length} configured.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Plug className="size-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No MCPs or tools</p>
              <Link to="/mcp/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                + Add MCP / Tool
              </Link>
            </div>
          ) : (
            <ul className="space-y-1">
              {tools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    to={`/mcp/${tool.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Plug className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{tool.name}</span>
                    <span className="text-muted-foreground">
                      {tool.type === 'command' ? tool.command : tool.url}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
