import path from 'node:path'
import { Router } from 'express'
import { getProjectById } from '../services/projects.service.js'
import {
  deleteProjectFile,
  listDirectoryTree,
  readProjectFileContent,
  writeProjectFileContent,
} from '../services/project-files.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badRequest, notFound } from '../errors.js'
import { validateParams, validateQuery, validateBody } from './validate.js'
import { paramProjectId, queryPath, putProjectFileBody } from './schemas.js'

export function createProjectFilesRouter(deps: Pick<RouteDeps, 'getPool'>): Router {
  const router = Router({ mergeParams: true })
  const pool = () => deps.getPool()

  router.get(
    '/',
    validateParams(paramProjectId),
    asyncHandler(async (req, res) => {
      const project = await getProjectById(pool(), req.params.projectId)
      if (!project) throw notFound('Project not found')
      const rawPath = project.path?.trim()
      if (!rawPath) return res.json({ tree: [] })
      const rootDir = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath)
      const tree = await listDirectoryTree(rootDir)
      res.json({ tree })
    })
  )

  router.get(
    '/content',
    validateParams(paramProjectId),
    validateQuery(queryPath),
    asyncHandler(async (req, res) => {
      const project = await getProjectById(pool(), req.params.projectId)
      if (!project) throw notFound('Project not found')
      const rawPath = project.path?.trim()
      if (!rawPath) throw badRequest('Project has no base path')
      const rootDir = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath)
      const filePath = req.query.path as string
      try {
        const content = await readProjectFileContent(rootDir, filePath)
        res.json({ content })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'File not found' || msg === 'Not a file') throw notFound(msg)
        if (msg === 'Invalid path' || msg === 'Access denied' || msg === 'File too large') {
          throw badRequest(msg)
        }
        throw e
      }
    })
  )

  router.put(
    '/content',
    validateParams(paramProjectId),
    validateQuery(queryPath),
    validateBody(putProjectFileBody),
    asyncHandler(async (req, res) => {
      const project = await getProjectById(pool(), req.params.projectId)
      if (!project) throw notFound('Project not found')
      const rawPath = project.path?.trim()
      if (!rawPath) throw badRequest('Project has no base path')
      const rootDir = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath)
      const filePath = req.query.path as string
      try {
        await writeProjectFileContent(rootDir, filePath, req.body.content)
        res.json({ content: req.body.content })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'File not found' || msg === 'Not a file') throw notFound(msg)
        if (msg === 'Invalid path' || msg === 'Access denied') throw badRequest(msg)
        throw e
      }
    })
  )

  router.delete(
    '/',
    validateParams(paramProjectId),
    validateQuery(queryPath),
    asyncHandler(async (req, res) => {
      const project = await getProjectById(pool(), req.params.projectId)
      if (!project) throw notFound('Project not found')
      const rawPath = project.path?.trim()
      if (!rawPath) throw badRequest('Project has no base path')
      const rootDir = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath)
      const filePath = req.query.path as string
      try {
        await deleteProjectFile(rootDir, filePath)
        res.status(204).send()
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg === 'File not found' || msg === 'Cannot delete directory') throw notFound(msg)
        if (msg === 'Invalid path' || msg === 'Access denied') throw badRequest(msg)
        throw e
      }
    })
  )

  return router
}
