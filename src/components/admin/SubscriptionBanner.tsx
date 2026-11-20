'use client'

import {NONRENEWAL_WARNING} from '@/lib/saas/nonrenewal-policy'

import Link from 'next/link'
import { Clock, CreditCard, Gift, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

export function SubscriptionBanner() {
  const { isBlocked, isTrialing, trialDaysLeft, status, downgradedFromExpiry, moduleTrials, isInternal, viewerIsSuperAdmin } = useSubscriptionStatus()

  // Cuenta interna: activa sin vencimiento ni cobro, no hay nada que pedir.
  if (isInternal) return null

  // El superadmin no paga: ve el estado de la tienda, sin pedido de pago.
  if (viewerIsSuperAdmin) {
    const state = isBlocked
      ? (status === 'suspended' ? 'está suspendida' : status ? 'tiene la suscripción vencida' : 'no tiene suscripción')
      : downgradedFromExpiry
        ? 'pasó al plan FREE por vencimiento'
        : isTrialing && trialDaysLeft !== null && trialDaysLeft <= 7
          ? `está en prueba (${trialDaysLeft === 0 ? 'vence hoy' : `${trialDaysLeft} día${trialDaysLeft === 1 ? '' : 's'}`})`
          : null
    if (!state) return null
    return (
      <div role="status" className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        <ShieldCheck className="h-4 w-4 flex-none text-slate-600 dark:text-slate-400" />
        <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">
          <span className="font-semibold">Vista de superadmin:</span> esta tienda {state}.
          {isBlocked ? ' Las operaciones quedan bloqueadas igual que para el comercio.' : ''}
          {' '}Si es una tienda de la plataforma, marcala como «Cuenta interna».
        </p>
        <Button asChild size="sm" variant="outline" className="flex-none">
          <Link href="/superadmin/organizations">Gestionar</Link>
        </Button>
      </div>
    )
  }

  // Prueba de módulo activa: mostrar contador de días + CTA a upgrade.
  if (moduleTrials.length > 0 && !isBlocked) {
    const soonest = [...moduleTrials].sort((a, b) => a.daysLeft - b.daysLeft)[0]
    const label = moduleTrials.length === 1 ? soonest.module : `${moduleTrials.length} módulos`
    return (
      <div className="flex items-center gap-3 border-b border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/60 dark:bg-violet-950/20">
        <Gift className="h-4 w-4 flex-none text-violet-600 dark:text-violet-400" />
        <p className="flex-1 text-sm font-medium text-violet-800 dark:text-violet-300">
          Estás probando <span className="font-semibold capitalize">{label}</span> — {soonest.daysLeft === 0 ? 'vence hoy' : `${soonest.daysLeft} día${soonest.daysLeft === 1 ? '' : 's'} restante${soonest.daysLeft === 1 ? '' : 's'}`}. Subí de plan para no perder el acceso.
        </p>
        <Button asChild size="sm" className="flex-none gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/admin/subscriptions">
            <CreditCard className="h-3.5 w-3.5" />
            Ver planes
          </Link>
        </Button>
      </div>
    )
  }

  // Baja de cortesía: quedó en FREE por impago. No está bloqueada, pero la invitamos a reactivar.
  if (downgradedFromExpiry && !isBlocked) {
    return (
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
        <CreditCard className="h-4 w-4 flex-none text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-300">
          Tu plan venció y pasaste al plan FREE. Tus datos siguen guardados — reactivá un plan para recuperar todas tus funciones y límites.
        </p>
        <Button asChild size="sm" className="flex-none gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
          <Link href="/admin/subscriptions">
            <CreditCard className="h-3.5 w-3.5" />
            Reactivar plan
          </Link>
        </Button>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20">
        <XCircle className="h-4 w-4 flex-none text-red-600 dark:text-red-400" />
        <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-300">
          {status === 'suspended'
            ? 'Tu plan está suspendido. Renovalo para volver a operar.'
            : 'Tu suscripción venció. Podés consultar tu cuenta, pero no registrar operaciones hasta renovar.'}
          <span className="mt-1 block text-xs">{NONRENEWAL_WARNING}</span>
        </p>
        <Button asChild size="sm" className="flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white">
          <Link href="/admin/subscriptions">
            <CreditCard className="h-3.5 w-3.5" />
            Renovar plan
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
