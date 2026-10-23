import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNavBadges } from '../hooks/useNavBadges'
import { ADMIN_NAV, SUPERVISOR_NAV } from '../lib/navigation'
import { firstName } from '../lib/format'
import Logo from './Logo'
import PushToggle from './PushToggle'
import { LogOutIcon } from './icons'

/** Menu lateral do computador (no celular quem navega é a barra de baixo). */
export default function Sidebar() {
  const { user } = useAuth()
  const badges = useNavBadges()
  const links = user?.isAdmin ? ADMIN_NAV : SUPERVISOR_NAV

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-white shadow-card print:hidden lg:flex">
      <Logo compact />

      <div className="mx-4 mb-4 rounded-2xl bg-gray px-3 py-2.5">
        <p className="text-xs font-semibold text-gray-500">{user?.isAdmin ? 'Central' : 'Supervisor'}</p>
        <p className="truncate text-sm font-extrabold text-gray-900">Olá, {firstName(user?.name) || 'tudo bem?'}</p>
        {!user?.isAdmin && user?.branches.length ? (
          <p className="truncate text-xs text-gray-500">{user.branches.map((b) => b.name).join(', ')}</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {links.map((link) => {
          const count = link.badge ? badges[link.badge] : 0
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `press group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  isActive ? 'bg-orange-base text-white shadow-sm' : 'text-gray-700 hover:bg-orange-base/10 hover:text-orange-base'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
                  <span className="flex-1">{link.label}</span>
                  {count > 0 && (
                    <span
                      className={`flex h-5 min-w-5 animate-pop items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold ${
                        isActive ? 'bg-white text-orange-base' : 'bg-red-base text-white'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="space-y-2 p-3">
        <PushToggle />
        <a
          href={import.meta.env.VITE_HUB_URL}
          className="press flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        >
          <LogOutIcon className="h-4 w-4" />
          Voltar ao hub
        </a>
      </div>
    </aside>
  )
}
