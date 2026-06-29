'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

type Usage = {
  current: number
  limit: number | null
  remaining: number | null
  allowed: boolean
  blocked: boolean
  planName: string
}

interface Props {
  /** Cambia este valor (p.ej. cantidad de reparaciones) para forzar recarga del uso. */
  reloadSignal?: number
}

export function RepairLimitBanner({ reloadSignal = 0 }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/repairs/usage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Usage | null) => {
        if (active && data && typeof data.current === 'number') setUsage(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [reloadSignal])

  // Plan ilimitado (Pro/Enterprise) o aún sin datos → no mostramos nada.
  if (!usage || usage.limit === null) return null

  const { current, limit, remaining, planName } = usage
  const atLimit = current >= limit
  const nearLimit = !atLimit && remaining !== null && remaining <= 3

  const tone = atLimit
    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
    : nearLimit
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
      : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'

  const Icon = atLimit || nearLimit ? AlertTriangle : Info

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', tone)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          <strong>Plan {planName}</strong>
          {atLimit ? (
            <> · Alcanzaste el límite de <strong>{limit}</strong> reparaciones este mes.</>
          ) : (
            <>
              {' '}· <strong>{current}</strong> de <strong>{limit}</strong> reparaciones este mes
              {remaining !== null && <> · te quedan <strong>{remaining}</strong></>}.
            </>
          )}
        </span>
      </div>

      {(atLimit || nearLimit) && (
        <Link
          href="/admin/subscriptions/change-plan"
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-background/70 px-3 py-1.5 text-xs font-semibold underline-offset-2 hover:underline sm:self-auto"
        >
          <Wrench className="h-3.5 w-3.5" />
          Subir de plan para crear más
        </Link>
      )}
    </div>
  )
}
