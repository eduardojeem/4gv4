import { formatCurrency } from '@/lib/currency'

export function formatMoney(value: number) {
  return formatCurrency(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '-'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes}m`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days}d`
  return formatDate(value)
}
