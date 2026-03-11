import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Circle, ListTodo } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmAlertDialog } from '@/components/ui/alert-dialog'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Conversation } from '@/components/ai/conversation'
import { Message } from '@/components/ai/message'
import { Reasoning } from '@/components/ai/reasoning'
import { useAgents } from '@/contexts/agents-context'
import { Streamdown } from 'streamdown'
import { useAgentStream } from '@/contexts/agent-stream-context'
import { useTeams } from '@/contexts/teams-context'
import { useProviderModels } from '@/hooks/use-provider-models'
import { useArchiveAgentMutation } from '@/hooks/queries'
import { getApiBase } from '@/lib/api'
import { AI_PROVIDERS } from '@/lib/ai-providers'

export function AgentPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { agents, refetch: refetchAgents } = useAgents()
  const archiveAgent = useArchiveAgentMutation()
  const {
    subscribe: subscribeToStream,
    streamContent,
    streamThinking,
    clearStream,
    streamingAgentIds,
    currentWorkItemIdByAgent,
  } = useAgentStream()
  const { teams, createTeam } = useTeams()
  const agent = agentId ? agents.find((a) => a.id === agentId) : null

  const [name, setName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [showNewTeamInput, setShowNewTeamInput] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadedAgent, setLoadedAgent] = useState<typeof agent>(null)
  const [singleFetchDone, setSingleFetchDone] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const openNewTeamInputOnCloseRef = useRef(false)

  const [aiProvider, setAiProvider] = useState<string>('ollama')
  const [model, setModel] = useState<string | null>(null)

  type QueueItem = {
    id: string
    project_id: string
    title: string
    status: string
    project_name: string
    priority: string
  }
  const [queueWorkItems, setQueueWorkItems] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)

  const { models: providerModels, loading: modelsLoading, error: modelsError } = useProviderModels(aiProvider)

  // Sync form when we have an agent (from list or from fetch)
  useEffect(() => {
    if (agent) {
      setLoadedAgent(agent)
      setName(agent.name)
      setSelectedTeamId(agent.team_id)
      setInstructions(agent.instructions ?? '')
      setAiProvider(agent.ai_provider ?? 'ollama')
      setModel(agent.model ?? null)
    }
  }, [agent])

  // If not in context, fetch single agent
  useEffect(() => {
    if (!agentId) return
    if (agent) {
      setSingleFetchDone(true)
      return
    }
    let cancelled = false
    setSingleFetchDone(false)
    fetch(`${getApiBase()}/api/agents/${agentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setSingleFetchDone(true)
        if (data) {
          setLoadedAgent(data)
          setName(data.name)
          setSelectedTeamId(data.team_id)
          setInstructions(data.instructions ?? '')
          setAiProvider(data.ai_provider ?? 'ollama')
          setModel(data.model ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setSingleFetchDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [agentId, agent])

  // Subscribe to this agent's stream when viewing their page
  useEffect(() => {
    if (!agentId) return
    return subscribeToStream(agentId)
  }, [agentId, subscribeToStream])

  // Fetch work items queued for this agent
  useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setQueueLoading(true)
    setQueueWorkItems([])
    fetch(`${getApiBase()}/api/agents/${agentId}/work-items`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setQueueWorkItems(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setQueueWorkItems([])
      })
      .finally(() => {
        if (!cancelled) setQueueLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId])

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)
  const isStreaming = agentId ? streamingAgentIds.has(agentId) : false
  const streamText = agentId ? streamContent[agentId] ?? '' : ''
  const streamThinkText = agentId ? streamThinking[agentId] ?? '' : ''
  const currentWorkItemId = agentId ? currentWorkItemIdByAgent[agentId] : undefined

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    setCreatingTeam(true)
    setSaveError(null)
    try {
      const team = await createTeam(newTeamName.trim())
      setSelectedTeamId(team.id)
      setNewTeamName('')
      setShowNewTeamInput(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentId) return
    if (!selectedTeamId) {
      setSaveError('Please select a team')
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const res = await fetch(`${getApiBase()}/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          team_id: selectedTeamId,
          instructions: instructions.trim() || null,
          ai_provider: aiProvider,
          model: model || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      await refetchAgents()
      setLoadedAgent(data)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveConfirm = async () => {
    if (!agentId) return
    await archiveAgent.mutateAsync(agentId)
    navigate('/')
  }

  const hasAgent = agent ?? loadedAgent
  const showNotFound =
    agentId && !hasAgent && (agents.length > 0 || singleFetchDone)
  const loading = agentId && !hasAgent && !singleFetchDone

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <p className="text-muted-foreground">Loading agent…</p>
      </div>
    )
  }
  if (showNotFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <p className="text-muted-foreground">Agent not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{hasAgent?.name ?? 'Agent'}</span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <Card>
            <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>Edit Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="e.g. Research Agent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
              <h3 className="text-sm font-medium">AI Provider</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="agent-ai-provider">Provider</Label>
                  <Select value={aiProvider} onValueChange={(v) => setAiProvider(v ?? '')}>
                    <SelectTrigger id="agent-ai-provider" className="w-full">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-model">Model</Label>
                  <Select
                    value={model ?? ''}
                    onValueChange={(v) => setModel(v || null)}
                    disabled={modelsLoading}
                  >
                    <SelectTrigger id="agent-model" className="w-full">
                      <SelectValue placeholder={modelsLoading ? 'Loading…' : 'Select model'} />
                    </SelectTrigger>
                    <SelectContent>
                      {providerModels.length === 0 && !modelsLoading && !modelsError && (
                        <SelectItem value="" disabled>No models found</SelectItem>
                      )}
                      {modelsError && (
                        <SelectItem value="" disabled>{modelsError}</SelectItem>
                      )}
                      {providerModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-team">Team</Label>
              <div className="flex flex-col gap-2">
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (!open) {
                      if (openNewTeamInputOnCloseRef.current) {
                        openNewTeamInputOnCloseRef.current = false
                      } else {
                        setShowNewTeamInput(false)
                      }
                    }
                  }}
                >
                  <DropdownMenuTrigger
                    type="button"
                    className={cn(
                      'flex h-8 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-normal',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none'
                    )}
                  >
                    <span className={cn(!selectedTeam && 'text-muted-foreground')}>
                      {selectedTeam ? selectedTeam.name : 'Select a team'}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-popper-anchor-width)]">
                    {teams.map((team) => (
                      <DropdownMenuItem
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                      >
                        {team.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault()
                        openNewTeamInputOnCloseRef.current = true
                        setShowNewTeamInput(true)
                      }}
                      className="text-muted-foreground"
                    >
                      + Create new team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {showNewTeamInput && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateTeam()
                        }
                      }}
                      autoFocus
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCreateTeam}
                      disabled={creatingTeam}
                    >
                      {creatingTeam ? 'Adding…' : 'Add'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions (prompt)</Label>
              <Textarea
                id="agent-instructions"
                placeholder="Write your agent instructions in Markdown..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={10}
                className="resize-y min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown for formatting and structure.
              </p>
            </div>
          </CardContent>
          {saveError && (
            <p className="px-6 text-sm text-destructive">{saveError}</p>
          )}
          <CardFooter className="flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={saving}
              className="ml-auto"
            >
              Archive
            </Button>
          </CardFooter>
        </form>
      </Card>
      <ConfirmAlertDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive this agent?"
        description="This agent will be removed from the agent list. You can restore it later from archived agents."
        confirmLabel="Yes, archive"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleArchiveConfirm}
      />
        </div>
        <div className="min-w-0 flex flex-col gap-6">
          {queueWorkItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="size-4" />
                  Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {queueLoading ? (
                  <p className="text-sm text-muted-foreground">Loading queue…</p>
                ) : (
                  <ul className="space-y-2">
                    {queueWorkItems.map((item) => {
                      const isWorkingOn =
                        currentWorkItemId === item.id || item.status === 'in_progress'
                      return (
                        <li key={item.id}>
                          <Link
                            to={`/projects/${item.project_id}?workItem=${item.id}`}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors',
                              'hover:border-border hover:bg-muted/50',
                              isWorkingOn && 'border-primary/50 bg-primary/5'
                            )}
                          >
                            {isWorkingOn ? (
                              <Circle className="size-2.5 shrink-0 fill-primary text-primary" />
                            ) : (
                              <Circle className="size-2.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {item.title}
                            </span>
                            {isWorkingOn && (
                              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                                Working on
                              </span>
                            )}
                            <span className="shrink-0 text-xs text-muted-foreground capitalize">
                              {item.status.replace('_', ' ')}
                            </span>
                          </Link>
                          <p className="ml-5 mt-0.5 text-xs text-muted-foreground">
                            {item.project_name}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="flex flex-1 flex-col min-h-[320px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Agent stream</CardTitle>
              {(streamText || streamThinkText) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => agentId && clearStream(agentId)}
                >
                  Clear
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
              <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
                <Conversation
                  empty={
                    <p className="text-sm text-muted-foreground">
                      When a work item is assigned to this agent, their response will stream here.
                    </p>
                  }
                >
                  {(streamThinkText || streamText) && (
                    <Message role="assistant">
                      <div className="flex flex-col gap-3 text-left">
                        {streamThinkText ? (
                          <Reasoning
                            content={streamThinkText}
                            isStreaming={isStreaming && !!streamThinkText}
                          />
                        ) : null}
                        {streamText ? (
                          <div className="text-sm [&_.streamdown]:text-sm">
                            <Streamdown
                              isAnimating={isStreaming}
                              animated
                            >
                              {`${streamText}${isStreaming ? '▌' : ''}`}
                            </Streamdown>
                          </div>
                        ) : null}
                      </div>
                    </Message>
                  )}
                </Conversation>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
