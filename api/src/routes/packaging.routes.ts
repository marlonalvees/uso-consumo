import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listPackaging,
  createPackaging,
  updatePackaging,
  deletePackaging,
} from '../controllers/packaging.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', listPackaging)
router.post('/', requireAdmin, createPackaging)
router.patch('/:id', requireAdmin, updatePackaging)
router.delete('/:id', requireAdmin, deletePackaging)

export default router
