export type Role = 'ADMIN' | 'FILIAL'

export interface AuthUser {
  id: string
  role: Role
  name: string
}

export interface Item {
  id: string
  name: string
  unit: string
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

export interface Order {
  id: string
  branchId: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  branch: { id: string; name: string }
  items: OrderItem[]
}
