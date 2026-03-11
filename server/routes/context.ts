import { Router } from 'express'
import {
  getContextContent,
  setContextContent,
  listContextFiles,
  saveContextFile,
  deleteContextFile,
} from '../services/context.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badRequest, notFound } from '../errors.js'
import { validateBody, validateParams } from './validate.js'
import { patchContextBody, paramName } from './schemas.js'

export function createContextRouter(deps: RouteDeps): Router {
  const router = Router()
  const { upload } = deps

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const content = await getContextContent()
      res.json({ content })
    })
  )

  router.patch(
    '/',
    validateBody(patchContextBody),
    asyncHandler(async (req, res) => {
      await setContextContent(req.body.content)
      res.json({ content: req.body.content })
    })
  )

  router.get(
    '/files',
    asyncHandler(async (_req, res) => {
      const files = await listContextFiles()
      res.json({ files })
    })
  )

  router.post(
    '/files',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw badRequest('No file uploaded')
      const entry = await saveContextFile(req.file.originalname, req.file.buffer)
      res.status(201).json(entry)
    })
  )

  router.delete(
    '/files/:name',
    validateParams(paramName),
    asyncHandler(async (req, res) => {
      const name = decodeURIComponent(req.params.name)
      const deleted = await deleteContextFile(name)
      if (!deleted) throw notFound('File not found')
      res.status(204).send()
    })
  )

  return router
}
