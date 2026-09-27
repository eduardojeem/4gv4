'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Search, CheckCircle, Receipt, Printer } from 'lucide-react'
import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import type { CreditRow, InstallmentRow, PaymentRow } from '@/hooks/use-credits'
import { getCreditDisplayInfo } from '@/lib/credits/display'
import { createCreditPaymentReceiptPdf, getCreditCurrentBalance } from '@/lib/credits/payment-receipt'
import { printPdfDocument } from '@/lib/credits/print-receipt'
import { useCreditPrinting } from '@/hooks/use-credit-printing'
import { toast } from 'sonner'

const methodConfig: Record<string, { label: string; color: string; dot: string }> = {
  cash:     { label: 'Efectivo',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   dot: 'bg-green-500' },
  card:     { label: 'Tarjeta',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     dot: 'bg-blue-500' },
  transfer: { label: 'Transferencia', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', dot: 'bg-purple-500' },
}

const avatarGradients = [
  'from-blue-500 to-blue-700', 'from-violet-500 to-violet-700',
  'from-emerald-500 to-emerald-700', 'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700', 'from-cyan-500 to-cyan-700',
  'from-indigo-500 to-indigo-700', 'from-fuchsia-500 to-fuchsia-700',
]

function getGradient(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return avatarGradients[Math.abs(h) % avatarGradients.length]
}

function getDateLabel(iso?: string) {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'Hoy'
  if (d.getTime() === yesterday.getTime()) return 'Ayer'
  return new Date(iso).toLocaleDateString(getDisplayLocale(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

interface PaymentsTimelineProps {
  recentPayments: PaymentRow[]
  payments: PaymentRow[]
  creditById: Record<string, CreditRow>
  installments: InstallmentRow[]
  sales?: Array<{ id: string; code?: string | null; created_at?: string | null; total_amount?: number | null }>
  saleItems?: Array<{ sale_id?: string | null; quantity?: number | null; product?: { name?: string | null } | null }>
  loading: boolean
  isPending: boolean
  onExportCSV: () => void
}

export function PaymentsTimeline({
  recentPayments,
  payments,
  creditById,
  installments,
  sales = [],
  saleItems = [],
  loading,
  isPending,
  onExportCSV,
}: PaymentsTimelineProps) {
  const { format, issuer } = useCreditPrinting()
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? recentPayments.filter(p => {
        const n = (creditById[p.credit_id]?.customer_name || '').toLowerCase()
        const m = (p.payment_method || '').toLowerCase()
        const q = search.toLowerCase()
        return n.includes(q) || m.includes(q)
      })
    : recentPayments

  const groups = filtered.reduce<Record<string, typeof recentPayments>>((acc, p) => {
    const k = getDateLabel(p.created_at)
    if (!acc[k]) acc[k] = []
    acc[k].push(p)
    return acc
  }, {})

  const printPaymentReceipt = async (payment: PaymentRow) => {
    try {
    const credit = creditById[payment.credit_id]
    const installment = installments.find((row) => row.id === payment.installment_id)
    const creditInstallments = installments.filter((row) => row.credit_id === payment.credit_id)
    const paidCount = creditInstallments.filter((row) => row.status === 'paid').length
    const pendingCount = creditInstallments.filter((row) => row.status !== 'paid').length
    const nextPending = creditInstallments.find((row) => row.status !== 'paid')
    const display = getCreditDisplayInfo(credit, installments, sales, saleItems)

    const result = await createCreditPaymentReceiptPdf({
      paymentId: payment.id,
      paymentDate: payment.created_at,
      paymentAmount: Number(payment.amount || 0),
      paymentMethod: payment.payment_method,
      notes: payment.notes,
      customerName: credit?.customer_name || 'Cliente',
      customerId: credit?.customer_id,
      customerCode: credit?.customer_code,
      creditId: payment.credit_id,
      creditCode: display.creditCode,
      creditTypeLabel: display.creditTypeLabel,
      originLabel: display.originLabel,
      creditLabel: display.creditLabel,
      saleCode: display.saleCode,
      productSummary: display.productSummary,
      totalCreditAmount: credit?.principal,
      totalInstallments: credit?.term_months || creditInstallments.length,
      paidInstallmentsCount: paidCount,
      pendingInstallmentsCount: pendingCount,
      installmentNumber: installment?.installment_number,
      installmentDueDate: installment?.due_date,
      installmentAmount: installment?.amount,
      currentCreditBalance: getCreditCurrentBalance(installments, payment.credit_id),
      nextDueDate: nextPending?.due_date,
      nextDueAmount: nextPending?.amount,
      ...issuer,
    }, { format })

      await printPdfDocument(result.doc)
    } catch (error) {
      // El pago YA quedo registrado en la base: el mensaje tiene que dejarlo
      // claro para que nadie vuelva a cobrarlo creyendo que fallo el cobro.
      toast.error('No se pudo imprimir el comprobante', {
        description: `El pago quedó registrado. ${error instanceof Error ? error.message : 'Volvé a intentar desde el historial.'}`,
      })
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente o método..."
            className="w-full h-8 pl-8 pr-7 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">✕</button>
          )}
        </div>
        <p className="text-sm text-muted-foreground ml-auto shrink-0">
          {filtered.length !== recentPayments.length
            ? `${filtered.length} de ${recentPayments.length}`
            : payments.length > 300 ? `Últimos 300 de ${payments.length}` : `${recentPayments.length} pagos`}
        </p>
        <Button variant="outline" size="sm" onClick={onExportCSV} className="h-8 gap-1.5 shrink-0">
          <CheckCircle className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Skeleton */}
      {(loading || isPending) && (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3 border border-border/60 bg-muted/20">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 bg-muted rounded" />
                <div className="h-2.5 w-16 bg-muted rounded" />
              </div>
              <div className="h-4 w-14 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {!loading && !isPending && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border">
            <div className="p-4 rounded-full bg-muted/50 mb-3">
              <Receipt className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Sin resultados' : 'Sin pagos registrados'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {search ? 'Intentá con otro término' : 'Los pagos aparecerán aquí cuando se registren'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([label, rows]) => {
              const dayTotal = rows.reduce((s, p) => s + Number(p.amount || 0), 0)
              return (
                <div key={label}>
                  {/* Date separator + subtotal */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border/40">
                      <span className="text-xs font-semibold text-foreground capitalize">{label}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(dayTotal)}</span>
                    </div>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {/* Rows */}
                  <div className="space-y-1.5">
                    {rows.map(p => {
                      const credit = creditById[p.credit_id]
                      const name = credit?.customer_name || 'Cliente'
                      const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                      const inst = installments.find(i => i.id === p.installment_id)
                      const method = methodConfig[p.payment_method || ''] ?? { label: p.payment_method || 'Otro', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' }
                      const display = getCreditDisplayInfo(credit, installments, sales, saleItems)
                      return (
                        <div key={p.id} className="group flex items-center gap-3 rounded-xl px-4 py-3 bg-white dark:bg-white/[0.03] border border-border/50 dark:border-white/[0.05] hover:border-green-300 dark:hover:border-green-800 hover:shadow-sm hover:bg-green-50/20 dark:hover:bg-green-900/10 transition-all duration-150 cursor-default">
                          <div className={`flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br ${getGradient(name)} flex items-center justify-center text-white text-xs font-bold shadow-sm select-none`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">{name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-mono bg-muted/50 rounded px-1.5 py-0.5 leading-none">{display.creditCode}</span>
                              {inst && <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded px-1.5 py-0.5 leading-none">Cuota #{inst.installment_number}</span>}
                              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full leading-none ${method.color}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${method.dot} opacity-80`} />
                                {method.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground rounded-full border border-border px-2 py-0.5 leading-none">
                                {display.originLabel}
                              </span>
                              {display.saleCode && (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  Ticket {display.saleCode}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">{display.creditLabel}</p>
                          </div>
                          <div className="hidden sm:block text-right shrink-0">
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {p.created_at ? new Date(p.created_at).toLocaleTimeString(getDisplayLocale(), { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0 min-w-[80px]">
                            <p className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">+{formatCurrency(p.amount)}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 gap-1.5 px-2"
                            title="Imprimir comprobante"
                            aria-label="Imprimir comprobante de pago"
                            onClick={() => printPaymentReceipt(p)}
                          >
                            <Printer className="h-4 w-4" />
                            <span className="hidden lg:inline">Imprimir</span>
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </>
  )
}
