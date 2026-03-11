/**
 * Database migration runner. Reads SQL files from server/migrations/ in
 * lexicographic order and runs any that are not yet recorded in schema_migrations.
 * Call runMigrations(pool) after the migrations table and baseline tables exist.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

const MIGRATIONS_TABLE = 'schema_migrations'

/**
 * Ensure the schema_migrations table exists. Idempotent.
 */
export async function ensureMigrationsTable(p: Pool): Promise<void> {
  await p.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

/**
 * Return the directory containing migration .sql files (server/migrations).
 */
function getMigrationsDir(): string {
  const dir = dirname(fileURLToPath(import.meta.url))
  return join(dir, 'migrations')
}

/**
 * List migration file names (e.g. 001_add_projects_color_icon.sql) sorted.
 */
function listMigrationFiles(): string[] {
  const dir = getMigrationsDir()
  const files = readdirSync(dir)
  return files
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/**
 * Run all pending migrations. Assumes schema_migrations table and baseline
 * tables already exist. Each migration runs in a single transaction.
 */
export async function runMigrations(p: Pool): Promise<void> {
  await ensureMigrationsTable(p)
  const applied = await getAppliedMigrations(p)
  const files = listMigrationFiles()

  for (const name of files) {
    if (applied.has(name)) continue
    const client = await p.connect()
    try {
      const dir = getMigrationsDir()
      const sql = readFileSync(join(dir, name), 'utf-8').trim()
      if (!sql) continue
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
        [name]
      )
      await client.query('COMMIT')
      console.log(`Migration applied: ${name}`)
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }
}

async function getAppliedMigrations(p: Pool): Promise<Set<string>> {
  const { rows } = await p.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE}`
  )
  return new Set(rows.map((r) => r.name))
}
