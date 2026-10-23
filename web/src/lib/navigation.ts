import type { ComponentType } from 'react'
import {
  BagIcon,
  BuildingIcon,
  CartIcon,
  ChartIcon,
  ClipboardIcon,
  HistoryIcon,
  HomeIcon,
  PlusIcon,
  TagIcon,
  TruckIcon,
  WarehouseIcon,
} from '../components/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  /** aparece na barra de baixo do celular (o resto vai pro "Mais") */
  primary: boolean
  /** contador no ícone: pedidos novos (central) ou em andamento (filial) */
  badge?: 'novos' | 'ativos'
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Início', icon: HomeIcon, primary: true },
  { to: '/gestao', label: 'Pedidos', icon: ClipboardIcon, primary: true, badge: 'novos' },
  { to: '/estoque', label: 'Estoque', icon: WarehouseIcon, primary: true },
  { to: '/compras', label: 'Compras', icon: CartIcon, primary: true },
  { to: '/relatorios', label: 'Relatórios', icon: ChartIcon, primary: false },
  { to: '/cadastros', label: 'Cadastros', icon: TagIcon, primary: false },
  { to: '/pedidos', label: 'Pedido p/ filial', icon: PlusIcon, primary: false },
]

export const SUPERVISOR_NAV: NavItem[] = [
  { to: '/pedidos', label: 'Pedir', icon: BagIcon, primary: true },
  { to: '/acompanhar', label: 'Acompanhar', icon: TruckIcon, primary: true, badge: 'ativos' },
  { to: '/historico', label: 'Histórico', icon: HistoryIcon, primary: true },
  { to: '/filial', label: 'Minha filial', icon: BuildingIcon, primary: true },
]
