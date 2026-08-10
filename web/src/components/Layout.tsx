import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePendingOrders } from '../context/PendingOrdersContext'
import Logo from './Logo'

export default function Layout() {
  const { user, logout } = useAuth()
  const { pendingCount } = usePendingOrders()
  const navigate = useNavigate()

  const links =
    user?.role === 'ADMIN'
      ? [{ to: '/dashboard', label: 'Dashboard', badge: 0 }]
      : [
          { to: '/pedidos/novo', label: 'Novo pedido', badge: 0 },
          { to: '/pedidos', label: 'Meus pedidos', badge: pendingCount },
        ]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo className="text-xl" />
            <span className="hidden font-semibold text-gray-900 sm:inline">Uso e Consumo</span>
          </div>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-gray-500">{user.name}</span>}
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-gray-600 hover:text-novamix-orange"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
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
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
