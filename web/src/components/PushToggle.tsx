import { useEffect, useState } from 'react'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'
import { useToast } from '../context/ToastContext'
import { BellIcon, BellOffIcon } from './icons'

const DESCRIPTIONS: Record<PushState, string> = {
  on: 'Ativadas neste aparelho',
  off: 'Receba avisos mesmo com o app fechado',
  denied: 'Bloqueadas nas configurações do navegador',
  unavailable: 'Ainda não configuradas no servidor',
  unsupported: 'No iPhone, adicione o app à tela inicial primeiro',
}

/** Liga/desliga as notificações push deste aparelho. */
export default function PushToggle({ variant = 'row' }: { variant?: 'row' | 'dark' }) {
  const toast = useToast()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPushState().then(setState)
  }, [])

  if (state === null) return null

  async function toggle() {
    setBusy(true)
    try {
      const next = state === 'on' ? await disablePush() : await enablePush()
      setState(next)
      if (next === 'on') toast.success('Notificações ativadas neste aparelho')
      else if (next === 'denied') toast.error('O navegador bloqueou as notificações')
    } catch {
      toast.error('Não foi possível ativar as notificações')
    } finally {
      setBusy(false)
    }
  }

  const actionable = state === 'on' || state === 'off'
  const Icon = state === 'on' ? BellIcon : BellOffIcon
  const dark = variant === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!actionable || busy}
      className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
        dark ? 'hover:bg-white/10' : 'bg-white shadow-card hover:bg-gray-50'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          state === 'on' ? 'bg-emerald-500 text-white' : dark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-600'
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
          Notificações {state === 'on' ? 'ligadas' : 'desligadas'}
        </span>
        <span className={`block text-xs ${dark ? 'text-white/60' : 'text-gray-500'}`}>{DESCRIPTIONS[state]}</span>
      </span>
      {actionable && (
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${state === 'on' ? 'bg-emerald-500' : 'bg-gray-300'}`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${state === 'on' ? 'left-5.5' : 'left-0.5'}`}
          />
        </span>
      )}
    </button>
  )
}
