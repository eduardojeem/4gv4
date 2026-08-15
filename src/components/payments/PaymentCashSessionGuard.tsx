'use client'

import Link from 'next/link'
import { CheckCircle2, Loader2, LockKeyhole } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PaymentCashSessionState } from '@/lib/payments/cash-session-guard'

export function PaymentCashSessionGuard({
  state,
  onOpenCashRegister,
  canOpenRegister = true,
}: {
  state: PaymentCashSessionState
  onOpenCashRegister: () => void
  canOpenRegister?: boolean
}) {
  if (state === 'idle') return null

  if (state === 'checking') {
    return (
      <div role="status" className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
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
