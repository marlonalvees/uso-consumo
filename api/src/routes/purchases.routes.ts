import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listPurchases,
  createPurchase,
  receivePurchase,
  cancelPurchase,
  getPurchaseRecommendations,
  uploadPurchaseInvoice,
  removePurchaseInvoice,
} from '../controllers/purchases.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/', listPurchases)
router.post('/', createPurchase)
router.get('/recommendations', getPurchaseRecommendations)
router.post('/:id/receive', receivePurchase)
router.post('/:id/cancel', cancelPurchase)
router.post('/:id/invoice', uploadPurchaseInvoice)
router.delete('/:id/invoice', removePurchaseInvoice)

export default router
