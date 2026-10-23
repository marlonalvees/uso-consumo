import { useAuth } from '../context/AuthContext'
import { firstName } from '../lib/format'
import logoNm from '../assets/logos/logo-nm.jpeg'

/** Topo do celular: logo e saudação (a navegação fica na barra de baixo). */
export default function MobileTopBar() {
  const { user } = useAuth()
  const subtitle = user?.isAdmin ? 'Central de uso e consumo' : user?.branches.map((b) => b.name).join(', ')

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden lg:hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <img src={logoNm} alt="Novamix" className="h-9 w-9 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-gray-900">Olá, {firstName(user?.name) || 'tudo bem?'}</p>
          {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
