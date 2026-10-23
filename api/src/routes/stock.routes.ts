import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import { listStockMovements, createStockCount, createStockAdjustmentBatch } from '../controllers/stock.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/movements', listStockMovements)
router.post('/counts', createStockCount)
router.post('/adjustments/batch', createStockAdjustmentBatch)

export default router
