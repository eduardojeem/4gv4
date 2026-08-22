import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

// Acento de borde/ícono alineado al lenguaje del dashboard admin (border-l-4 + color -500).
const toneBorderMap: Record<Tone, string> = {
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
  info: 'border-l-blue-500',
  neutral: 'border-l-slate-400',
}

const toneIconMap: Record<Tone, string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
  info: 'text-blue-500',
  neutral: 'text-slate-400',
}

const toneTextMap: Record<Tone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-gray-900 dark:text-gray-50',
}

const insightDotMap: Record<Tone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
}

export function DeltaBadge({
  value,
  className,
}: {
  value: number | null
  className?: string
}) {
  if (value === null || Number.isNaN(value)) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-[11px]', className)}>
        <ArrowRight className="h-3.5 w-3.5" />
        Sin base
      </Badge>
    )
  }

  const positive = value >= 0
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-[11px]',
        positive
          ? 'border-emerald-200 text-emerald-600 dark:border-emerald-900 dark:text-emerald-400'
          : 'border-red-200 text-red-600 dark:border-red-900 dark:text-red-400',
        className
      )}
    >
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {positive ? '+' : ''}
      {value.toFixed(1)}%
    </Badge>
  )
}

export function MetricCard({
  title,
  value,
  helper,
  delta,
  tone = 'neutral',
  icon: Icon,
}: {
  title: string
  value: string
  helper: string
  delta: number | null
  tone?: Tone
  icon: LucideIcon
}) {
  return (
    <Card className={cn('border border-gray-200 dark:border-slate-800 border-l-4 shadow-sm', toneBorderMap[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <Icon className={cn('h-5 w-5 shrink-0', toneIconMap[tone])} />
        </div>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{helper}</p>
          <DeltaBadge value={delta} />
        </div>
      </CardContent>
    </Card>
  )
}

export function MiniStat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string
  value: string
  tone?: Tone
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-slate-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-base font-semibold', toneTextMap[tone])}>
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-tight text-gray-400 dark:text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function SectionFrame({
  title,
  description,
  action,
  badge,
  className,
  contentClassName,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  badge?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('border border-gray-200 dark:border-slate-800 shadow-sm', className)}>
      <CardHeader className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {badge}
          <div>
            <CardTitle className="text-base text-gray-900 dark:text-gray-50">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              {description}
            </CardDescription>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn('p-6', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

export function InsightItem({
  title,
  description,
  context,
  tone,
}: {
  title: string
  description: string
  context: string
  tone: Tone
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className={cn('h-2.5 w-2.5 rounded-full', insightDotMap[tone])} />
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
      <p className="mt-3 text-xs font-medium text-gray-400 dark:text-gray-500">{context}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-6 py-10 text-center dark:border-slate-800">
      <p className="text-base font-semibold text-gray-900 dark:text-gray-50">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  )
}

export function AnalyticsLoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-6 shadow-sm dark:border-slate-800">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-10 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-[420px] rounded-lg xl:col-span-8" />
        <Skeleton className="h-[420px] rounded-lg xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-lg xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-lg xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-lg xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-lg xl:col-span-6" />
        <Skeleton className="h-[360px] rounded-lg xl:col-span-6" />
        <Skeleton className="h-[420px] rounded-lg xl:col-span-12" />
      </div>
    </div>
  )
}
