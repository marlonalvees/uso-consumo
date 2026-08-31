import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', listCategories)
router.post('/', requireAdmin, createCategory)
router.patch('/:id', requireAdmin, updateCategory)
router.delete('/:id', requireAdmin, deleteCategory)

export default router
