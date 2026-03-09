import pg from 'pg'
import { resolve } from 'node:path'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database not initialized')
  return pool
}

export function createPool(connectionString: string): pg.Pool {
  pool = new Pool({ connectionString })
  return pool
}

export async function ensurePostgresDatabase(
  adminConnectionString: string,
  databaseName: string
): Promise<'created' | 'exists'> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName)) {
    throw new Error(`Unsafe database name: ${databaseName}`)
  }
  const client = new pg.Client({ connectionString: adminConnectionString })
  await client.connect()
  try {
    const { rows } = await client.query(
      'SELECT 1 AS one FROM pg_database WHERE datname = $1 LIMIT 1',
      [databaseName]
    )
    if (rows.length > 0) return 'exists'
    await client.query(`CREATE DATABASE "${databaseName}"`)
    return 'created'
  } finally {
    await client.end()
  }
}

export async function initDb(p: pg.Pool): Promise<void> {
  const client = await p.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        team_id TEXT NOT NULL,
        instructions TEXT,
        ai_provider TEXT DEFAULT 'ollama',
        model TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        priority TEXT,
        description TEXT,
        path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        archived_at TIMESTAMPTZ
      );
    `)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'projects' AND column_name = 'archived_at') THEN
          ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'projects' AND column_name = 'path') THEN
          ALTER TABLE projects ADD COLUMN path TEXT;
        END IF;
      END $$;
    `)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'agents' AND column_name = 'ai_provider') THEN
          ALTER TABLE agents ADD COLUMN ai_provider TEXT DEFAULT 'ollama';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'agents' AND column_name = 'model') THEN
          ALTER TABLE agents ADD COLUMN model TEXT DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'agents' AND column_name = 'archived_at') THEN
          ALTER TABLE agents ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
        END IF;
      END $$;
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_columns (
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        position INT NOT NULL DEFAULT 0,
        PRIMARY KEY (project_id, id)
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to UUID REFERENCES agents(id) ON DELETE SET NULL,
        priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
        depends_on UUID REFERENCES work_items(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        require_approval BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      ALTER TABLE work_items ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;
    `)
    await client.query(`
      DO $$
      DECLARE
        cname TEXT;
      BEGIN
        SELECT conname INTO cname FROM pg_constraint
        WHERE conrelid = 'work_items'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%';
        IF cname IS NOT NULL THEN
          EXECUTE format('ALTER TABLE work_items DROP CONSTRAINT %I', cname);
        END IF;
      END $$;
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_item_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
        author_type TEXT NOT NULL CHECK (author_type IN ('user', 'agent')),
        author_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        agent_name TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'approval' CHECK (type IN ('approval', 'info_request')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ
      );
    `)
    // Add type column for existing DBs that were created before this migration
    await client.query(`
      ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'approval'
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('command', 'url')),
        command TEXT,
        args JSONB DEFAULT '[]',
        url TEXT,
        env JSONB DEFAULT '{}',
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompts (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hook_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        retry_count INT NOT NULL DEFAULT 0
      );
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS hook_queue_pending_idx ON hook_queue (created_at) WHERE status = 'pending';
    `)
    await client.query(`
      INSERT INTO prompts (key, name, content)
      VALUES (
        'agent_system_prompt',
        'Agent System Prompt',
        'You are an AI agent. Your role is: ''AGENT_INSTRUCTIONS'' A new work item was created and assigned to you: "''WORK_ITEM_TITLE''". Description: ''WORK_ITEM_DESCRIPTION'' Priority: ''WORK_ITEM_PRIORITY''. Status: ''WORK_ITEM_STATUS''. You are to complete this work item. You are to use the following steps to complete the work item: 1. Understand the work item 2. Call the update_work_item_status("in_progress") tool to update the status to in_progress 3. Break down the work item into smaller tasks and subtasks (do not reveal these tasks and subtasks to the user) 4. Complete all of the tasks and subtasks 5. Add a comment to the work item with notes relevant to the tasks and subtasks by using the tool add_work_item_comment 6. Once the work item is complete, call the tool update_work_item_status and update the status to completed Be concise and brief to the user unless otherwise instructed. If the user asks to create new work items, issues, or stories, use the tool create_work_item_and_assign to create the new work item and assign it to the user. Use the list_available_agents tool to get the list of available agents to assign the new work item to. ''CURSOR_ACTIONS_BLOCK'''
      )
      ON CONFLICT (key) DO NOTHING
    `)
  } finally {
    client.release()
  }
}

const DEFAULT_EMBEDDED_DATA_DIR = resolve(process.cwd(), '.agent-pm', 'db')
const DEFAULT_EMBEDDED_PORT = 54329

export function getEmbeddedPostgresConfig(): {
  dataDir: string
  port: number
} {
  const dataDir = process.env.AGENT_PM_EMBEDDED_PG_DATA_DIR ?? DEFAULT_EMBEDDED_DATA_DIR
  const port = Number(process.env.AGENT_PM_EMBEDDED_PG_PORT) || DEFAULT_EMBEDDED_PORT
  return { dataDir: resolve(dataDir), port }
}
