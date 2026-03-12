import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Wrench } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getInternalToolById } from '@/lib/internal-tools'

export function InternalToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>()
  const tool = toolId ? getInternalToolById(toolId) : null

  if (!toolId || !tool) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/mcp"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to MCP and Tools
        </Link>
        <p className="text-muted-foreground">Internal tool not found.</p>
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
          Back to MCP and Tools
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="size-5 text-muted-foreground" />
            <CardTitle>{tool.name}</CardTitle>
          </div>
          <CardDescription>{tool.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Example
            </p>
            <pre className="rounded-md bg-muted p-3 font-mono text-sm overflow-x-auto">
              {tool.example}
            </pre>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Parameters
            </p>
            {tool.parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No parameters.</p>
            ) : (
              <ul className="space-y-2">
                {tool.parameters.map((param) => (
                  <li
                    key={param.name}
                    className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <span className="font-mono text-sm font-medium">{param.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {param.type} — {param.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
