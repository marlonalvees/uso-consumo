import { Router } from 'express'
import { requireAuth, requireModule } from '../middlewares/auth'
import { getPushConfig, subscribe, unsubscribe } from '../controllers/push.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/config', getPushConfig)
router.post('/subscribe', subscribe)
router.post('/unsubscribe', unsubscribe)

export default router
