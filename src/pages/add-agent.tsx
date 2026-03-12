import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTeams } from '@/contexts/teams-context'
import { useCreateAgentMutation } from '@/hooks/queries'
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
import { useProviderModels } from '@/hooks/use-provider-models'
import { AI_PROVIDERS } from '@/lib/ai-providers'

export function AddAgentPage() {
  const navigate = useNavigate()
  const createAgent = useCreateAgentMutation()
  const { teams, createTeam } = useTeams()
  const [name, setName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [instructions, setInstructions] = useState('')
  const [showNewTeamInput, setShowNewTeamInput] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [aiProvider, setAiProvider] = useState<string>('ollama')
  const [model, setModel] = useState<string | null>(null)
  const openNewTeamInputOnCloseRef = useRef(false)

  const { models: providerModels, loading: modelsLoading, error: modelsError } = useProviderModels(aiProvider)
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    setCreatingTeam(true)
    setSubmitError(null)
    try {
      const team = await createTeam(newTeamName.trim())
      setSelectedTeamId(team.id)
      setNewTeamName('')
      setShowNewTeamInput(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId) {
      setSubmitError('Please select a team')
      return
    }
    setSubmitError(null)
    try {
      await createAgent.mutateAsync({
        name: name.trim(),
        team_id: selectedTeamId,
        instructions: instructions.trim() || null,
        ai_provider: aiProvider,
        model: model || null,
      })
      navigate('/')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create agent')
    }
  }

  return (
    <div className="mx-auto w-1/2 max-w-[84rem] space-y-6">
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
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Add Agent</CardTitle>
            <CardDescription>
              Create a new agent and assign it to a team. Add instructions to define its behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
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
              <Label htmlFor="agent-team">Agent Team</Label>
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
              <Label htmlFor="agent-instructions">Agent instructions</Label>
              <Textarea
                id="agent-instructions"
                placeholder="Write your agent instructions in Markdown...&#10;&#10;Example:&#10;- You are a research assistant.&#10;- Always cite sources.&#10;- Use clear, structured output."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={8}
                className="resize-y min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown for formatting and structure.
              </p>
            </div>
          </CardContent>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <CardFooter className="gap-2">
            <Button type="submit" disabled={createAgent.isPending}>
              {createAgent.isPending ? 'Creating…' : 'Create Agent'}
            </Button>
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Cancel
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
