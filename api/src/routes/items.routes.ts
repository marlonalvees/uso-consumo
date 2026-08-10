import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { listItems } from '../controllers/items.controller'

const router = Router()

router.get('/', requireAuth, listItems)

export default router
