const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(value: number): string {
  return currency.format(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  return label.replace('.', '')
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias" */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
  return `${(hours / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

/** Código curto do pedido pra falar dele por telefone ("#K7Q2X"). */
export function orderCode(order: { id: string }): string {
  return `#${order.id.slice(-5).toUpperCase()}`
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ''
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
