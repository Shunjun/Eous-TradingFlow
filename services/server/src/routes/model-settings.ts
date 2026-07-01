import { Hono } from 'hono'
import { authMiddleware } from '../lib/auth-middleware.js'
import * as modelSettingsService from '../modules/model-settings/index.js'

export const modelSettingsRouter = new Hono()

modelSettingsRouter.use('*', authMiddleware)

modelSettingsRouter.get('/', async (c) => {
  const settings = await modelSettingsService.getUserModelSettings(c.get('userId'))
  return c.json({ settings })
})

modelSettingsRouter.patch('/', async (c) => {
  const body = await c.req.json<modelSettingsService.UpdateUserModelSettingsBody>()
  const settings = await modelSettingsService.updateUserModelSettings(c.get('userId'), body)
  return c.json({ settings })
})
