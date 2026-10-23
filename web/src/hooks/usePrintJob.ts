import { useCallback, useEffect, useState } from 'react'

/** Imprime o conteúdo que a página renderiza na área de impressão e limpa depois. */
export function usePrintJob<T>() {
  const [job, setJob] = useState<T | null>(null)

  useEffect(() => {
    if (job === null) return
    function handleAfterPrint() {
      setJob(null)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    const frameId = requestAnimationFrame(() => window.print())
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      cancelAnimationFrame(frameId)
    }
  }, [job])

  const print = useCallback((next: T) => setJob(next), [])
  return { job, print }
}
