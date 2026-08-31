import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import { listStockMovements, createStockAdjustment } from '../controllers/stock.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/movements', listStockMovements)
router.post('/adjustments', createStockAdjustment)

export default router
