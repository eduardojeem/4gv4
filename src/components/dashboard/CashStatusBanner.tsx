'use client'

/**
 * El estado de la caja, arriba de todo en el panel.
 *
 * Abrir la caja es literalmente el primer paso del día: con la caja cerrada el
 * POS no deja confirmar una venta («La caja esta cerrada. Debe abrirla antes de
 * procesar ventas», en el checkout). Pero en el panel eso era un botón más
 * entre seis, apretados en la misma fila y cada uno de un color fuerte —rojo,
 * ámbar, violeta—: el que importaba gritaba igual que el resto, así que no
 * gritaba ninguno.
 *
 * Acá la caja deja de ser un botón y pasa a ser un estado: ocupa el ancho, se
 * lee primero y dice qué pasa si no se abre. Cuando ya está abierta se calla y
 * pasa a informar, que es lo que hace falta el resto del día.
 */

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Lock, LockOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { describeSessionOpening } from '@/lib/cash/session-age'
import { cn } from '@/lib/utils'

export type CashStatus = 'verificando' | 'abierta' | 'cerrada'

export interface CashStatusBannerProps {
  status: CashStatus
  /** Cuándo se abrió el turno, para decir desde qué hora está abierta. */
  openedAt?: string | null
  expectedBalance?: number
  movementsCount?: number
  /** Una operación de caja en curso: no se puede abrir ni cerrar dos veces. */
  busy?: boolean
  onOpen: () => void
  onClose: () => void
  detailsHref?: string
  className?: string
}

export function CashStatusBanner({
  status,
  openedAt,
  expectedBalance = 0,
  movementsCount = 0,
  busy = false,
  onOpen,
  onClose,
  detailsHref = '/dashboard/pos/caja',
  className,
}: CashStatusBannerProps) {
  const apertura = describeSessionOpening(openedAt)

  if (status === 'verificando') {
    return (
      <section
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50',
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Viendo cómo está la caja…
      </section>
    )
  }

  if (status === 'cerrada') {
    return (
      <section
        role="status"
        className={cn(
          'flex flex-col gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900/60 dark:bg-rose-950/30',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
            <Lock className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-rose-900 dark:text-rose-100">La caja está cerrada</p>
            {/* La consecuencia, no solo el estado: es lo que hace que se entienda
                por qué esto está primero. */}
            <p className="text-xs text-rose-800/90 dark:text-rose-200/80">
              Abrila para empezar el día: con la caja cerrada el punto de venta no deja
              confirmar ninguna venta.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onOpen}
          disabled={busy}
          className="w-full gap-2 bg-rose-600 font-semibold text-white hover:bg-rose-700 sm:w-auto"
        >
          <LockOpen className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Abriendo…' : 'Abrir caja'}
        </Button>
      </section>
    )
  }

  return (
    <section
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60 dark:bg-emerald-950/25',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <LockOpen className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {/* La hora se arma con la zona horaria de quien mira, que no es la
              del servidor: sin esto React avisa por la diferencia al hidratar. */}
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100" suppressHydrationWarning>
            Caja abierta{apertura ? ` ${apertura.texto}` : ''}
          </p>
          <p className="text-xs text-emerald-800/90 tabular-nums dark:text-emerald-200/80">
            Esperado en caja: <strong className="font-semibold">{formatCurrency(expectedBalance)}</strong>
            {movementsCount > 0 && (
              <> · {movementsCount} movimiento{movementsCount === 1 ? '' : 's'}</>
            )}
          </p>
          {/* Un turno que cruza días es un arqueo que no se hizo. En la base hay
              sesiones abiertas desde hace meses; callarlo no las cierra. */}
          {apertura?.deOtroDia && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {apertura.dias === 1
                ? 'Quedó abierta de ayer: cerrala para hacer el arqueo del día.'
                : `Lleva ${apertura.dias} días sin cierre: cerrala para hacer el arqueo.`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-emerald-900 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40">
          <Link href={detailsHref}>
            Ver la caja
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={busy}
          className="border-emerald-300 bg-white/80 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
        >
          Cerrar caja
        </Button>
      </div>
    </section>
  )
}
