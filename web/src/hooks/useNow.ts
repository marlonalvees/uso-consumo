import { useEffect, useState } from 'react'

/** Hora atual que se atualiza sozinha: mantém os "há 5 min" corretos sem recarregar a página. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
