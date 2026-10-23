import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import MobileTopBar from './MobileTopBar'
import ConfirmDialog from './ConfirmDialog'
import OrderStatusBanner from './OrderStatusBanner'
import NewOrderAlerts from './NewOrderAlerts'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'

/** Filial: lembra uma vez por visita de confirmar o recebimento de um pedido já enviado. */
function ReceiptReminder() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeOrders, loadingOrders } = useOrders()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const awaiting = activeOrders.find((o) => o.status === 'ENVIADO')
  // no Acompanhar o botão de confirmar já está na tela
  const onTrackingPage = location.pathname === '/acompanhar'

  useEffect(() => {
    if (!loadingOrders && awaiting && !shown && !onTrackingPage) {
      setOpen(true)
      setShown(true)
    }
  }, [loadingOrders, awaiting, shown, onTrackingPage])

  return (
    <ConfirmDialog
      open={open}
      title="Seu pedido chegou?"
      message={
        <>
          O pedido da filial <strong>{awaiting?.branch.name}</strong> já saiu da central. Quando chegar, confirme o
          recebimento e conte se faltou ou veio avariado algum item.
        </>
      }
      confirmLabel="Confirmar recebimento"
      cancelLabel="Agora não"
      onConfirm={() => {
        setOpen(false)
        navigate('/acompanhar', { state: { focusOrderId: awaiting?.id, openReceipt: true } })
      }}
      onCancel={() => setOpen(false)}
    />
  )
}

export default function Layout() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh bg-gray">
      <Sidebar />
      <MobileTopBar />
      <main className="lg:ml-64">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-6 lg:px-8 lg:pt-8 print:max-w-none print:p-0">
          <OrderStatusBanner />
          <Outlet />
        </div>
        <footer className="px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-center text-xs text-gray-500 print:hidden lg:pb-6">
          Desenvolvido por{' '}
          <a
            href="https://www.marlonalves.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-600 transition hover:text-orange-base"
          >
            Marlon Alves
          </a>{' '}
          e{' '}
          <a
            href="https://www.mthcode.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-600 transition hover:text-orange-base"
          >
            MTHCODE
          </a>
        </footer>
      </main>
      <BottomNav />
      {user?.isAdmin ? <NewOrderAlerts /> : <ReceiptReminder />}
    </div>
  )
}
