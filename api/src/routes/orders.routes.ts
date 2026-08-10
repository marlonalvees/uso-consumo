import { Router } from 'express'
import { requireAuth, requireRole } from '../middlewares/auth'
import {
  createOrder,
  listOrders,
  updateOrderStatus,
  confirmDelivery,
} from '../controllers/orders.controller'

const router = Router()

router.use(requireAuth)

router.post('/', requireRole('FILIAL'), createOrder)
router.get('/', listOrders)
router.patch('/:id/status', requireRole('ADMIN'), updateOrderStatus)
router.patch('/:id/confirm-delivery', requireRole('FILIAL'), confirmDelivery)

export default router
