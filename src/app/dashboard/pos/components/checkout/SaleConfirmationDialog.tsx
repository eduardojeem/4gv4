'use client'

import React from 'react'
import { CalendarDays, Loader2, ReceiptText, ShieldCheck } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'

type SaleConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  mode: 'sale' | 'credit'
  customerName: string
  paymentLabel: string
  total: number
  immediateAmount: number
  financedPrincipal?: number
  interestAmount?: number
  installmentCount?: number
  installmentAmount?: number
  firstDueDate?: string
  formatCurrency: (amount: number) => string
  isProcessing: boolean
}

export function SaleConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  mode,
  customerName,
  paymentLabel,
  total,
  immediateAmount,
  financedPrincipal = 0,
  interestAmount = 0,
  installmentCount = 0,
  installmentAmount = 0,
  firstDueDate,
  formatCurrency,
  isProcessing,
}: SaleConfirmationDialogProps) {
  const isCredit = mode === 'credit'

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!isProcessing) onOpenChange(nextOpen)
    }}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden p-0">
        <AlertDialogHeader className="border-b bg-muted/30 px-5 py-4 text-left">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isCredit ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <ReceiptText className="h-5 w-5" aria-hidden="true" />}
          </div>
          <AlertDialogTitle>
            {isCredit ? 'Confirmar venta a crédito' : 'Confirmar venta'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Revisá este resumen. La venta recién se registrará cuando confirmes debajo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 rounded-lg border bg-card p-3">
            <span className="text-muted-foreground">Cliente</span>
            <strong className="max-w-48 truncate text-right">{customerName}</strong>
            <span className="text-muted-foreground">Forma de cobro</span>
            <strong className="text-right">{paymentLabel}</strong>
            {isCredit ? (
              <>
                <span className="text-muted-foreground">Pago inmediato</span>
                <strong className="text-right tabular-nums">{formatCurrency(immediateAmount)}</strong>
                <span className="text-muted-foreground">Capital financiado</span>
                <strong className="text-right tabular-nums">{formatCurrency(financedPrincipal)}</strong>
                <span className="text-muted-foreground">Interés</span>
                <strong className="text-right tabular-nums">+{formatCurrency(interestAmount)}</strong>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">Monto a cobrar</span>
                <strong className="text-right tabular-nums">{formatCurrency(immediateAmount)}</strong>
              </>
            )}
          </div>

          {isCredit && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
              <div className="flex items-center justify-between gap-3">
                <span>{installmentCount} cuotas de</span>
                <strong className="tabular-nums">{formatCurrency(installmentAmount)}</strong>
              </div>
              {firstDueDate && (
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-blue-200 pt-2 dark:border-blue-800">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden="true" />Primera cuota</span>
                  <strong>{formatPosCreditDueDate(firstDueDate)}</strong>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end justify-between gap-4 rounded-lg bg-primary/10 px-3 py-3">
            <span className="font-medium">{isCredit ? 'Total con financiación' : 'Total de la venta'}</span>
            <strong className="text-xl tabular-nums text-primary">{formatCurrency(total)}</strong>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 border-t bg-muted/20 px-5 py-4 sm:space-x-0">
          <AlertDialogCancel disabled={isProcessing} className="h-11 sm:flex-1">
            Volver y revisar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            className="h-11 sm:flex-1"
            aria-label={isProcessing ? 'Procesando venta' : (isCredit ? 'Confirmar venta a crédito' : 'Confirmar venta')}
            onClick={(event) => {
              event.preventDefault()
              if (!isProcessing) onConfirm()
            }}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Procesando...</span>
            ) : isCredit ? 'Confirmar crédito' : 'Confirmar venta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
