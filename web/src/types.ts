export interface BranchRef {
  id: number
  name: string
}

export interface AuthUser {
  id: number
  name: string | null
  isAdmin: boolean
  access: string
  branches: BranchRef[]
}

export interface Branch {
  id: number
  name: string
}

export interface UserRef {
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
  leadTimeDays: number | null
}

export interface Item {
  id: string
  name: string
  photoPath: string | null
  packaging: Packaging
  packagingId: string
  /** custo médio ponderado, atualizado a cada compra recebida */
  price: number
  category: Category
  categoryId: string
  supplier: SupplierRef | null
  supplierId: string | null
  active: boolean
  stockQuantity: number
  minStock: number
  targetStock: number | null
  lastCountedAt: string | null
}

export type OrderStatus = 'RECEBIDO' | 'EM_ANDAMENTO' | 'ENVIADO' | 'ENTREGUE' | 'CANCELADO'

export type ReceiptIssue = 'FALTOU' | 'AVARIADO'

export interface OrderItem {
  id: string
  itemId: string
  requestedQuantity: number
  quantity: number
  unitCost: number | null
  adjustReason: string | null
  receivedQuantity: number | null
  receiptIssue: ReceiptIssue | null
  item: Item
}

export interface OrderExtraItem {
  id: string
  name: string
  requestedQuantity: number
  quantity: number
  adjustReason: string | null
  receivedQuantity: number | null
  receiptIssue: ReceiptIssue | null
}

export interface Order {
  id: string
  branchId: number
  status: OrderStatus
  notes: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  statusChangedAt: string
  sentAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  cancelledBy: UserRef | null
  receiptNotes: string | null
  receiptPhotoPath: string | null
  branch: { id: number; name: string }
  requestedBy: UserRef
  items: OrderItem[]
  extraItems: OrderExtraItem[]
}

export type OrderEventType = 'CRIADO' | 'EDITADO' | 'STATUS' | 'ITENS_AJUSTADOS' | 'CANCELADO' | 'RECEBIDO'

export interface OrderEvent {
  id: string
  orderId: string
  type: OrderEventType
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  note: string | null
  createdAt: string
  user: UserRef | null
}

export interface PendingItem {
  id: string
  orderId: string
  orderCreatedAt: string
  branchId: number
  item: Item
  cutQuantity: number
  missingQuantity: number
  quantity: number
  receiptIssue: ReceiptIssue | null
  adjustReason: string | null
}

export type PurchaseStatus = 'PEDIDO' | 'RECEBIDO' | 'CANCELADO'

export interface Purchase {
  id: string
  supplierId: string
  supplier: Supplier
  status: PurchaseStatus
  notes: string | null
  invoicePath: string | null
  createdAt: string
  receivedAt: string | null
  createdBy: UserRef | null
  receivedBy: UserRef | null
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  itemId: string
  item: Item
  quantity: number
  receivedQuantity: number | null
  unitCost: number | null
}

export interface PurchasesPage {
  purchases: Purchase[]
  nextCursor: string | null
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
  createdBy: UserRef | null
  createdAt: string
  /** saldo do produto depois da movimentação (só na ficha de um produto) */
  balanceAfter: number | null
}

export interface MovementsPage {
  movements: StockMovement[]
  nextCursor: string | null
}

export interface PurchaseRecommendation {
  item: Item & { supplier: Supplier | null }
  recommendedQuantity: number
  onOrderQuantity: number
  avgDailyConsumption: number
}

export type AbcClass = 'A' | 'B' | 'C'

export interface StockSuggestion {
  itemId: string
  avgDailyConsumption: number
  windowDays: number
  leadTimeDays: number
  suggestedMin: number | null
  suggestedTarget: number | null
  abcClass: AbcClass
  lastCountedAt: string | null
}

export interface BranchPar {
  id: string
  branchId: number
  itemId: string
  quantity: number
  item: Item
}

export interface BranchSummary {
  branchId: number
  monthConsumption: number
  lastMonthsAverage: number
  monthlyBudget: number | null
  pendingCount: number
}

export interface BranchOverview {
  id: number
  name: string
  monthConsumption: number
  lastMonthsAverage: number
  monthlyBudget: number | null
  pendingCount: number
  parCount: number
  openOrders: OrderStatus[]
}

export interface ConsumptionReport {
  months: string[]
  rows: {
    branchId: number
    branchName: string
    values: Record<string, number>
    total: number
    previousAverage: number
    aboveAverage: boolean
  }[]
}

export interface ServiceTimeReport {
  months: number
  rows: { branchId: number; branchName: string; orders: number; avgHoursToShip: number | null; avgHoursToConfirm: number | null }[]
  overall: { orders: number; avgHoursToShip: number | null; avgHoursToConfirm: number | null }
}

export interface ExtrasReport {
  months: number
  rows: { name: string; timesRequested: number; totalQuantity: number; branches: number; lastRequestedAt: string }[]
}

export interface IdleItemsReport {
  days: number
  rows: { item: Item; lastOutAt: string | null; stockValue: number }[]
}

export interface DivergencesReport {
  months: number
  rows: {
    orderId: string
    branch: BranchRef
    deliveredAt: string
    receiptNotes: string | null
    receiptPhotoPath: string | null
    issues: { name: string; sent: number; received: number | null; issue: ReceiptIssue | null }[]
  }[]
}
