'use client'

import Link from 'next/link'
import { Banknote, CheckCircle2, Loader2, LockKeyhole, MapPin, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PaymentCashSessionState } from '@/lib/payments/cash-session-guard'

export function PaymentCashSessionGuard({
  state,
  onOpenCashRegister,
  canOpenRegister = true,
  branchName = 'Sucursal actual',
  registerName = 'Caja Principal',
  onCancel,
  variant = 'inline',
}: {
  state: PaymentCashSessionState
  onOpenCashRegister: () => void
  canOpenRegister?: boolean
  branchName?: string
  registerName?: string
  onCancel?: () => void
  variant?: 'inline' | 'gate'
}) {
  if (state === 'idle') return null

  if (state === 'checking') {
    return (
      <div role="status" className={variant === 'gate'
        ? 'flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 p-8 text-center text-muted-foreground'
        : 'flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground'}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Consultando caja…
      </div>
    )
  }

  if (state === 'open') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Caja abierta
      </div>
    )
  }

  if (variant === 'gate') {
    return (
      <section role="alert" className="overflow-hidden rounded-xl border border-amber-300 bg-card shadow-sm dark:border-amber-900">
        <div className="flex flex-col items-center border-b bg-amber-50/80 px-5 py-7 text-center dark:bg-amber-950/25 sm:px-7">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-300 bg-background text-amber-700 shadow-sm dark:border-amber-800 dark:text-amber-300">
            <LockKeyhole className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Abrí la caja para continuar</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Todos los cobros y pagos deben quedar asociados a un turno de caja para mantener el control y la auditoría.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Contexto de caja">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0"><p className="text-xs text-muted-foreground">Sucursal</p><p className="truncate text-sm font-medium">{branchName}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3">
              <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0"><p className="text-xs text-muted-foreground">Caja</p><p className="truncate text-sm font-medium">{registerName}</p></div>
            </div>
          </div>

          {!canOpenRegister && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Solicitá a un responsable que abra la caja.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
            {canOpenRegister ? (
              <Button type="button" onClick={onOpenCashRegister} className="gap-2">
                <Banknote className="h-4 w-4" aria-hidden="true" /> Abrir caja
              </Button>
            ) : (
              <Button asChild type="button"><Link href="/dashboard/pos/caja">Ir a Caja</Link></Button>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <div role="alert" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Caja cerrada</p>
          <p className="text-xs leading-5 opacity-80">Abrí una caja para registrar este pago y mantener su auditoría.</p>
        </div>
      </div>
      {canOpenRegister ? (
        <Button type="button" size="sm" onClick={onOpenCashRegister}>Abrir caja</Button>
      ) : (
        <Button asChild type="button" size="sm">
          <Link href="/dashboard/pos/caja">Ir a Caja</Link>
        </Button>
      )}
    </div>
  )
}
