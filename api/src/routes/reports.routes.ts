import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  consumptionReport,
  serviceTimeReport,
  extrasReport,
  idleItemsReport,
  divergencesReport,
} from '../controllers/reports.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/consumption', consumptionReport)
router.get('/service-time', serviceTimeReport)
router.get('/extras', extrasReport)
router.get('/idle-items', idleItemsReport)
router.get('/divergences', divergencesReport)

export default router
