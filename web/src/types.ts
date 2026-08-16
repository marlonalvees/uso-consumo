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

export type ItemCategory = 'PAPELARIA' | 'LIMPEZA'

export interface Item {
  id: string
  name: string
  unit: string
  category: ItemCategory
  active: boolean
}

export type OrderStatus =
  | 'PENDENTE'
  | 'EM_SEPARACAO'
  | 'AGUARDANDO_ENVIO'
  | 'ENVIADO'
  | 'ENTREGUE'

export interface OrderItem {
  id: string
  itemId: string
  quantity: number
  item: Item
}

export interface OrderExtraItem {
  id: string
  name: string
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
