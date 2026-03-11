import path from 'node:path'
import { Router } from 'express'
import {
  getProfile,
  updateProfile,
  saveAvatar,
  getAvatarFilePath,
  readAvatarFile,
} from '../services/profile.service.js'
import type { RouteDeps } from './types.js'
import { asyncHandler, badRequest, notFound } from '../errors.js'
import { validateBody } from './validate.js'
import { updateProfileBody } from './schemas.js'

export function createProfileRouter(deps: RouteDeps): Router {
  const router = Router()
  const { getPool, upload } = deps
  const pool = () => getPool()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const profile = await getProfile(pool())
      if (!profile) throw notFound('Profile not found')
      res.json(profile)
    })
  )

  router.patch(
    '/',
    validateBody(updateProfileBody),
    asyncHandler(async (req, res) => {
      const profile = await updateProfile(pool(), req.body)
      res.json(profile)
    })
  )

  router.post(
    '/avatar',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw badRequest('No file uploaded')
      if (!req.file.mimetype.startsWith('image/')) throw badRequest('File must be an image')
      const profile = await saveAvatar(
        pool(),
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      )
      res.status(200).json(profile)
    })
  )

  router.get(
    '/avatar',
    asyncHandler(async (_req, res) => {
      const filePath = await getAvatarFilePath(pool())
      if (!filePath) throw notFound('Avatar not found')
      const buf = await readAvatarFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.gif'
            ? 'image/gif'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg'
      res.setHeader('Content-Type', mime)
      res.send(buf)
    })
  )

  return router
}
