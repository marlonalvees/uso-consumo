import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  uploadItemPhoto,
  removeItemPhoto,
  getStockSuggestions,
  updateStockLevels,
} from '../controllers/items.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', listItems)
router.post('/', requireAdmin, createItem)
router.get('/stock-suggestions', requireAdmin, getStockSuggestions)
router.post('/stock-levels', requireAdmin, updateStockLevels)
router.patch('/:id', requireAdmin, updateItem)
router.delete('/:id', requireAdmin, deleteItem)
router.post('/:id/photo', requireAdmin, uploadItemPhoto)
router.delete('/:id/photo', requireAdmin, removeItemPhoto)

export default router
