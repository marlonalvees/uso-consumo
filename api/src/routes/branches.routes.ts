import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import { listBranches } from '../controllers/branches.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', requireAdmin, listBranches)

export default router
