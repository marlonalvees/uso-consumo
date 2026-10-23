type Cell = string | number | null | undefined

function formatCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  // Excel em português usa vírgula decimal e ponto-e-vírgula como separador
  const text = typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false }) : value
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Baixa um CSV que o Excel abre direto, com acentos (BOM UTF-8). */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((row) => row.map(formatCell).join(';'))
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
