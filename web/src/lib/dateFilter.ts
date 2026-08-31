export type DatePreset = 'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'periodo'

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana', label: 'Essa semana' },
  { value: 'mes', label: 'Esse mês' },
  { value: 'periodo', label: 'Período' },
]

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date)
  const day = copy.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diffToMonday)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function matchesDatePreset(
  dateIso: string,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): boolean {
  if (preset === 'todos') return true

  const date = new Date(dateIso)
  const now = new Date()

  if (preset === 'hoje') {
    return startOfDay(date).getTime() === startOfDay(now).getTime()
  }
  if (preset === 'ontem') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return startOfDay(date).getTime() === startOfDay(yesterday).getTime()
  }
  if (preset === 'semana') {
    return date >= startOfWeek(now)
  }
  if (preset === 'mes') {
    return date >= startOfMonth(now)
  }
  if (preset === 'periodo') {
    if (customStart && date < startOfDay(new Date(customStart))) return false
    if (customEnd) {
      const end = new Date(customEnd)
      end.setHours(23, 59, 59, 999)
      if (date > end) return false
    }
    return true
  }
  return true
}
