import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listPurchases,
  createPurchase,
  getPurchaseRecommendations,
} from '../controllers/purchases.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/', listPurchases)
router.post('/', createPurchase)
router.get('/recommendations', getPurchaseRecommendations)

export default router
