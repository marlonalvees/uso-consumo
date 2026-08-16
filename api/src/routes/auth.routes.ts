import { Router } from 'express'
import { requireAuth, requireModule } from '../middlewares/auth'
import { me } from '../controllers/auth.controller'

const router = Router()

router.get('/me', requireAuth, requireModule, me)

export default router
