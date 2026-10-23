import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../context/OrdersContext'
import { useToast } from '../context/ToastContext'
import { playNewOrderSound, readSoundEnabled } from '../lib/sound'
import { showLocalNotification } from '../lib/push'

const BASE_TITLE = 'UeC Novamix'

/**
 * Central: quando chega pedido novo toca o "plim", mostra um aviso com atalho pro quadro e,
 * com a aba em segundo plano, dispara uma notificação do navegador. O título da aba mostra
 * quantos pedidos novos estão esperando, como no gestor de pedidos do iFood.
 */
export default function NewOrderAlerts() {
  const { orders, newOrderIds } = useOrders()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (newOrderIds.length === 0) return
    const fresh = orders.filter((o) => newOrderIds.includes(o.id) && o.status === 'RECEBIDO')
    if (fresh.length === 0) return

    if (readSoundEnabled()) playNewOrderSound()
    const message = fresh.length === 1 ? `Novo pedido da filial ${fresh[0].branch.name}` : `${fresh.length} pedidos novos chegaram`
    toast.info(message, {
      action: { label: 'Ver', onClick: () => navigate('/gestao', { state: { focusStatus: 'RECEBIDO' } }) },
    })
    if (document.hidden) showLocalNotification('Novo pedido', message, '/gestao')
    // só reage a pedidos novos; "orders" muda junto com eles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOrderIds])

  const waiting = orders.filter((o) => o.status === 'RECEBIDO').length
  useEffect(() => {
    document.title = waiting ? `(${waiting}) ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [waiting])

  return null
}
