'use client'

import Link from 'next/link'
import { Clock, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

type Variant = 'sidebar' | 'header'

export function SubscriptionChip({ variant = 'header' }: { variant?: Variant }) {
  const { status, isBlocked, isTrialing, trialDaysLeft, periodDaysLeft } = useSubscriptionStatus()

  if (!status) return null

  const isSidebar = variant === 'sidebar'

  if (isBlocked) {
    return (
      <Link
        href="/admin/subscriptions"
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400',
          isSidebar ? 'px-3 py-1.5 text-xs font-medium w-full justify-center' : 'px-2.5 py-1 text-xs font-medium'
        )}
      >
        <XCircle className="h-3.5 w-3.5 flex-none" />
        {isSidebar ? 'Suscripción vencida' : 'Vencida'}
      </Link>
    )
  }

  if (isTrialing) {
    const urgent = trialDaysLeft !== null && trialDaysLeft <= 3
    const warning = trialDaysLeft !== null && trialDaysLeft <= 7
    const tone = urgent
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400'
      : warning
      ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-400'
      : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-400'

    const sidebarLabel = trialDaysLeft === null
      ? 'En prueba'
      : trialDaysLeft === 0
      ? 'Prueba: vence hoy'
      : `Prueba: ${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'}`

    const headerLabel = trialDaysLeft === null
      ? 'En prueba'
      : trialDaysLeft === 0
      ? 'Vence hoy'
      : `${trialDaysLeft}d de prueba`

    return (
      <Link
        href="/admin/subscriptions"
        className={cn(
          'flex items-center gap-1.5 rounded-full border transition-colors',
          tone,
          isSidebar ? 'px-3 py-1.5 text-xs font-medium w-full justify-center' : 'px-2.5 py-1 text-xs font-medium'
        )}
      >
        <Clock className="h-3.5 w-3.5 flex-none" />
        {isSidebar ? sidebarLabel : headerLabel}
      </Link>
    )
  }

  if (status === 'active' && periodDaysLeft !== null && periodDaysLeft <= 7) {
    return (
      <Link
        href="/admin/subscriptions"
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-400',
          isSidebar ? 'px-3 py-1.5 text-xs font-medium w-full justify-center' : 'px-2.5 py-1 text-xs font-medium'
        )}
      >
        <Clock className="h-3.5 w-3.5 flex-none" />
        {isSidebar ? `Renueva en ${periodDaysLeft}d` : `${periodDaysLeft}d restantes`}
      </Link>
    )
  }

  if (status === 'active') {
    if (variant === 'header') return null
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 flex-none" />
        Plan activo
      </div>
    )
  }

  return null
}
