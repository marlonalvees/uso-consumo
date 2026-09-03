import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import ConfirmDialog from './ConfirmDialog'
import { useOrders } from '../context/OrdersContext'

export default function Layout() {
  const navigate = useNavigate()
  const { myActiveOrder, loadingOrders } = useOrders()
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertShown, setAlertShown] = useState(false)

  const awaitingConfirmation = myActiveOrder?.status === 'ENVIADO'

  useEffect(() => {
    if (!loadingOrders && awaitingConfirmation && !alertShown) {
      setAlertOpen(true)
      setAlertShown(true)
    }
  }, [loadingOrders, awaitingConfirmation, alertShown])

  return (
    <div className="flex w-full min-h-screen bg-gray">
      <Sidebar />
      <main className="flex flex-1 min-w-0 flex-col lg:ml-64">
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:pt-6 lg:pb-6 print:max-w-none print:p-0">
          <Outlet />
        </div>
        <footer className="border-t border-gray-200 px-4 py-4 text-center text-xs text-gray-500 print:hidden">
          Desenvolvido por{' '}
          <a
            href="https://www.marlonalves.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-600 transition hover:text-novamix-teal"
          >
            Marlon Alves
          </a>{' '}
          e{' '}
          <a
            href="https://www.mthcode.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-600 transition hover:text-novamix-teal"
          >
            MTHCODE
          </a>
        </footer>
      </main>

      <ConfirmDialog
        open={alertOpen}
        title="Pedido aguardando confirmação"
        message={
          <>
            O pedido da filial <strong>{myActiveOrder?.branch.name}</strong> já foi enviado e está
            aguardando a confirmação de recebimento. Confirme o recebimento antes de fazer um novo
            pedido.
          </>
        }
        confirmLabel="Ver meus pedidos"
        cancelLabel="Fechar"
        onConfirm={() => {
          setAlertOpen(false)
          navigate('/pedidos', { state: { tab: 'meus' } })
        }}
        onCancel={() => setAlertOpen(false)}
      />
    </div>
  )
}
