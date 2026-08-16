import { Router } from 'express'
import { requireAuth, requireModule, requireAdmin } from '../middlewares/auth'
import { listItems, createItem, updateItem, deleteItem } from '../controllers/items.controller'

const router = Router()

router.use(requireAuth, requireModule)

router.get('/', listItems)
router.post('/', requireAdmin, createItem)
router.patch('/:id', requireAdmin, updateItem)
router.delete('/:id', requireAdmin, deleteItem)

export default router
