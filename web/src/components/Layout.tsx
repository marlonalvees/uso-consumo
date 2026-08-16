import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import Logo from './Logo'

export default function Layout() {
  const { user } = useAuth()
  const { pendingCount } = useOrders()

  const links = user?.isAdmin
    ? [
        { to: '/dashboard', label: 'Dashboard', badge: 0 },
        { to: '/produtos', label: 'Produtos', badge: 0 },
        { to: '/filiais', label: 'Visão da filial', badge: 0 },
        { to: '/pedidos/novo', label: 'Novo pedido', badge: 0 },
        { to: '/pedidos', label: 'Meus pedidos', badge: 0 },
      ]
    : [
        { to: '/pedidos/novo', label: 'Novo pedido', badge: 0 },
        { to: '/pedidos', label: 'Meus pedidos', badge: pendingCount },
      ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full bg-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Logo />
          <nav className="flex flex-1 flex-wrap items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-novamix-teal/10 text-novamix-teal'
                      : 'text-gray-600 hover:text-gray-900'
                  }`
                }
              >
                {link.label}
                {link.badge > 0 && (
                  <span className="flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-novamix-orange px-1 text-xs font-semibold text-white">
                    {link.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {user && user.branches.length > 0 && (
              <span className="hidden text-sm text-gray-500 sm:inline">
                {user.branches.map((b) => b.name).join(', ')}
              </span>
            )}
            <a
              href={import.meta.env.VITE_HUB_URL}
              className="text-sm font-medium text-gray-600 transition hover:text-novamix-orange"
            >
              ← Voltar ao hub
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 print:max-w-none print:p-0">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 px-4 py-4 text-center text-xs text-gray-500 print:hidden">
        <a
          href="https://www.marlonalves.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-novamix-teal"
        >
          Desenvolvido por Marlon Alves
        </a>
        {' e '}
        <a
          href="https://www.mthcode.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-novamix-teal"
        >
          MTHCODE
        </a>
      </footer>
    </div>
  )
}
