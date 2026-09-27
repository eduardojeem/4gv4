import { getDisplayLocale } from '@/lib/currency'

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateOnlyLocal(value: string | number | Date): Date {
  if (value instanceof Date) {
    return new Date(value)
  }

  if (typeof value === 'string') {
    const match = DATE_ONLY_RE.exec(value)
    if (match) {
      const [, year, month, day] = match
      return new Date(Number(year), Number(month) - 1, Number(day))
    }
  }

  return new Date(value)
}

export function startOfLocalDay(value: string | number | Date): Date {
  const date = parseDateOnlyLocal(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfLocalDay(value: string | number | Date): Date {
  const date = parseDateOnlyLocal(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function isSameLocalDate(a: string | number | Date, b: string | number | Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime()
}

export function formatDateInputLocal(value: string | number | Date = new Date()): string {
  const date = parseDateOnlyLocal(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateOnlyDisplay(
  value: string | number | Date,
  // Por defecto, el idioma configurado en la plataforma. Antes era 'es-AR' fijo.
  locale = getDisplayLocale(),
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  return parseDateOnlyLocal(value).toLocaleDateString(locale, options)
}
