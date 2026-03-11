/**
 * CLI settings: default project, default agent, optional API URL.
 * Loaded from (first found): .pmrc.json in cwd, ~/.config/agent-pm/settings.json, ~/.pmrc.json
 */

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

export type PmSettings = {
  defaultProject?: string
  defaultAgent?: string
  apiUrl?: string
}

const DEFAULT_API_URL = 'http://localhost:38472'

const SETTINGS_FILENAMES = [
  '.pmrc.json',
  '.agent-pm.json',
]

function findSettingsPath(): string | null {
  const cwd = process.cwd()
  for (const name of SETTINGS_FILENAMES) {
    const p = resolve(cwd, name)
    if (existsSync(p)) return p
  }
  const home = homedir()
  const configDir = resolve(home, '.config', 'agent-pm')
  if (existsSync(resolve(configDir, 'settings.json'))) {
    return resolve(configDir, 'settings.json')
  }
  for (const name of SETTINGS_FILENAMES) {
    const p = resolve(home, name)
    if (existsSync(p)) return p
  }
  return null
}

export function loadSettings(): PmSettings & { apiUrl: string } {
  const path = findSettingsPath()
  const base: PmSettings & { apiUrl: string } = {
    apiUrl: process.env.PM_API_URL ?? process.env.AGENT_PM_API_URL ?? DEFAULT_API_URL,
  }
  if (!path) return base
  try {
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    if (typeof data.defaultProject === 'string') base.defaultProject = data.defaultProject
    if (typeof data.defaultAgent === 'string') base.defaultAgent = data.defaultAgent
    if (typeof data.apiUrl === 'string') base.apiUrl = data.apiUrl
  } catch {
    // ignore invalid or unreadable settings
  }
  return base
}

export function getSettingsPathForHint(): string {
  const cwd = resolve(process.cwd(), SETTINGS_FILENAMES[0])
  return cwd
}
