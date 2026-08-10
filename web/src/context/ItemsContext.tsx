import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { Item } from '../types'
import { useAuth } from './AuthContext'

interface ItemsContextValue {
  items: Item[]
  loadingItems: boolean
}

const ItemsContext = createContext<ItemsContextValue | undefined>(undefined)

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  useEffect(() => {
    if (!user) {
      setItems([])
      setLoadingItems(false)
      return
    }
    api
      .get<Item[]>('/items')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoadingItems(false))
  }, [user])

  return (
    <ItemsContext.Provider value={{ items, loadingItems }}>{children}</ItemsContext.Provider>
  )
}

export function useItems() {
  const ctx = useContext(ItemsContext)
  if (!ctx) throw new Error('useItems deve ser usado dentro de ItemsProvider')
  return ctx
}
