'use client'

import Link from 'next/link'
import { Clock, CreditCard, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

export function SubscriptionBanner() {
  const { isBlocked, isTrialing, trialDaysLeft, status } = useSubscriptionStatus()

  if (isBlocked) {
    return (
      <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
        <XCircle className="h-4 w-4 flex-none text-red-600 dark:text-red-400" />
        <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-300">
          {status === 'suspended'
            ? 'Tu cuenta está suspendida.'
            : 'Tu suscripción venció. Para seguir usando todas las funciones, activá un plan.'}
        </p>
        <Button asChild size="sm" className="flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white">
          <Link href="/admin/subscriptions">
            <CreditCard className="h-3.5 w-3.5" />
            Activar plan
          </Link>
        </Button>
      </div>
    )
  }

  if (isTrialing) {
    const urgent = trialDaysLeft !== null && trialDaysLeft <= 3
    const warning = trialDaysLeft === null || trialDaysLeft <= 7
    if (!warning) return null

    return (
      <div className={cn(
        'flex items-center gap-3 border-b px-4 py-3',
        urgent
          ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
          : 'border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/20'
      )}>
        <Clock className={cn('h-4 w-4 flex-none', urgent ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')} />
        <p className={cn('flex-1 text-sm font-medium', urgent ? 'text-red-800 dark:text-red-300' : 'text-orange-800 dark:text-orange-300')}>
          {trialDaysLeft === null
            ? 'Estás en período de prueba.'
            : trialDaysLeft === 0
            ? 'Tu período de prueba vence hoy.'
            : `Tu período de prueba vence en ${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'}.`}
          {' '}Elegí un plan para no perder el acceso.
        </p>
        <Button asChild size="sm" variant="outline" className="flex-none gap-1.5">
          <Link href="/admin/subscriptions">
            <CreditCard className="h-3.5 w-3.5" />
            Ver planes
          </Link>
        </Button>
      </div>
    )
  }

  return null
}
