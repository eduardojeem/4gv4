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

const toneMap: Record<Tone, string> = {
  success: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  neutral: 'border-border bg-muted/60 text-muted-foreground',
}

const toneTextMap: Record<Tone, string> = {
  success: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
  info: 'text-sky-700 dark:text-sky-300',
  neutral: 'text-foreground',
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
      <Badge variant="outline" className={cn('gap-1 rounded-full px-2.5 py-1 text-[11px]', className)}>
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
        'gap-1 rounded-full px-2.5 py-1 text-[11px]',
        positive
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
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
    <Card className="relative overflow-hidden rounded-[24px] border-border/70 bg-card/95 shadow-sm shadow-black/5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_42%)]" />
      <CardContent className="relative flex h-full flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm backdrop-blur',
              toneMap[tone]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <DeltaBadge value={delta} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

export function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: Tone
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-base font-semibold', toneTextMap[tone])}>
        {value}
      </p>
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
    <Card className={cn('rounded-[28px] border-border/70 bg-card/95 shadow-sm shadow-black/5', className)}>
      <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {badge}
          <div>
            <CardTitle className="text-lg tracking-tight text-foreground">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
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
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className={cn('h-2.5 w-2.5 rounded-full', tone === 'success'
          ? 'bg-emerald-500'
          : tone === 'warning'
            ? 'bg-amber-500'
            : tone === 'danger'
              ? 'bg-rose-500'
              : 'bg-sky-500')} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{context}</p>
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
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-background/40 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export function AnalyticsLoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-border/70 bg-card/95 p-6 shadow-sm shadow-black/5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-10 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-[24px]" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-[420px] rounded-[28px] xl:col-span-8" />
        <Skeleton className="h-[420px] rounded-[28px] xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-[28px] xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-[28px] xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-[28px] xl:col-span-4" />
        <Skeleton className="h-[360px] rounded-[28px] xl:col-span-6" />
        <Skeleton className="h-[360px] rounded-[28px] xl:col-span-6" />
        <Skeleton className="h-[420px] rounded-[28px] xl:col-span-12" />
      </div>
    </div>
  )
}
