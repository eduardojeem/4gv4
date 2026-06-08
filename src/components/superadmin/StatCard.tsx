import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

export type StatCardTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: ComponentType<{ className?: string }>
  tone?: StatCardTone
}

const TONES: Record<StatCardTone, string> = {
  default: 'bg-card border',
  success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
  warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
  danger: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
  info: 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
}

const ICON_TONES: Record<StatCardTone, string> = {
  default: 'text-slate-500',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
}

/** Shared superadmin metric card. Presentational (no hooks) — works in server and client components. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border p-5', TONES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('rounded-lg border bg-background p-2', ICON_TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
