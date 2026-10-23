import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Branch } from '../types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { SkeletonCards } from '../components/ui/Skeleton'
import FazerPedido from './FazerPedido'

/** Filial: a "loja" de itens. Central: pedido em nome de qualquer filial. */
export default function Pedidos() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.isAdmin ?? false
  const [branches, setBranches] = useState<Branch[] | null>(isAdmin ? null : (user?.branches ?? []))

  useEffect(() => {
    if (!isAdmin) return
    api
      .get<Branch[]>('/branches')
      .then(setBranches)
      .catch(() => {
        setBranches([])
        toast.error('Não foi possível carregar as filiais')
      })
  }, [isAdmin, toast])

  if (branches === null) return <SkeletonCards count={4} />
  return <FazerPedido branches={branches} asAdmin={isAdmin} />
}
