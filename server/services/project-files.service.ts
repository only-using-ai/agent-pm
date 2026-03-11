/**
 * Project files service: list directory tree for a project's base path and read file contents.
 */

import { readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'

const MAX_FILE_SIZE = 512 * 1024 // 512KB

export type FileSystemTreeNode = {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  children: FileSystemTreeNode[]
}

/**
 * Build a tree of files and folders under rootDir. Paths in nodes are relative to rootDir.
 * rootDir must be an absolute path. Returns empty array if directory doesn't exist or can't be read.
 */
async function listDirectoryTreeInner(
  rootDir: string,
  currentDir: string
): Promise<FileSystemTreeNode[]> {
  const normalized = resolve(currentDir)
  const entries = await readdir(normalized, { withFileTypes: true })
  const result: FileSystemTreeNode[] = []
  const sortOrder = (a: FileSystemTreeNode, b: FileSystemTreeNode) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  }
  for (const e of entries) {
    const fullPath = join(normalized, e.name)
    const relativePath = relative(rootDir, fullPath).replace(/\\/g, '/')
    const id = relativePath
    if (e.isDirectory()) {
      const children = await listDirectoryTreeInner(rootDir, fullPath)
      result.push({
        id,
        name: e.name,
        path: relativePath,
        type: 'folder',
        children: children.sort(sortOrder),
      })
    } else if (e.isFile()) {
      result.push({
        id,
        name: e.name,
        path: relativePath,
        type: 'file',
        children: [],
      })
    }
  }
  return result.sort(sortOrder)
}

export async function listDirectoryTree(rootDir: string): Promise<FileSystemTreeNode[]> {
  const normalized = resolve(rootDir)
  try {
    return await listDirectoryTreeInner(normalized, normalized)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return []
    throw err
  }
}

/**
 * Read file content under rootDir. relativePath must be relative and resolve inside rootDir (no traversal).
 * Returns utf-8 string. Throws if file is too large (> 512KB) or not accessible.
 */
export async function readProjectFileContent(
  rootDir: string,
  relativePath: string
): Promise<string> {
  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/..')) {
    throw new Error('Invalid path')
  }
  const root = resolve(rootDir)
  const fullPath = resolve(root, normalizedPath)
  const normalized = fullPath.replace(/\\/g, '/')
  const rootNormalized = root.replace(/\\/g, '/')
  if (!normalized.startsWith(rootNormalized + '/') && normalized !== rootNormalized) {
    throw new Error('Invalid path')
  }
  try {
    const buf = await readFile(fullPath, { flag: 'r' })
    if (buf.length > MAX_FILE_SIZE) throw new Error('File too large')
    return buf.toString('utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error('File not found')
    if (code === 'EISDIR') throw new Error('Not a file')
    if (code === 'EACCES') throw new Error('Access denied')
    throw err
  }
}

/**
 * Write file content under rootDir. relativePath must be relative and resolve inside rootDir (no traversal).
 * Overwrites the file with utf-8 content. Throws if path is invalid or not writable.
 */
export async function writeProjectFileContent(
  rootDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/..')) {
    throw new Error('Invalid path')
  }
  const root = resolve(rootDir)
  const fullPath = resolve(root, normalizedPath)
  const normalized = fullPath.replace(/\\/g, '/')
  const rootNormalized = root.replace(/\\/g, '/')
  if (!normalized.startsWith(rootNormalized + '/') && normalized !== rootNormalized) {
    throw new Error('Invalid path')
  }
  try {
    await writeFile(fullPath, content, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error('File not found')
    if (code === 'EISDIR') throw new Error('Not a file')
    if (code === 'EACCES') throw new Error('Access denied')
    throw err
  }
}

/**
 * Delete a file under rootDir. relativePath must be relative and resolve inside rootDir (no traversal).
 * Throws if path is invalid, not a file, or not accessible. Does not delete directories.
 */
export async function deleteProjectFile(
  rootDir: string,
  relativePath: string
): Promise<void> {
  const normalizedPath = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/..')) {
    throw new Error('Invalid path')
  }
  const root = resolve(rootDir)
  const fullPath = resolve(root, normalizedPath)
  const normalized = fullPath.replace(/\\/g, '/')
  const rootNormalized = root.replace(/\\/g, '/')
  if (!normalized.startsWith(rootNormalized + '/') && normalized !== rootNormalized) {
    throw new Error('Invalid path')
  }
  try {
    await unlink(fullPath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new Error('File not found')
    if (code === 'EISDIR') throw new Error('Cannot delete directory')
    if (code === 'EACCES') throw new Error('Access denied')
    throw err
  }
}
