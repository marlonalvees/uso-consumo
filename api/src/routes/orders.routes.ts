import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin, requireBranches } from '../middlewares/auth'
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  updateOrderFulfillment,
  updateOwnOrder,
  confirmDelivery,
} from '../controllers/orders.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.post('/', requireBranches, createOrder)
router.get('/', listOrders)
router.patch('/:id/status', requireAdmin, updateOrderStatus)
router.patch('/:id/fulfillment', requireAdmin, updateOrderFulfillment)
router.patch('/:id/edit', requireBranches, updateOwnOrder)
router.patch('/:id/confirm-delivery', requireBranches, confirmDelivery)

export default router
