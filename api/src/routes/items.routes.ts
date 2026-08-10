import { Router } from 'express'
import { requireAuth, requireRole } from '../middlewares/auth'
import { listItems, createItem, updateItem, deleteItem } from '../controllers/items.controller'

const router = Router()

router.use(requireAuth)

router.get('/', listItems)
router.post('/', requireRole('ADMIN'), createItem)
router.patch('/:id', requireRole('ADMIN'), updateItem)
router.delete('/:id', requireRole('ADMIN'), deleteItem)

export default router
