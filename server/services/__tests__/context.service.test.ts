import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import {
  getContextContent,
  setContextContent,
  listContextFiles,
  saveContextFile,
  deleteContextFile,
} from '../context.service.js'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const mock = {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
  }
  return { ...mock, default: mock }
})

describe('context.service', () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockReset()
    vi.mocked(fs.writeFile).mockReset()
    vi.mocked(fs.mkdir).mockReset()
    vi.mocked(fs.readdir).mockReset()
    vi.mocked(fs.stat).mockReset()
    vi.mocked(fs.unlink).mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getContextContent', () => {
    it('returns file content when file exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('# Context')
      const result = await getContextContent()
      expect(result).toBe('# Context')
    })

    it('returns empty string on ENOENT', async () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(fs.readFile).mockRejectedValue(err)
      const result = await getContextContent()
      expect(result).toBe('')
    })

    it('rethrows on other errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('EACCES'))
      await expect(getContextContent()).rejects.toThrow('EACCES')
    })
  })

  describe('setContextContent', () => {
    it('writes content to context file', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      await setContextContent('new content')
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('listContextFiles', () => {
    it('returns sorted file entries', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['b.txt', 'a.txt'] as any)
      vi.mocked(fs.stat)
        .mockResolvedValueOnce({ isFile: () => true, size: 10, mtime: new Date('2025-01-01') } as any)
        .mockResolvedValueOnce({ isFile: () => true, size: 20, mtime: new Date('2025-01-02') } as any)
      const result = await listContextFiles()
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('a.txt')
      expect(result[1].name).toBe('b.txt')
    })

    it('skips unsafe names', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['..', 'safe.txt'] as any)
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true, size: 0, mtime: new Date() } as any)
      const result = await listContextFiles()
      expect(result.some((e) => e.name === '..')).toBe(false)
    })
  })

  describe('saveContextFile', () => {
    it('writes buffer and returns entry', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.stat).mockResolvedValue({ size: 5, mtime: new Date('2025-01-01') } as any)
      const result = await saveContextFile('dir/name.txt', Buffer.from('hello'))
      expect(result.name).toBe('name.txt')
      expect(result.size).toBe(5)
    })
  })

  describe('deleteContextFile', () => {
    it('returns true when file deleted', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined)
      const result = await deleteContextFile('safe.txt')
      expect(result).toBe(true)
    })

    it('returns false on ENOENT', async () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(fs.unlink).mockRejectedValue(err)
      const result = await deleteContextFile('missing.txt')
      expect(result).toBe(false)
    })

    it('returns false for unsafe name', async () => {
      const result = await deleteContextFile('../etc/passwd')
      expect(result).toBe(false)
      expect(fs.unlink).not.toHaveBeenCalled()
    })
  })
})
