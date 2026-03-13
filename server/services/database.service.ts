import type { Pool } from 'pg'

export type TableInfo = {
  table_schema: string
  table_name: string
}

/**
 * List tables in the public schema (and optionally others) from information_schema.
 */
export async function listTables(pool: Pool): Promise<TableInfo[]> {
  const { rows } = await pool.query<TableInfo>(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `)
  return rows
}

/**
 * Execute a read-only query. Only SELECT is allowed; throws for other statement types.
 */
export async function executeReadOnlyQuery(
  pool: Pool,
  query: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const trimmed = query.trim().replace(/^[\s;]+/, '')
  const upper = trimmed.toUpperCase()
  if (!upper.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed')
  }
  const result = await pool.query({ text: query, rowMode: 'object' })
  const columns = result.fields?.map((f) => f.name) ?? []
  const rows = (result.rows ?? []) as Record<string, unknown>[]
  return { columns, rows }
}

/**
 * Get column names for a table from information_schema.
 */
export async function getTableColumns(
  pool: Pool,
  tableSchema: string,
  tableName: string
): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [tableSchema, tableName]
  )
  return rows.map((r) => r.column_name)
}

/**
 * Delete a single row from a table. Row keys must match table columns; all provided
 * columns are used in the WHERE clause (AND). Uses parameterized query for safety.
 */
export async function deleteRow(
  pool: Pool,
  tableSchema: string,
  tableName: string,
  row: Record<string, unknown>
): Promise<void> {
  const columns = await getTableColumns(pool, tableSchema, tableName)
  if (columns.length === 0) {
    throw new Error(`Table ${tableSchema}.${tableName} not found or has no columns`)
  }
  const validKeys = Object.keys(row).filter((k) => columns.includes(k))
  if (validKeys.length === 0) {
    throw new Error('Row must include at least one column value matching the table')
  }
  // Quote identifiers; values are parameterized
  const quotedSchema = `"${tableSchema.replace(/"/g, '""')}"`
  const quotedTable = `"${tableName.replace(/"/g, '""')}"`
  const whereParts = validKeys.map((col, i) => `"${col.replace(/"/g, '""')}" = $${i + 1}`)
  const values = validKeys.map((k) => row[k])
  const sql = `DELETE FROM ${quotedSchema}.${quotedTable} WHERE ${whereParts.join(' AND ')}`
  await pool.query(sql, values)
}
