import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { HealthCategory, HealthSeverity, HealthStatus } from '@/lib/health/types'

export const STATUS_META: Record<HealthStatus, { label: string; icon: LucideIcon; badge: string; text: string; dot: string }> = {
  healthy: {
    label: 'Correcto',
    icon: CheckCircle2,
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    label: 'Advertencia',
    icon: AlertTriangle,
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  not_configured: {
    label: 'No configurado',
    icon: MinusCircle,
    badge: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  unknown: {
    label: 'No disponible',
    icon: CircleHelp,
    badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300',
    text: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-400',
  },
}

export const SEVERITY_META: Record<HealthSeverity, { label: string; badge: string }> = {
  critical: { label: 'CRITICAL', badge: 'border-red-300 bg-red-600 text-white dark:border-red-800' },
  high: { label: 'HIGH', badge: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300' },
  medium: { label: 'MEDIUM', badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300' },
  low: { label: 'LOW', badge: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  info: { label: 'INFO', badge: 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400' },
}

export const CATEGORY_LABEL: Record<HealthCategory, string> = {
  legal: 'Legal',
  security: 'Seguridad',
  seo: 'SEO',
  performance: 'Rendimiento',
  ux: 'Responsive y UX',
  supabase: 'Supabase',
  tenancy: 'Multi-tenant',
  storage: 'Storage',
  auth: 'Autenticación',
  payments: 'Pagos',
  webhooks: 'Webhooks',
  analytics: 'Analytics',
  cloudflare: 'Cloudflare',
  deployment: 'Deployment',
}

export const CATEGORY_ORDER: HealthCategory[] = [
  'tenancy', 'security', 'auth', 'supabase', 'storage', 'payments', 'webhooks',
  'legal', 'seo', 'performance', 'ux', 'analytics', 'cloudflare', 'deployment',
]

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
