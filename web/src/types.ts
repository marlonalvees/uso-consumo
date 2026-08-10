export type Role = 'ADMIN' | 'FILIAL'

export interface AuthUser {
  id: string
  role: Role
  name: string
}

export interface Branch {
  id: string
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
  branchId: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  branch: { id: string; name: string }
  items: OrderItem[]
  extraItems: OrderExtraItem[]
}
