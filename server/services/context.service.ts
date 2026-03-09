/**
 * Context service: read/write additional context markdown and list/upload/delete
 * files in .agent-pm/context.md and .agent-pm/files.
 */

import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const CONTEXT_BASE = resolve(process.cwd(), '.agent-pm')
const CONTEXT_FILE = join(CONTEXT_BASE, 'context.md')
const FILES_DIR = join(CONTEXT_BASE, 'files')

async function ensureFilesDir(): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true })
}

export async function getContextContent(): Promise<string> {
  try {
    const buf = await readFile(CONTEXT_FILE, 'utf-8')
    return buf
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw err
  }
}

export async function setContextContent(content: string): Promise<void> {
  await mkdir(CONTEXT_BASE, { recursive: true })
  await writeFile(CONTEXT_FILE, content, 'utf-8')
}

export type ContextFileEntry = {
  name: string
  size: number
  updatedAt: string
}

export async function listContextFiles(): Promise<ContextFileEntry[]> {
  await ensureFilesDir()
  const names = await readdir(FILES_DIR)
  const entries: ContextFileEntry[] = []
  for (const name of names) {
    const safe = name === decodeURIComponent(name) && !name.includes('..') && !name.includes('/')
    if (!safe) continue
    const filePath = join(FILES_DIR, name)
    try {
      const st = await stat(filePath)
      if (st.isFile()) {
        entries.push({
          name,
          size: st.size,
          updatedAt: st.mtime.toISOString(),
        })
      }
    } catch {
      // skip if stat fails (e.g. symlink broken)
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

function safeFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').trim()
  if (!base) return 'file'
  return base
}

export async function saveContextFile(
  originalName: string,
  buffer: Buffer
): Promise<ContextFileEntry> {
  await ensureFilesDir()
  const name = safeFileName(originalName)
  const filePath = join(FILES_DIR, name)
  await writeFile(filePath, buffer)
  const st = await stat(filePath)
  return {
    name,
    size: st.size,
    updatedAt: st.mtime.toISOString(),
  }
}

export async function deleteContextFile(name: string): Promise<boolean> {
  const safe = name === decodeURIComponent(name) && !name.includes('..') && !name.includes('/')
  if (!safe) return false
  const filePath = join(FILES_DIR, name)
  try {
    await unlink(filePath)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}
