import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrdersContext'
import Logo from './Logo'
import { CloseIcon, LogOutIcon, MenuIcon } from './icons'

const linkBaseClass =
  'relative block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors'
const linkActiveClass = 'bg-orange-base text-white'
const linkInactiveClass = 'text-gray-text hover:bg-orange-base/10 hover:text-orange-base'

export default function Sidebar() {
  const { user } = useAuth()
  const { pendingCount } = useOrders()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const originalHtml = document.documentElement.style.overflow
    const originalBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = originalHtml
      document.body.style.overflow = originalBody
    }
  }, [isOpen])

  function fechar() {
    setIsOpen(false)
  }

  const links = user?.isAdmin
    ? [
        { to: '/dashboard', label: 'Dashboard', badge: 0 },
        { to: '/pedidos', label: 'Pedidos', badge: 0 },
        { to: '/administracao', label: 'Administração', badge: 0 },
        { to: '/cadastros', label: 'Cadastros', badge: 0 },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard', badge: 0 },
        { to: '/pedidos', label: 'Pedidos', badge: pendingCount },
      ]

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-[calc(1rem+env(safe-area-inset-left))] z-50 rounded-md bg-orange-base p-2.5 text-white shadow-lg transition-colors hover:bg-orange-light lg:hidden"
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {isOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      <div
        className={`fixed inset-0 z-30 bg-black transition-opacity duration-300 lg:hidden ${
          isOpen ? 'pointer-events-auto opacity-50' : 'pointer-events-none opacity-0'
        }`}
        onClick={fechar}
      />

      <aside
        className={`fixed top-0 left-0 z-40 flex h-dvh w-64 flex-col border-r border-gray-base/30 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-sm transition-transform duration-300 ease-in-out lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Logo compact />

        <nav className="mt-8 flex flex-1 flex-col gap-2 overflow-y-auto px-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              onClick={fechar}
              className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
            >
              {link.label}
              {link.badge > 0 && (
                <span className="absolute top-1/2 right-2 flex h-5 min-w-5 -translate-y-1/2 animate-pulse items-center justify-center rounded-full bg-red-base px-1 text-xs font-semibold text-white">
                  {link.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <a
          href={import.meta.env.VITE_HUB_URL}
          className="mx-4 mb-6 flex items-center justify-center gap-2 rounded-lg bg-red-light px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-base"
        >
          <LogOutIcon className="h-4 w-4" />
          Voltar ao hub
        </a>
      </aside>
    </div>
  )
}
