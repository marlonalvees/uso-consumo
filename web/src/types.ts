export interface BranchRef {
  id: number
  name: string
}

export interface AuthUser {
  id: number
  isAdmin: boolean
  access: string
  branches: BranchRef[]
}

export interface Branch {
  id: number
  name: string
}

export interface Category {
  id: string
  name: string
}

export interface Packaging {
  id: string
  name: string
}

export interface SupplierRef {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
  cnpj: string | null
  phone: string | null
  email: string | null
  active: boolean
}

export interface Item {
  id: string
  name: string
  photoPath: string | null
  packaging: Packaging
  packagingId: string
  price: number
  category: Category
  categoryId: string
  supplier: SupplierRef | null
  supplierId: string | null
  active: boolean
  stockQuantity: number
  minStock: number
  targetStock: number | null
}

export type OrderStatus = 'RECEBIDO' | 'EM_ANDAMENTO' | 'ENVIADO' | 'ENTREGUE'

export interface OrderItem {
  id: string
  itemId: string
  requestedQuantity: number
  quantity: number
  item: Item
}

export interface OrderExtraItem {
  id: string
  name: string
  requestedQuantity: number
  quantity: number
}

export interface Order {
  id: string
  branchId: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  branch: { id: number; name: string }
  requestedBy: { id: number; name: string }
  items: OrderItem[]
  extraItems: OrderExtraItem[]
}

export interface Purchase {
  id: string
  supplierId: string
  supplier: Supplier
  notes: string | null
  invoicePath: string | null
  createdAt: string
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  itemId: string
  item: Item
  quantity: number
  unitCost: number | null
}

export type StockMovementType = 'ENTRADA' | 'SAIDA'

export interface StockMovement {
  id: string
  itemId: string
  item: { id: string; name: string; packaging: Packaging }
  type: StockMovementType
  quantity: number
  reason: string
  purchaseId: string | null
  purchase: (Purchase & { supplier: Supplier }) | null
  orderId: string | null
  order: { id: string; branch: { id: number; name: string } } | null
  createdAt: string
}

export interface PurchaseRecommendation {
  item: Item
  recommendedQuantity: number
}
