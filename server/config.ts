/**
 * Centralized server configuration from environment variables.
 *
 * All env is read here; the rest of the server uses this module instead of
 * process.env. Expected variables are documented below and in .env.example.
 *
 * @see .env.example for a copy-paste template
 */

import { resolve, dirname, delimiter } from 'node:path'

const DEFAULT_PORT = 38_472
const DEFAULT_OLLAMA_BASE = 'http://localhost:11434'
const DEFAULT_OLLAMA_MODEL = 'llama3'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022'
const DEFAULT_CURSOR_MODEL = 'claude-4.5-sonnet-thinking'
const DEFAULT_GEMINI_MODEL = 'auto'
const DEFAULT_EMBEDDED_DATA_DIR = '.agent-pm/db'
const DEFAULT_EMBEDDED_PORT = 54329

/** Server port. Env: AGENT_PM_PORT or PORT. */
export function getServerPort(): number {
  const env = process.env.AGENT_PM_PORT ?? process.env.PORT
  if (env != null && env !== '') {
    const n = Number(env)
    if (Number.isInteger(n) && n > 0 && n < 65536) return n
  }
  return DEFAULT_PORT
}

/**
 * PostgreSQL connection string. When set, the server uses external Postgres;
 * when unset, it starts embedded Postgres.
 * Env: DATABASE_URL
 */
export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url?.trim() || undefined
}

/** Redacted DATABASE_URL for logging (host:port/database). */
export function getDatabaseUrlForLog(): string {
  const url = getDatabaseUrl()
  if (!url) return '(none)'
  try {
    const u = new URL(url)
    const host = u.hostname || 'localhost'
    const port = u.port || '5432'
    const db = (u.pathname || '/').replace(/^\//, '') || 'postgres'
    return `${host}:${port}/${db}`
  } catch {
    return '(invalid URL)'
  }
}

/**
 * Embedded Postgres config (used when DATABASE_URL is not set).
 * Env: AGENT_PM_EMBEDDED_PG_DATA_DIR, AGENT_PM_EMBEDDED_PG_PORT, AGENT_PM_EMBEDDED_PG_VERBOSE
 */
export function getEmbeddedPostgresConfig(): {
  dataDir: string
  port: number
  verbose: boolean
} {
  const dataDir =
    process.env.AGENT_PM_EMBEDDED_PG_DATA_DIR ?? DEFAULT_EMBEDDED_DATA_DIR
  const port =
    Number(process.env.AGENT_PM_EMBEDDED_PG_PORT) || DEFAULT_EMBEDDED_PORT
  const verbose = process.env.AGENT_PM_EMBEDDED_PG_VERBOSE === 'true'
  return { dataDir: resolve(dataDir), port, verbose }
}

/** Ollama base URL (no trailing slash). Env: OLLAMA_URL or OLLAMA_BASE_URL. */
export function getOllamaBaseUrl(): string {
  const url =
    process.env.OLLAMA_URL ??
    process.env.OLLAMA_BASE_URL ??
    DEFAULT_OLLAMA_BASE
  return url.replace(/\/$/, '')
}

/** Ollama default model. Env: OLLAMA_MODEL. */
export function getOllamaDefaultModel(): string {
  return process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL
}

/** OpenAI API key. Env: OPENAI_API_KEY. */
export function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? ''
}

/** OpenAI API base URL (optional). Env: OPENAI_BASE_URL. */
export function getOpenAIBaseUrl(): string | undefined {
  const u = process.env.OPENAI_BASE_URL?.trim()
  return u || undefined
}

/** OpenAI default model. Env: OPENAI_MODEL. */
export function getOpenAIDefaultModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL
}

/** Anthropic API key. Env: ANTHROPIC_API_KEY. */
export function getAnthropicApiKey(): string {
  return process.env.ANTHROPIC_API_KEY?.trim() ?? ''
}

/** Anthropic default model. Env: ANTHROPIC_MODEL. */
export function getAnthropicDefaultModel(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL
}

/** Cursor API key (for listing models / API usage). Env: CURSOR_API_KEY. */
export function getCursorApiKey(): string {
  return process.env.CURSOR_API_KEY?.trim() ?? ''
}

/**
 * Path to the Cursor CLI binary. Used when running "cursor agent models" (and
 * for CLI agent runs). Env: CURSOR_CLI_PATH. When unset, on macOS uses the
 * default app-bundle path so the server finds Cursor even when it's not on PATH.
 */
export function getCursorCliPath(): string {
  const envPath = process.env.CURSOR_CLI_PATH?.trim()
  if (envPath) return envPath
  if (process.platform === 'darwin') {
    return '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'
  }
  return 'cursor'
}

/** Cursor default model for CLI agent runs. Env: CURSOR_MODEL. */
export function getCursorDefaultModel(): string {
  return process.env.CURSOR_MODEL ?? DEFAULT_CURSOR_MODEL
}

/**
 * Path to the Gemini CLI binary. Used for CLI agent runs.
 * Env: GEMINI_CLI_PATH. When unset, uses "gemini" (must be on PATH).
 */
export function getGeminiCliPath(): string {
  const envPath = process.env.GEMINI_CLI_PATH?.trim()
  return envPath ?? 'gemini'
}

/**
 * Returns process.env with the directory of the current Node executable prepended to PATH.
 * Use when spawning the Gemini CLI (or other node-shebang scripts) so that "env node" in
 * their shebang can find node even when the server runs with a minimal PATH (e.g. launchd).
 */
export function getEnvWithNodeInPath(): NodeJS.ProcessEnv {
  const nodeDir = dirname(process.execPath)
  const pathEnv = process.env.PATH ?? ''
  if (pathEnv.includes(nodeDir)) return process.env
  return { ...process.env, PATH: `${nodeDir}${pathEnv ? delimiter + pathEnv : ''}` }
}

/** Gemini default model for CLI agent runs. Env: GEMINI_MODEL. Aliases: auto, pro, flash, flash-lite. */
export function getGeminiDefaultModel(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
}

/**
 * Single config object for convenience (e.g. passing to agent/model code).
 * All values are read from env at call time.
 */
export const config = {
  get serverPort() {
    return getServerPort()
  },
  get databaseUrl() {
    return getDatabaseUrl()
  },
  get embeddedPostgres() {
    return getEmbeddedPostgresConfig()
  },
  ollama: {
    get baseUrl() {
      return getOllamaBaseUrl()
    },
    get defaultModel() {
      return getOllamaDefaultModel()
    },
  },
  openai: {
    get apiKey() {
      return getOpenAIApiKey()
    },
    get baseUrl() {
      return getOpenAIBaseUrl()
    },
    get defaultModel() {
      return getOpenAIDefaultModel()
    },
  },
  anthropic: {
    get apiKey() {
      return getAnthropicApiKey()
    },
    get defaultModel() {
      return getAnthropicDefaultModel()
    },
  },
  cursor: {
    get apiKey() {
      return getCursorApiKey()
    },
    get cliPath() {
      return getCursorCliPath()
    },
    get defaultModel() {
      return getCursorDefaultModel()
    },
  },
  gemini: {
    get cliPath() {
      return getGeminiCliPath()
    },
    get defaultModel() {
      return getGeminiDefaultModel()
    },
  },
} as const
