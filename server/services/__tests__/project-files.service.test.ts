import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import {
  listDirectoryTree,
  readProjectFileContent,
  writeProjectFileContent,
  deleteProjectFile,
} from '../project-files.service.js'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  const mock = {
    ...actual,
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  }
  return { ...mock, default: mock }
})

describe('project-files.service', () => {
  beforeEach(() => {
    vi.mocked(fs.readdir).mockReset()
    vi.mocked(fs.readFile).mockReset()
    vi.mocked(fs.writeFile).mockReset()
    vi.mocked(fs.unlink).mockReset()
  })

  describe('listDirectoryTree', () => {
    it('returns empty array on ENOENT', async () => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      vi.mocked(fs.readdir).mockRejectedValue(err)
      const result = await listDirectoryTree('/nonexistent')
      expect(result).toEqual([])
    })

    it('returns tree when directory exists', async () => {
      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([
          { name: 'file.txt', isDirectory: () => false, isFile: () => true },
          { name: 'sub', isDirectory: () => true, isFile: () => false },
        ] as any)
        .mockResolvedValueOnce([])
      const result = await listDirectoryTree('/root')
      expect(result.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('readProjectFileContent', () => {
    it('throws on path traversal', async () => {
      await expect(
        readProjectFileContent('/root', '../etc/passwd')
      ).rejects.toThrow('Invalid path')
    })

    it('throws when file too large', async () => {
      const big = Buffer.alloc(600 * 1024)
      vi.mocked(fs.readFile).mockResolvedValue(big)
      await expect(
        readProjectFileContent('/root', 'big.txt')
      ).rejects.toThrow('File too large')
    })

    it('returns content when valid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('hello', 'utf-8'))
      const result = await readProjectFileContent('/root', 'a.txt')
      expect(result).toBe('hello')
    })
  })

  describe('writeProjectFileContent', () => {
    it('throws on invalid path', async () => {
      await expect(
        writeProjectFileContent('/root', '../x', 'content')
      ).rejects.toThrow('Invalid path')
    })

    it('writes when path valid', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      await writeProjectFileContent('/root', 'file.txt', 'content')
      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('deleteProjectFile', () => {
    it('throws on invalid path', async () => {
      await expect(deleteProjectFile('/root', '../x')).rejects.toThrow('Invalid path')
    })

    it('unlinks when path valid', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined)
      await deleteProjectFile('/root', 'file.txt')
      expect(fs.unlink).toHaveBeenCalled()
    })
  })
})
