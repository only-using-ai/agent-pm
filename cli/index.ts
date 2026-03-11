#!/usr/bin/env node
/**
 * pm CLI – work item and project management.
 * Example: pm wi --create --title Example --summary "Description" --agent "Agent Name" --project "Project Name"
 */

import { loadSettings, getSettingsPathForHint } from './settings.js'
import { listProjects, listAgents, createWorkItem } from './api.js'

const HELP = `pm – Agent PM CLI

Usage:
  pm wi [options]           Work item (short form)
  pm work-item [options]     Work item (long form)

Commands / options:
  --create                   Create a new work item (required for create)
  --title <string>           Work item title (required)
  --summary <string>        Work item description/summary
  --project <string>         Project name (required, or set default in settings)
  --agent <string>           Agent name to assign (optional, or set default in settings)
  --require-approval         Require approval in Inbox before the agent starts

Settings:
  Defaults for --project and --agent can be set in a config file.
  Create one of these (first found wins):
    .pmrc.json in current directory
    .agent-pm.json in current directory
    ~/.config/agent-pm/settings.json
    ~/.pmrc.json

  Example .pmrc.json:
    {
      "defaultProject": "Applied AI Course",
      "defaultAgent": "Assessments and Outcomes",
      "apiUrl": "http://localhost:38472"
    }

  Environment: PM_API_URL or AGENT_PM_API_URL overrides apiUrl.

Examples:
  pm wi --create --title "Fix login" --summary "Fix the login bug" --project "My Project" --agent "Backend Agent"
  pm wi --create --title "Deploy to prod" --project "My Project" --agent "Backend Agent" --require-approval
  pm work-item --create --title "Example" --summary "This is the boxy" --agent "Assessments and Outcomes" --project "Applied AI Course"
`

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--create') {
      out.create = true
    } else if (arg === '--title' && argv[i + 1] !== undefined) {
      out.title = argv[++i]
    } else if ((arg === '--summary' || arg === '-s') && argv[i + 1] !== undefined) {
      out.summary = argv[++i]
    } else if (arg === '--project' && argv[i + 1] !== undefined) {
      out.project = argv[++i]
    } else if (arg === '--agent' && argv[i + 1] !== undefined) {
      out.agent = argv[++i]
    } else if (arg === '--require-approval') {
      out.require_approval = true
    } else if (arg === '--help' || arg === '-h') {
      out.help = true
    }
  }
  return out
}

function findByName<T extends { name: string; id: string }>(items: T[], name: string): T | null {
  const trimmed = name.trim()
  const exact = items.find((p) => p.name === trimmed)
  if (exact) return exact
  const lower = trimmed.toLowerCase()
  return items.find((p) => p.name.toLowerCase() === lower) ?? null
}

async function runCreate(flags: Record<string, string | boolean>, settings: ReturnType<typeof loadSettings>): Promise<void> {
  const title = flags.title
  const projectName = (flags.project as string) ?? settings.defaultProject
  if (!title || typeof title !== 'string' || !title.trim()) {
    console.error('Error: --title is required')
    process.exit(1)
  }
  if (!projectName || typeof projectName !== 'string' || !projectName.trim()) {
    console.error('Error: --project is required (or set defaultProject in settings)')
    console.error(`  Example: create ${getSettingsPathForHint()} with "defaultProject": "Your Project Name"`)
    process.exit(1)
  }

  const [projects, agents] = await Promise.all([
    listProjects(settings.apiUrl),
    listAgents(settings.apiUrl),
  ])

  const project = findByName(projects, projectName)
  if (!project) {
    console.error(`Error: Project not found: "${projectName}"`)
    if (projects.length > 0) {
      console.error('  Available projects:', projects.map((p) => p.name).join(', '))
    }
    process.exit(1)
  }

  let assigned_to: string | null = null
  const agentName = (flags.agent as string) ?? settings.defaultAgent
  if (agentName && typeof agentName === 'string' && agentName.trim()) {
    const agent = findByName(agents, agentName)
    if (!agent) {
      console.error(`Error: Agent not found: "${agentName}"`)
      if (agents.length > 0) {
        console.error('  Available agents:', agents.map((a) => a.name).join(', '))
      }
      process.exit(1)
    }
    assigned_to = agent.id
  }

  const summary = flags.summary
  const description = typeof summary === 'string' ? summary.trim() || undefined : undefined

  const item = await createWorkItem(settings.apiUrl, project.id, {
    title: (title as string).trim(),
    description: description ?? null,
    assigned_to,
    require_approval: flags.require_approval === true,
  })

  console.log(`Created work item: ${item.id}`)
  console.log(`  Title: ${item.title}`)
  console.log(`  Project: ${project.name}`)
  if (item.assigned_to && agentName) {
    console.log(`  Agent: ${agentName}`)
  }
  if (flags.require_approval) {
    console.log(`  Requires approval: item is in Inbox; approve there to start the agent.`)
  }
}

function main(): void {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(HELP)
    process.exit(0)
  }

  const sub = argv[0].toLowerCase()
  const isWorkItem = sub === 'wi' || sub === 'work-item'
  if (!isWorkItem) {
    console.error(`Unknown command: ${argv[0]}`)
    console.log(HELP)
    process.exit(1)
  }

  const flags = parseArgv(argv.slice(1))
  if (flags.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (flags.create) {
    const settings = loadSettings()
    runCreate(flags, settings)
      .then(() => {})
      .catch((err) => {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      })
    return
  }

  console.error('Use --create to create a work item. See --help for usage.')
  process.exit(1)
}

main()
