import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/suppliers.controller'

const router = Router()

router.use(requireAuth, requireModule, requireAdmin)

router.get('/', listSuppliers)
router.post('/', createSupplier)
router.patch('/:id', updateSupplier)
router.delete('/:id', deleteSupplier)

export default router
