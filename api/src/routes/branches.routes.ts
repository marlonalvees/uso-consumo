import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listBranches,
  getBranchesOverview,
  getBranchPars,
  setBranchPars,
  setBranchBudget,
  getBranchSummary,
} from '../controllers/branches.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', requireAdmin, listBranches)
router.get('/overview', requireAdmin, getBranchesOverview)
router.get('/:id/pars', getBranchPars)
router.put('/:id/pars', requireAdmin, setBranchPars)
router.put('/:id/budget', requireAdmin, setBranchBudget)
router.get('/:id/summary', getBranchSummary)

export default router
