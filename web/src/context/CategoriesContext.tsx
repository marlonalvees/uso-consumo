import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Category } from '../types'
import { useAuth } from './AuthContext'

interface CategoriesContextValue {
  categories: Category[]
  loadingCategories: boolean
  refreshCategories: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const refreshCategories = useCallback(async () => {
    if (!user) {
      setCategories([])
      return
    }
    try {
      const data = await api.get<Category[]>('/categories')
      setCategories(data)
    } catch {
      // mantém as categorias já carregadas em caso de falha na atualização
    }
  }, [user])

  useEffect(() => {
    refreshCategories().finally(() => setLoadingCategories(false))
  }, [refreshCategories])

  return (
    <CategoriesContext.Provider value={{ categories, loadingCategories, refreshCategories }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories deve ser usado dentro de CategoriesProvider')
  return ctx
}
