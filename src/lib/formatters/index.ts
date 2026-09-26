import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Formateadores de valores
export const formatters = {
  currency: (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return 'Gs 0'
    return `Gs ${value.toLocaleString()}`
  },
  percentage: (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return '0.0%'
    return `${value.toFixed(1)}%`
  },
  number: (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return '0'
    return value.toLocaleString()
  },
  decimal: (value: number | null | undefined, places = 2) => {
    if (value == null || isNaN(value)) return '0.00'
    return value.toFixed(places)
  },
  date: (date: string | Date) => format(new Date(date), 'dd/MM/yyyy', { locale: es }),
  time: (date: string | Date) => format(new Date(date), 'HH:mm', { locale: es }),
  datetime: (date: string | Date) => format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es }),
  compact: (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return '0'
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }
}

function toNumeric(val: unknown): number | null | undefined {
  if (val === null) return null
  if (val === undefined) return undefined
  if (typeof val === 'number') return val
  const parsed = Number(val)
  return isNaN(parsed) ? undefined : parsed
}

export function formatValue(value: unknown, format: keyof typeof formatters): string {
  const num = toNumeric(value)
  switch (format) {
    case 'currency':
      return formatters.currency(num)
    case 'percentage':
      return formatters.percentage(num)
    case 'number':
      return formatters.number(num)
    case 'compact':
      return formatters.compact(num)
    case 'decimal':
      return formatters.decimal(num)
    case 'date':
      return formatters.date(value instanceof Date || typeof value === 'string' ? value : String(value ?? ''))
    case 'time':
      return formatters.time(value instanceof Date || typeof value === 'string' ? value : String(value ?? ''))
    case 'datetime':
      return formatters.datetime(value instanceof Date || typeof value === 'string' ? value : String(value ?? ''))
    default:
      return String(value ?? '')
  }
}

// Configuración de colores para gráficos
export const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  indigo: '#6366F1',
  teal: '#14B8A6',
  gray: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444'
}

export const SEGMENT_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.danger,
  CHART_COLORS.purple,
  CHART_COLORS.pink
]

// Configuración de estados
export const STATUS_CONFIG = {
  customer: {
    active: { 
      bg: 'bg-green-100', 
      text: 'text-green-800', 
      dark: 'dark:bg-green-900 dark:text-green-300',
      color: CHART_COLORS.success
    },
    inactive: { 
      bg: 'bg-gray-100', 
      text: 'text-gray-800', 
      dark: 'dark:bg-gray-900 dark:text-gray-300',
      color: CHART_COLORS.gray
    },
    suspended: { 
      bg: 'bg-red-100', 
      text: 'text-red-800', 
      dark: 'dark:bg-red-900 dark:text-red-300',
      color: CHART_COLORS.error
    },
    vip: { 
      bg: 'bg-purple-100', 
      text: 'text-purple-800', 
      dark: 'dark:bg-purple-900 dark:text-purple-300',
      color: CHART_COLORS.purple
    }
  },
  transaction: {
    completed: { 
      bg: 'bg-green-100', 
      text: 'text-green-800', 
      dark: 'dark:bg-green-900 dark:text-green-300',
      color: CHART_COLORS.success
    },
    pending: { 
      bg: 'bg-yellow-100', 
      text: 'text-yellow-800', 
      dark: 'dark:bg-yellow-900 dark:text-yellow-300',
      color: CHART_COLORS.warning
    },
    cancelled: { 
      bg: 'bg-red-100', 
      text: 'text-red-800', 
      dark: 'dark:bg-red-900 dark:text-red-300',
      color: CHART_COLORS.error
    }
  }
}

// Utilidad para obtener configuración de estado
export function getStatusConfig(status: string, variant: 'customer' | 'transaction' = 'customer') {
  return STATUS_CONFIG[variant]?.[status as keyof typeof STATUS_CONFIG[typeof variant]] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    dark: 'dark:bg-gray-900 dark:text-gray-300',
    color: CHART_COLORS.gray
  }
}