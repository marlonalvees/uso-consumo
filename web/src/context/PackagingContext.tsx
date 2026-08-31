import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Packaging } from '../types'
import { useAuth } from './AuthContext'

interface PackagingContextValue {
  packagingList: Packaging[]
  loadingPackaging: boolean
  refreshPackaging: () => Promise<void>
}

const PackagingContext = createContext<PackagingContextValue | undefined>(undefined)

export function PackagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [packagingList, setPackagingList] = useState<Packaging[]>([])
  const [loadingPackaging, setLoadingPackaging] = useState(true)

  const refreshPackaging = useCallback(async () => {
    if (!user) {
      setPackagingList([])
      return
    }
    try {
      const data = await api.get<Packaging[]>('/packaging')
      setPackagingList(data)
    } catch {
      // mantém a lista já carregada em caso de falha na atualização
    }
  }, [user])

  useEffect(() => {
    refreshPackaging().finally(() => setLoadingPackaging(false))
  }, [refreshPackaging])

  return (
    <PackagingContext.Provider value={{ packagingList, loadingPackaging, refreshPackaging }}>
      {children}
    </PackagingContext.Provider>
  )
}

export function usePackaging() {
  const ctx = useContext(PackagingContext)
  if (!ctx) throw new Error('usePackaging deve ser usado dentro de PackagingProvider')
  return ctx
}
