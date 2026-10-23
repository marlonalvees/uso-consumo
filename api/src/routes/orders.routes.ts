import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin, requireBranches } from '../middlewares/auth'
import {
  createOrder,
  listOrders,
  listOrderEvents,
  updateOrderStatus,
  updateOrderFulfillment,
  updateOwnOrder,
  cancelOrder,
  confirmDelivery,
  uploadOrderReceiptPhoto,
  listPendingItems,
  dismissPendingItems,
  convertExtraItem,
} from '../controllers/orders.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.post('/', requireBranches, createOrder)
router.get('/', listOrders)
router.get('/pending-items', listPendingItems)
router.post('/pending-items/dismiss', requireBranches, dismissPendingItems)
router.get('/:id/events', listOrderEvents)
router.patch('/:id/status', requireAdmin, updateOrderStatus)
router.patch('/:id/fulfillment', requireAdmin, updateOrderFulfillment)
router.patch('/:id/edit', requireBranches, updateOwnOrder)
router.post('/:id/cancel', requireBranches, cancelOrder)
router.patch('/:id/confirm-delivery', requireBranches, confirmDelivery)
router.post('/:id/receipt-photo', requireBranches, uploadOrderReceiptPhoto)
router.post('/:id/extras/:extraId/convert', requireAdmin, convertExtraItem)

export default router
