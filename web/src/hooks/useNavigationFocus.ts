import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const FOCUS_DURATION_MS = 3000

// Destaque temporário pedido por quem navegou até a página: a barra de status do topo manda
// `{ focusStatus }` ou `{ focusOrderId }` no state da navegação. Devolve esse valor por alguns
// segundos e depois null; cada navegação nova (location.key) recomeça a contagem.
export function useNavigationFocus<T>(stateKey: string): T | null {
  const location = useLocation()
  const [expiredKey, setExpiredKey] = useState<string | null>(null)

  const value =
    expiredKey === location.key
      ? null
      : ((location.state as Record<string, T | undefined> | null)?.[stateKey] ?? null)

  useEffect(() => {
    if (value === null) return
    const timer = setTimeout(() => setExpiredKey(location.key), FOCUS_DURATION_MS)
    return () => clearTimeout(timer)
  }, [value, location.key])

  return value
}
