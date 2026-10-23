import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNavBadges } from '../hooks/useNavBadges'
import { ADMIN_NAV, SUPERVISOR_NAV } from '../lib/navigation'
import Sheet from './ui/Sheet'
import PushToggle from './PushToggle'
import { ChevronRightIcon, LogOutIcon, MoreIcon } from './icons'

/** Barra de navegação fixa no pé da tela do celular, como a do app do iFood. */
export default function BottomNav() {
  const { user } = useAuth()
  const badges = useNavBadges()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const links = user?.isAdmin ? ADMIN_NAV : SUPERVISOR_NAV
  const primary = links.filter((link) => link.primary)
  const secondary = links.filter((link) => !link.primary)
  const moreActive = secondary.some((link) => location.pathname.startsWith(link.to))

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(16_24_40/0.06)] backdrop-blur print:hidden lg:hidden">
        <ul className="mx-auto flex max-w-lg">
          {primary.map((link) => {
            const count = link.badge ? badges[link.badge] : 0
            return (
              <li key={link.to} className="flex-1">
                <NavLink
                  to={link.to}
                  end
                  className={({ isActive }) =>
                    `press relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-bold transition-colors ${
                      isActive ? 'text-orange-base' : 'text-gray-500'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-orange-base" />}
                      <span className="relative">
                        <link.icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 1.9} />
                        {count > 0 && (
                          <span className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-red-base px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                            {count}
                          </span>
                        )}
                      </span>
                      {link.label}
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
          {secondary.length > 0 && (
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={`press relative flex w-full flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-bold ${
                  moreActive ? 'text-orange-base' : 'text-gray-500'
                }`}
              >
                {moreActive && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-orange-base" />}
                <MoreIcon className="h-6 w-6" />
                Mais
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <ul className="mb-4 space-y-2">
          {secondary.map((link) => (
            <li key={link.to}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  navigate(link.to)
                }}
                className="press flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-3 text-left shadow-card"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-base/10 text-orange-base">
                  <link.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm font-bold text-gray-900">{link.label}</span>
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <PushToggle />
          <a
            href={import.meta.env.VITE_HUB_URL}
            className="press flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
          >
            <LogOutIcon className="h-4 w-4" />
            Voltar ao hub
          </a>
        </div>
      </Sheet>
    </>
  )
}
