import { Router } from 'express'
import { requireAuth, requireRole } from '../middlewares/auth'
import { listBranches } from '../controllers/branches.controller'

const router = Router()

router.use(requireAuth)

router.get('/', requireRole('ADMIN'), listBranches)

export default router
