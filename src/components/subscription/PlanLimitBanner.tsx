'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ResourceKey = 'users' | 'branches' | 'cashRegisters' | 'products' | 'categories'

type Usage = {
  current: number
  limit: number | null
  remaining: number | null
  allowed: boolean
  blocked: boolean
  planName: string
}

// Sustantivos para el mensaje (plural / "te queda(n)").
const NOUNS: Record<ResourceKey, { plural: string }> = {
  products: { plural: 'productos' },
  users: { plural: 'usuarios' },
  branches: { plural: 'sucursales' },
  cashRegisters: { plural: 'cajas' },
  categories: { plural: 'categorías' },
}

interface Props {
  resource: ResourceKey
  /** Cambia este valor para forzar recarga (p.ej. cantidad actual de registros). */
  reloadSignal?: number
  className?: string
  variant?: 'default' | 'compact'
}

export function PlanLimitBanner({ resource, reloadSignal = 0, className, variant = 'default' }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/subscription/usage?resource=${resource}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Usage | null) => {
        if (active && data && typeof data.current === 'number') setUsage(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [resource, reloadSignal])

  // Plan ilimitado o sin datos o cerrado → no mostramos nada.
  if (isDismissed || !usage || usage.limit === null) return null

  const { current, limit, remaining, planName } = usage
  const noun = NOUNS[resource].plural
  const atLimit = current >= limit
  const nearLimit = !atLimit && remaining !== null && remaining <= Math.max(1, Math.ceil(limit * 0.1))

  const tone = atLimit
    ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
    : nearLimit
      ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
      : 'border-blue-200/80 bg-blue-50/80 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'

  const Icon = atLimit || nearLimit ? AlertTriangle : Info

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-between sm:justify-start gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-2xs shrink-0 backdrop-blur-xs transition-all',
          tone,
          className,
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-[11px] sm:text-xs">
            <strong>Plan {planName}</strong>
            {atLimit ? (
              <> · Límite alcanzado (<strong>{limit}</strong> {noun})</>
            ) : (
              <>
                {' '}· <strong>{current}</strong> de <strong>{limit}</strong> {noun}
                {remaining !== null && (
                  <> · te {remaining === 1 ? 'queda' : 'quedan'} <strong>{remaining}</strong></>
                )}
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {(atLimit || nearLimit) && (
            <Link
              href="/admin/subscriptions/change-plan"
              className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold hover:underline"
            >
              <ArrowUpCircle className="h-3 w-3" />
              Subir de plan
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-0.5 text-current opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-opacity"
            title="Ocultar aviso de plan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-3.5 py-2 text-xs sm:flex-row sm:items-center sm:justify-between shadow-xs',
        tone,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>
          <strong>Plan {planName}</strong>
          {atLimit ? (
            <> · Alcanzaste el límite de <strong>{limit}</strong> {noun}.</>
          ) : (
            <>
              {' '}· <strong>{current}</strong> de <strong>{limit}</strong> {noun}
              {remaining !== null && (
                <> · te {remaining === 1 ? 'queda' : 'quedan'} <strong>{remaining}</strong></>
              )}.
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {(atLimit || nearLimit) && (
          <Link
            href="/admin/subscriptions/change-plan"
            className="inline-flex items-center gap-1 rounded-lg bg-background/70 px-2.5 py-1 text-[11px] font-semibold underline-offset-2 hover:underline"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            Subir de plan
          </Link>
        )}

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 text-current opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-opacity"
          title="Ocultar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
