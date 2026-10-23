import type { Item } from '../types'

/** No mínimo ou abaixo. Produto sem mínimo definido só entra se o saldo ficou negativo. */
export function isLowStock(item: Pick<Item, 'stockQuantity' | 'minStock'>): boolean {
  return item.minStock > 0 ? item.stockQuantity <= item.minStock : item.stockQuantity < 0
}
