'use client'

import React from 'react'
import { CalendarDays, Loader2, ReceiptText, ShieldCheck, User, Banknote, Wallet, Percent, ChevronRight } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { formatPosCreditDueDate } from '@/lib/credits/pos-credit-summary'
import type { PosCreditSummary } from '@/lib/credits/pos-credit-summary'
import type { FirstInstallmentTiming } from '@/lib/credits/installments'
import { FirstInstallmentSelector } from './FirstInstallmentSelector'
import { FirstInstallmentPaymentFields } from './FirstInstallmentPaymentFields'
import { firstPaymentError, type FirstInstallmentPayment } from '@/lib/credits/first-payment'

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
  creditSummary?: PosCreditSummary
  onFirstInstallmentTimingChange?: (value: FirstInstallmentTiming) => void
  firstPayment?: FirstInstallmentPayment
  onFirstPaymentChange?: (payment: FirstInstallmentPayment | undefined) => void
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
  creditSummary,
  onFirstInstallmentTimingChange,
  firstPayment,
  onFirstPaymentChange,
  formatCurrency,
  isProcessing,
}: SaleConfirmationDialogProps) {
  const isCredit = mode === 'credit'
  const paymentError = isCredit ? firstPaymentError(firstPayment, installmentAmount, creditSummary?.firstInstallmentTiming ?? 'at_start') : null
  const firstPaymentAmount = firstPayment && !paymentError ? installmentAmount : 0

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!isProcessing) onOpenChange(nextOpen)
    }}>
      <AlertDialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <div className={`h-1.5 w-full ${isCredit ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} />
        
        <AlertDialogHeader className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-5 text-left border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm border ${
              isCredit 
                ? 'bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' 
                : 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400'
            }`}>
              {isCredit ? <ShieldCheck className="h-6 w-6" aria-hidden="true" /> : <ReceiptText className="h-6 w-6" aria-hidden="true" />}
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {isCredit ? 'Confirmar venta a crédito' : 'Confirmar venta'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                Revisá los montos finales antes de emitir el comprobante.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-background sm:px-6">
          
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-slate-200/50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5">Cliente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 max-w-[120px] truncate">{customerName}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-700" />
            <div className="flex items-center gap-3 text-right">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5">Forma de Pago</span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{paymentLabel}</span>
              </div>
              <div className="h-9 w-9 bg-slate-200/50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                {isCredit ? <CalendarDays className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
              </div>
            </div>
          </div>

          <div className="space-y-3 px-1">
            {isCredit ? (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Banknote className="h-4 w-4" /> Entrega inicial (no es una cuota)</span>
                  <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(immediateAmount)}</strong>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Capital financiado</span>
                  <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(financedPrincipal)}</strong>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Percent className="h-4 w-4" /> Interés</span>
                  <strong className="font-semibold tabular-nums text-rose-500">+{formatCurrency(interestAmount)}</strong>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 flex items-center gap-2"><Banknote className="h-4 w-4" /> Monto a cobrar</span>
                <strong className="font-semibold text-base tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(immediateAmount)}</strong>
              </div>
            )}
          </div>

          {isCredit && creditSummary && onFirstInstallmentTimingChange && (
            <FirstInstallmentSelector value={creditSummary.firstInstallmentTiming} onChange={onFirstInstallmentTimingChange} frequency={creditSummary.frequency} disabled={isProcessing} />
          )}
          {isCredit && (
            <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 dark:border-blue-800/60 dark:from-blue-950/40 dark:to-indigo-950/20">
              <div className="absolute -right-4 -top-4 opacity-10">
                <CalendarDays className="h-24 w-24 text-blue-600" />
              </div>
              <div className="relative flex items-center justify-between gap-3 text-blue-900 dark:text-blue-100">
                <span className="text-sm font-medium">{installmentCount} cuotas{creditSummary ? ` ${creditSummary.frequency === 'weekly' ? 'semanales' : creditSummary.frequency === 'biweekly' ? 'quincenales' : 'mensuales'}` : ''} desde</span>
                <strong className="text-lg tabular-nums">{formatCurrency(installmentAmount)}</strong>
              </div>
              {firstDueDate && (
                <>
                  <Separator className="my-3 bg-blue-200/50 dark:bg-blue-800/50" />
                  <div className="relative flex items-center justify-between gap-3 text-sm text-blue-800 dark:text-blue-200">
                    <span className="flex items-center gap-2 font-medium">
                      <CalendarDays className="h-4 w-4" /> Primer vencimiento
                    </span>
                    <strong className="font-bold">{formatPosCreditDueDate(firstDueDate)}</strong>
                  </div>
                </>
              )}
              {creditSummary && (
                <>
                  <p className="mt-3 text-xs">Inicio: {formatPosCreditDueDate(creditSummary.startDate)}. Total de cuotas: {formatCurrency(creditSummary.financedTotal)}.</p>
                  {creditSummary.lastInstallmentAmount !== installmentAmount && <p className="mt-1 text-xs font-medium">Última cuota: {formatCurrency(creditSummary.lastInstallmentAmount)} (ajuste de redondeo).</p>}
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline focus-visible:outline-2">Ver calendario completo ({installmentCount} cuotas)</summary>
                    <ol className="mt-2 space-y-2" aria-label="Calendario de cuotas">
                      {creditSummary.installments.map(i => <li key={i.number} className="flex flex-wrap justify-between gap-2 border-t pt-2"><span>Cuota {i.number} · {formatPosCreditDueDate(i.dueDate)}</span><strong>{formatCurrency(i.amount)}</strong></li>)}
                    </ol>
                  </details>
                  <p className="mt-3 text-xs">{firstPayment ? 'La primera cuota se registrará pagada al confirmar. Las restantes seguirán pendientes.' : 'Las cuotas se registrarán pendientes. Esta confirmación no registra el cobro de la primera cuota.'}</p>
                </>
              )}
            </div>
          )}

          {isCredit && creditSummary && onFirstPaymentChange && <>
            <FirstInstallmentPaymentFields payment={firstPayment} onChange={onFirstPaymentChange} amount={installmentAmount} available={creditSummary.firstInstallmentTiming === 'at_start'} formatCurrency={formatCurrency} disabled={isProcessing} />
            {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
            <div className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite">
              <p className="flex justify-between gap-2"><span>Total a cobrar ahora</span><strong>{formatCurrency(immediateAmount + firstPaymentAmount)}</strong></p>
              <p className="text-xs text-muted-foreground">Entrega inicial {formatCurrency(immediateAmount)} + primera cuota {formatCurrency(firstPaymentAmount)}. No se suma al precio de la venta.</p>
              <p className="flex justify-between gap-2"><span>Saldo del crédito después del cobro</span><strong>{formatCurrency(creditSummary.financedTotal - firstPaymentAmount)}</strong></p>
            </div>
          </>}

          <div className={`flex items-end justify-between gap-4 rounded-xl p-4 ${
            isCredit 
              ? 'bg-blue-600 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.25)] dark:bg-blue-600' 
              : 'bg-emerald-600 text-white shadow-[0_4px_14px_0_rgba(5,150,105,0.25)] dark:bg-emerald-600'
          }`}>
            <span className="text-sm font-medium opacity-90">{isCredit ? 'Total con financiación' : 'Total de la venta'}</span>
            <strong className="text-2xl tabular-nums font-bold tracking-tight">{formatCurrency(total)}</strong>
          </div>
        </div>

        <AlertDialogFooter className="shrink-0 bg-background border-t px-4 py-3 gap-2 sm:px-6 sm:space-x-0">
          <AlertDialogCancel 
            disabled={isProcessing} 
            className="h-12 rounded-xl text-sm font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 sm:flex-1"
          >
            Volver y revisar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing || !!paymentError}
            className={`h-12 rounded-xl text-sm font-bold text-white sm:flex-1 ${
              isCredit 
                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700' 
                : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700'
            }`}
            aria-label={isProcessing ? 'Procesando venta' : (isCredit ? 'Confirmar venta a crédito' : 'Confirmar venta')}
            onClick={(event) => {
              event.preventDefault()
              if (!isProcessing && !paymentError) onConfirm()
            }}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Procesando...
              </span>
            ) : isCredit ? 'Generar Crédito' : 'Cobrar Venta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
