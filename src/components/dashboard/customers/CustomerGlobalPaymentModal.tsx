'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CreditCard,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  DollarSign,
  Wallet,
  ArrowRight,
  Printer,
  Share2,
  RefreshCw,
  Clock,
  Coins,
  Building2,
  Copy,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Customer } from '@/hooks/use-customer-state'

export const PARAGUAY_BANKS = [
  'Banco Itaú',
  'Ueno Bank',
  'Banco Continental',
  'Banco Familiar',
  'Sudameris Bank',
  'Banco GNB',
  'Banco Atlas',
  'Bancop',
  'Banco Basa',
  'Billetera Tigo Money',
  'Personal Pay / Billetera Personal',
  'Billetera Zimple',
  'Otro Banco / Cooperativa',
]

export const POS_NETWORKS = [
  'Bancard (Infonet POS)',
  'Dinelco (BEPSA)',
  'Bancop POS',
  'POS Móvil / QR',
  'Otra Red POS',
]

export interface DebtItem {
  id: string
  type: 'repair' | 'installment'
  title: string
  subtitle?: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  dueDate?: string
  isOverdue: boolean
  status: string
  operationalStatus?: string
  repairCategory?: 'in_progress' | 'ready_for_pickup' | 'delivered_unpaid'
  debtReason?: string
  creditId?: string
}

interface PaymentResult {
  receiptNumber: string
  totalAmount: number
  appliedAllocations: Array<{
    id: string
    type: 'repair' | 'installment'
    title: string
    allocatedAmount: number
    previousPending: number
    newPending: number
    fullyPaid: boolean
  }>
  excessToStoreCredit: number
  paymentMethod: string
  bankName?: string | null
  referenceNumber?: string | null
  cardType?: 'debit' | 'credit' | null
  posNetwork?: string | null
  voucherNumber?: string | null
  lastFourDigits?: string | null
  timestamp: string
}

interface CustomerGlobalPaymentModalProps {
  customer: Customer | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CustomerGlobalPaymentModal({
  customer,
  open,
  onClose,
  onSuccess,
}: CustomerGlobalPaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [debts, setDebts] = useState<DebtItem[]>([])
  const [totalDebt, setTotalDebt] = useState(0)
  const [overdueDebt, setOverdueDebt] = useState(0)
  const [storeBalance, setStoreBalance] = useState(0)

  // Payment form state
  const [amountInput, setAmountInput] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [bankName, setBankName] = useState<string>('Banco Itaú')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [cardType, setCardType] = useState<'debit' | 'credit'>('debit')
  const [posNetwork, setPosNetwork] = useState<string>('Bancard (Infonet POS)')
  const [voucherNumber, setVoucherNumber] = useState<string>('')
  const [lastFourDigits, setLastFourDigits] = useState<string>('')
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')

  // Receipt / Success state
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)

  const handleCopyBankInfo = () => {
    const bankDetails = `*Datos para Transferencia Bancaria:*
Titular: Mi Empresa S.A.
RUC: 80012345-6
Banco: Banco Itaú
Cta Cte Nº: 123456789
Alias SIPAP: 0981123456`
    navigator.clipboard.writeText(bankDetails)
    toast.success('Datos bancarios de la empresa copiados al portapapeles')
  }

  const fetchDebts = async () => {
    if (!customer?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/collect-payment`)
      const data = await res.json()
      if (data.success) {
        setDebts(data.debts || [])
        setTotalDebt(data.totalDebt || 0)
        setOverdueDebt(data.overdueDebt || 0)
        setStoreBalance(data.storeBalance || 0)

        // Initialize manual allocations with 0
        const initialManual: Record<string, number> = {}
        ;(data.debts || []).forEach((d: DebtItem) => {
          initialManual[d.id] = 0
        })
        setManualAllocations(initialManual)
      } else {
        toast.error(data.error || 'Error al cargar deudas del cliente')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error de conexión al cargar deudas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && customer?.id) {
      setPaymentResult(null)
      setAmountInput('')
      setPaymentMethod('cash')
      setBankName('Banco Itaú')
      setReferenceNumber('')
      setCardType('debit')
      setPosNetwork('Bancard (Infonet POS)')
      setVoucherNumber('')
      setLastFourDigits('')
      setMode('auto')
      setNotes('')
      fetchDebts()
    }
  }, [open, customer?.id])

  const numericAmount = useMemo(() => {
    const cleaned = amountInput.replace(/[^0-9]/g, '')
    return cleaned ? parseInt(cleaned, 10) : 0
  }, [amountInput])

  // Calculate live preview allocations
  const previewAllocations = useMemo(() => {
    if (numericAmount <= 0) return []

    const result: Array<{
      debt: DebtItem
      allocated: number
      newPending: number
      isFullyPaid: boolean
    }> = []

    let remaining = numericAmount

    if (mode === 'auto') {
      for (const d of debts) {
        if (remaining <= 0) {
          result.push({
            debt: d,
            allocated: 0,
            newPending: d.pendingAmount,
            isFullyPaid: false,
          })
          continue
        }
        const alloc = Math.min(remaining, d.pendingAmount)
        const newPending = Math.max(0, d.pendingAmount - alloc)
        result.push({
          debt: d,
          allocated: alloc,
          newPending,
          isFullyPaid: newPending === 0,
        })
        remaining -= alloc
      }
    } else {
      for (const d of debts) {
        const manualVal = manualAllocations[d.id] || 0
        const alloc = Math.min(manualVal, d.pendingAmount)
        const newPending = Math.max(0, d.pendingAmount - alloc)
        result.push({
          debt: d,
          allocated: alloc,
          newPending,
          isFullyPaid: newPending === 0,
        })
      }
    }

    return result
  }, [debts, numericAmount, mode, manualAllocations])

  const totalAllocated = useMemo(() => {
    return previewAllocations.reduce((acc, p) => acc + p.allocated, 0)
  }, [previewAllocations])

  const excessToStoreCredit = useMemo(() => {
    return Math.max(0, numericAmount - totalAllocated)
  }, [numericAmount, totalAllocated])

  const handleQuickAmount = (amt: number) => {
    setAmountInput(amt.toString())
  }

  const handlePaySingleDebt = (debt: DebtItem) => {
    setMode('manual')
    const newManual: Record<string, number> = {}
    debts.forEach((d) => {
      newManual[d.id] = d.id === debt.id ? debt.pendingAmount : 0
    })
    setManualAllocations(newManual)
    setAmountInput(debt.pendingAmount.toString())

    const isIncompleteRepair = debt.type === 'repair' && debt.operationalStatus !== 'entregado' && debt.operationalStatus !== 'listo'
    if (isIncompleteRepair) {
      toast.info(`Monto fijado como Adelanto para: ${debt.title} (reparación en curso)`)
    } else {
      toast.info(`Monto fijado para abonar exclusivamente a: ${debt.title}`)
    }
  }

  const handleManualAllocationChange = (debtId: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '')
    const num = cleaned ? parseInt(cleaned, 10) : 0
    setManualAllocations((prev) => ({
      ...prev,
      [debtId]: num,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer?.id || numericAmount <= 0) {
      toast.warning('Ingresa un monto válido a abonar.')
      return
    }

    if (mode === 'manual' && totalAllocated <= 0 && excessToStoreCredit <= 0) {
      toast.warning('Asigna un monto a al menos una deuda o ingresa el saldo.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        amount: numericAmount,
        paymentMethod,
        bankName: paymentMethod === 'transfer' ? bankName : undefined,
        referenceNumber: paymentMethod === 'transfer' ? referenceNumber : undefined,
        cardType: paymentMethod === 'card' ? cardType : undefined,
        posNetwork: paymentMethod === 'card' ? posNetwork : undefined,
        voucherNumber: paymentMethod === 'card' ? voucherNumber : undefined,
        lastFourDigits: paymentMethod === 'card' ? lastFourDigits : undefined,
        mode,
        allocations:
          mode === 'manual'
            ? Object.entries(manualAllocations).map(([id, amt]) => {
                const debt = debts.find((d) => d.id === id)
                return {
                  id,
                  type: debt?.type || 'installment',
                  amount: amt,
                }
              })
            : undefined,
        notes,
      }

      const res = await fetch(`/api/customers/${customer.id}/collect-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Pago registrado exitosamente')
        setPaymentResult({
          receiptNumber: data.receiptNumber,
          totalAmount: data.totalAmount,
          appliedAllocations: data.appliedAllocations || [],
          excessToStoreCredit: data.excessToStoreCredit || 0,
          paymentMethod: data.paymentMethod || paymentMethod,
          bankName: data.bankName || (paymentMethod === 'transfer' ? bankName : null),
          referenceNumber: data.referenceNumber || (paymentMethod === 'transfer' ? referenceNumber : null),
          cardType: data.cardType || (paymentMethod === 'card' ? cardType : null),
          posNetwork: data.posNetwork || (paymentMethod === 'card' ? posNetwork : null),
          voucherNumber: data.voucherNumber || (paymentMethod === 'card' ? voucherNumber : null),
          lastFourDigits: data.lastFourDigits || (paymentMethod === 'card' ? lastFourDigits : null),
          timestamp: data.timestamp || new Date().toISOString(),
        })
        if (onSuccess) onSuccess()
      } else {
        toast.error(data.error || 'Error al procesar el abono')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error de comunicación con el servidor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleShareWhatsApp = () => {
    if (!paymentResult || !customer) return
    const phone = (customer.phone || '').replace(/[^0-9]/g, '')
    if (!phone) {
      toast.warning('El cliente no tiene teléfono registrado.')
      return
    }

    const getMethodDescription = () => {
      if (paymentResult.paymentMethod === 'transfer') {
        const parts = [paymentResult.bankName || 'Banco']
        if (paymentResult.referenceNumber) parts.push(`Comprobante SIPAP Nº ${paymentResult.referenceNumber}`)
        return `Transferencia Bancaria (${parts.join(' - ')})`
      }
      if (paymentResult.paymentMethod === 'card') {
        const cardKind = paymentResult.cardType === 'credit' ? 'Crédito' : 'Débito'
        const parts = [paymentResult.posNetwork || 'POS']
        if (paymentResult.voucherNumber) parts.push(`Ticket POS Nº ${paymentResult.voucherNumber}`)
        if (paymentResult.lastFourDigits) parts.push(`Tarjeta terminada en ${paymentResult.lastFourDigits}`)
        return `Tarjeta de ${cardKind} (${parts.join(' - ')})`
      }
      return 'Efectivo'
    }

    const lines = [
      `*🧾 COMPROBANTE DE ABONO A CUENTA - ${paymentResult.receiptNumber}*`,
      `Cliente: ${customer.name}`,
      `Fecha: ${new Date(paymentResult.timestamp).toLocaleString('es-PY')}`,
      `Monto Total Abonado: *${formatCurrency(paymentResult.totalAmount)}*`,
      `Medio de Pago: *${getMethodDescription()}*`,
      '',
      '*Desglose de obligaciones aplicadas:*',
      ...paymentResult.appliedAllocations.map(
        (a) => `• ${a.title}: ${formatCurrency(a.allocatedAmount)} ${a.fullyPaid ? '✅ (Cancelado/Liquidado)' : `(Saldo pendiente: ${formatCurrency(a.newPending)})`}`
      ),
    ]

    if (paymentResult.excessToStoreCredit > 0) {
      lines.push(`• *Saldo a Favor (Billetera):* +${formatCurrency(paymentResult.excessToStoreCredit)}`)
    }

    lines.push('', '¡Gracias por su pago!')

    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl lg:max-w-4xl p-0 gap-0 max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="p-4 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Abono Unificado a Cuenta
                  <Badge className="bg-purple-500 text-white border-0 text-[10px] font-bold">
                    Multi-Deuda
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-400">
                  {customer?.name} · {customer?.customerCode || customer?.ruc || 'Cliente'}
                </p>
              </div>
            </div>

            {/* Total Debt Counter */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Deuda Total</p>
                <p className="text-base font-bold text-rose-400 tabular-nums">
                  {formatCurrency(totalDebt)}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950">
          {paymentResult ? (
            /* ── SUCCESS RECEIPT VIEW ── */
            <div className="space-y-5 py-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    ¡Abono Registrado Exitosamente!
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                    Comprobante #{paymentResult.receiptNumber}
                  </p>
                </div>

                {paymentResult.paymentMethod === 'transfer' && (paymentResult.bankName || paymentResult.referenceNumber) && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-semibold">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{paymentResult.bankName || 'Transferencia Bancaria'}</span>
                    {paymentResult.referenceNumber && (
                      <span className="font-mono bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                        Comprobante SIPAP Nº {paymentResult.referenceNumber}
                      </span>
                    )}
                  </div>
                )}

                {paymentResult.paymentMethod === 'card' && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-semibold">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Tarjeta de {paymentResult.cardType === 'credit' ? 'Crédito' : 'Débito'}</span>
                    {paymentResult.posNetwork && <span>({paymentResult.posNetwork})</span>}
                    {paymentResult.voucherNumber && (
                      <span className="font-mono bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                        Ticket POS Nº {paymentResult.voucherNumber}
                      </span>
                    )}
                    {paymentResult.lastFourDigits && (
                      <span className="font-mono bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded text-[11px]">
                        Tarjeta **** {paymentResult.lastFourDigits}
                      </span>
                    )}
                  </div>
                )}

                <div className="text-3xl font-black text-emerald-950 dark:text-white tabular-nums">
                  {formatCurrency(paymentResult.totalAmount)}
                </div>
              </div>

              {/* Allocations applied */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Desglose de Aplicación
                </h4>
                <div className="space-y-2">
                  {paymentResult.appliedAllocations.map((alloc) => (
                    <div
                      key={alloc.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {alloc.type === 'repair' ? (
                          <Wrench className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-purple-500" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{alloc.title}</p>
                          <p className="text-[10px] text-slate-500">
                            Deuda anterior: {formatCurrency(alloc.previousPending)} · Saldo restante:{' '}
                            <span className={alloc.fullyPaid ? 'text-emerald-600 font-bold' : 'text-rose-600 font-semibold'}>
                              {alloc.fullyPaid ? '0 Gs (Liquidado)' : formatCurrency(alloc.newPending)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatCurrency(alloc.allocatedAmount)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {paymentResult.excessToStoreCredit > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs border border-emerald-200 dark:border-emerald-800/40">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="font-bold text-emerald-900 dark:text-emerald-200">
                            Excedente a Billetera (Saldo a Favor)
                          </p>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            Acreditado para futuras compras o reparaciones
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        +{formatCurrency(paymentResult.excessToStoreCredit)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {customer?.phone && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800"
                    onClick={handleShareWhatsApp}
                  >
                    <Share2 className="h-4 w-4" />
                    Enviar WhatsApp
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  onClick={onClose}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : loading ? (
            /* ── SKELETON LOADING ── */
            <div className="space-y-4 py-6">
              <div className="h-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
              <div className="h-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl" />
            </div>
          ) : debts.length === 0 ? (
            /* ── NO DEBTS VIEW ── */
            <div className="text-center py-12 space-y-3">
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ¡El cliente no tiene deudas pendientes!
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No existen reparaciones impagas ni cuotas de crédito activas registradas para este cliente.
              </p>
              {storeBalance > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <Wallet className="h-3.5 w-3.5" />
                  Saldo a favor disponible: {formatCurrency(storeBalance)}
                </div>
              )}
            </div>
          ) : (
            /* ── PAYMENT FORM VIEW ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Monto y Medios de Pago */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                {/* Input de Monto */}
                <div className="md:col-span-6 space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Monto a Entregar por el Cliente
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      Gs.
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={amountInput ? parseInt(amountInput.replace(/[^0-9]/g, ''), 10).toLocaleString('es-PY') : ''}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="0"
                      className="pl-11 text-xl font-bold text-slate-900 dark:text-white tabular-nums h-12"
                      autoFocus
                    />
                  </div>

                  {/* Botones de sugerencia rápida */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(totalDebt)}
                      className="px-2 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      Pagar Todo ({formatCurrency(totalDebt)})
                    </button>
                    {overdueDebt > 0 && overdueDebt !== totalDebt && (
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(overdueDebt)}
                        className="px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        Vencido ({formatCurrency(overdueDebt)})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(500000)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      500.000 Gs
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(1000000)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      1.000.000 Gs
                    </button>
                  </div>
                </div>

                {/* Método de Pago */}
                <div className="md:col-span-6 space-y-2">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Método de Pago
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all',
                        paymentMethod === 'cash'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      <DollarSign className="h-4 w-4 mb-1" />
                      Efectivo
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all',
                        paymentMethod === 'card'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      <CreditCard className="h-4 w-4 mb-1" />
                      Tarjeta
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('transfer')}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all',
                        paymentMethod === 'transfer'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      <Receipt className="h-4 w-4 mb-1" />
                      Transferencia
                    </button>
                  </div>

                  {/* Modo de Distribución */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">Modo de Distribución:</span>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setMode('auto')}
                        className={cn(
                          'px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all',
                          mode === 'auto'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        )}
                      >
                        <Sparkles className="h-3 w-3" />
                        Cascada FIFO
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={cn(
                          'px-2 py-1 rounded-md text-[10px] font-bold transition-all',
                          mode === 'manual'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        )}
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel de Datos de Transferencia Bancaria / SIPAP */}
                {paymentMethod === 'transfer' && (
                  <div className="md:col-span-12 p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                          Detalles de Transferencia Bancaria (SIPAP)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBankInfo}
                        className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Copiar datos bancarios para pasar al cliente"
                      >
                        <Copy className="h-3 w-3" />
                        Copiar Cuentas Bancarias
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Banco / Billetera Destino
                        </Label>
                        <Select value={bankName} onValueChange={setBankName}>
                          <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Selecciona el banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {PARAGUAY_BANKS.map((b) => (
                              <SelectItem key={b} value={b} className="text-xs">
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Cuenta del negocio donde ingresó el dinero.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Nº Comprobante SIPAP</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">(Opcional)</span>
                        </Label>
                        <Input
                          type="text"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          placeholder="Nº de operación de la app bancaria (ej. 8945231)"
                          className="h-9 text-xs bg-white dark:bg-slate-900 font-mono"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Código de operación para cruzar con el extracto bancario.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Panel de Datos de Tarjeta POS / Datáfono */}
                {paymentMethod === 'card' && (
                  <div className="md:col-span-12 p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                        Detalles del Cobro por Tarjeta (POS)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Tipo de Tarjeta
                        </Label>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 h-9">
                          <button
                            type="button"
                            onClick={() => setCardType('debit')}
                            className={cn(
                              'flex-1 h-7 rounded-md text-[11px] font-bold transition-all',
                              cardType === 'debit'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            )}
                          >
                            Débito
                          </button>
                          <button
                            type="button"
                            onClick={() => setCardType('credit')}
                            className={cn(
                              'flex-1 h-7 rounded-md text-[11px] font-bold transition-all',
                              cardType === 'credit'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            )}
                          >
                            Crédito
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Modalidad del POS.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Terminal / Red POS
                        </Label>
                        <Select value={posNetwork} onValueChange={setPosNetwork}>
                          <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Selecciona la red" />
                          </SelectTrigger>
                          <SelectContent>
                            {POS_NETWORKS.map((net) => (
                              <SelectItem key={net} value={net} className="text-xs">
                                {net}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Procesador del datáfono.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Nº Ticket / Cupón</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">(Opcional)</span>
                        </Label>
                        <Input
                          type="text"
                          value={voucherNumber}
                          onChange={(e) => setVoucherNumber(e.target.value)}
                          placeholder="Nº impreso en ticket (ej. 0482)"
                          className="h-9 text-xs bg-white dark:bg-slate-900 font-mono"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Nº del comprobante impreso (para cierre de caja).
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Últimos 4 Dígitos</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">(Opcional)</span>
                        </Label>
                        <Input
                          type="text"
                          maxLength={4}
                          value={lastFourDigits}
                          onChange={(e) => setLastFourDigits(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Terminación (ej. 4589)"
                          className="h-9 text-xs bg-white dark:bg-slate-900 font-mono"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                          Terminación del plástico (para control y respaldo).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabla de Obligaciones y Simulación de Pago */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 shadow-xs">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Obligaciones del Cliente ({debts.length})
                    </span>
                    {mode === 'auto' && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        (Priorizadas por vencimiento)
                      </span>
                    )}
                  </div>
                  {excessToStoreCredit > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-0 text-[10px] font-bold">
                      +{formatCurrency(excessToStoreCredit)} a Saldo a Favor
                    </Badge>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewAllocations.length > 0
                    ? previewAllocations.map(({ debt, allocated, newPending, isFullyPaid }) => {
                        const isRepair = debt.type === 'repair'
                        const isDelivered = isRepair && (debt.repairCategory === 'delivered_unpaid' || debt.operationalStatus === 'entregado')
                        const isReady = isRepair && (debt.repairCategory === 'ready_for_pickup' || debt.operationalStatus === 'listo')
                        const isInProgress = isRepair && !isDelivered && !isReady

                        return (
                          <div
                            key={debt.id}
                            className={cn(
                              'p-3.5 text-xs transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3',
                              allocated > 0
                                ? 'bg-purple-50/40 dark:bg-purple-950/10'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            )}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div
                                className={cn(
                                  'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                  isRepair
                                    ? isDelivered
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40'
                                      : isReady
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40'
                                )}
                              >
                                {isRepair ? (
                                  <Wrench className="h-4 w-4" />
                                ) : (
                                  <CreditCard className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="font-bold text-slate-900 dark:text-white truncate">
                                    {debt.title}
                                  </p>
                                  {isRepair ? (
                                    isDelivered ? (
                                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[9px] font-bold h-4 px-1.5">
                                        📦 Retirado (Entregado con saldo pendiente)
                                      </Badge>
                                    ) : isReady ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[9px] font-bold h-4 px-1.5">
                                        ✅ Listo en Taller (Pendiente de Retiro)
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[9px] font-bold h-4 px-1.5">
                                        🛠️ En Taller ({debt.operationalStatus === 'diagnostico' ? 'En Diagnóstico' : debt.operationalStatus === 'reparacion' ? 'En Reparación' : 'En Curso'})
                                      </Badge>
                                    )
                                  ) : (
                                    debt.isOverdue ? (
                                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 text-[9px] font-bold h-4 px-1.5">
                                        💳 Cuota Vencida
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 text-[9px] font-bold h-4 px-1.5">
                                        💳 Cuota al día
                                      </Badge>
                                    )
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate">{debt.subtitle}</p>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                  <span>Total: <strong className="text-slate-700 dark:text-slate-300">{formatCurrency(debt.totalAmount)}</strong></span>
                                  <span>·</span>
                                  <span>Abonado: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(debt.paidAmount)}</strong></span>
                                  {debt.debtReason && (
                                    <>
                                      <span>·</span>
                                      <span className="italic text-slate-600 dark:text-slate-400">{debt.debtReason}</span>
                                    </>
                                  )}
                                </div>

                                {allocated > 0 && isInProgress && (
                                  <div className="mt-1.5 p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[10.5px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span>
                                      <strong>Adelanto a Cuenta:</strong> Equipo aún en taller. El pago se guardará como anticipo y se descontará del saldo final al entregar.
                                    </span>
                                  </div>
                                )}

                                {allocated > 0 && isReady && (
                                  <div className="mt-1.5 p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[10.5px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>
                                      <strong>Equipo Listo en Taller:</strong> Al liquidar el saldo ({formatCurrency(newPending)}), el equipo quedará listo para retiro inmediato.
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                              {/* Botón contextual */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePaySingleDebt(debt)}
                                className={cn(
                                  "h-7 px-2.5 text-[11px] font-semibold transition-all",
                                  isInProgress
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
                                    : isReady
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
                                      : isDelivered
                                        ? "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200"
                                        : "bg-white hover:bg-purple-50 text-purple-700 border-purple-200 dark:bg-slate-900 dark:border-purple-800 dark:text-purple-300"
                                )}
                              >
                                {isInProgress ? 'Dar Adelanto' : isReady ? 'Liquidar y Retirar' : isDelivered ? 'Pagar Deuda' : 'Pagar Cuota'}
                              </Button>

                              {/* Deuda Original */}
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400">Saldo Actual</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                  {formatCurrency(debt.pendingAmount)}
                                </p>
                              </div>

                              {/* Abono asignado */}
                              {mode === 'auto' ? (
                                <div className="text-right min-w-[5.5rem]">
                                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                                    {isInProgress ? 'Adelanto' : 'Abono'}
                                  </p>
                                  <p className="font-bold text-purple-700 dark:text-purple-300 tabular-nums text-sm">
                                    {allocated > 0 ? `+${formatCurrency(allocated)}` : '-'}
                                  </p>
                                </div>
                              ) : (
                                <div className="w-28">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={manualAllocations[debt.id] ? manualAllocations[debt.id].toLocaleString('es-PY') : ''}
                                    onChange={(e) => handleManualAllocationChange(debt.id, e.target.value)}
                                    className="h-8 text-xs font-bold text-right tabular-nums"
                                  />
                                </div>
                              )}

                              {/* Saldo Resultante */}
                              <div className="text-right min-w-[5.5rem]">
                                <p className="text-[10px] text-slate-400">Saldo Final</p>
                                <p
                                  className={cn(
                                    'font-bold tabular-nums text-xs',
                                    isFullyPaid
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-900 dark:text-white'
                                  )}
                                >
                                  {isFullyPaid ? (
                                    isInProgress ? '100% Cubierto (Anticipo)' : isReady ? '0 Gs (Listo p/ Retiro)' : '0 Gs (Liquidado)'
                                  ) : (
                                    formatCurrency(newPending)
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    : debts.map((d) => {
                        const isRepair = d.type === 'repair'
                        const isDelivered = isRepair && (d.repairCategory === 'delivered_unpaid' || d.operationalStatus === 'entregado')
                        const isReady = isRepair && (d.repairCategory === 'ready_for_pickup' || d.operationalStatus === 'listo')
                        const isInProgress = isRepair && !isDelivered && !isReady

                        return (
                          <div
                            key={d.id}
                            className="p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div
                                className={cn(
                                  'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                  isRepair
                                    ? isDelivered
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40'
                                      : isReady
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40'
                                )}
                              >
                                {isRepair ? (
                                  <Wrench className="h-4 w-4" />
                                ) : (
                                  <CreditCard className="h-4 w-4" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="font-bold text-slate-900 dark:text-white">{d.title}</p>
                                  {isRepair ? (
                                    isDelivered ? (
                                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 text-[9px] font-bold">
                                        📦 Retirado (Entregado con saldo)
                                      </Badge>
                                    ) : isReady ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 text-[9px] font-bold">
                                        ✅ Listo en Taller (Pendiente de Retiro)
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 text-[9px] font-bold">
                                        🛠️ En Taller (En proceso)
                                      </Badge>
                                    )
                                  ) : (
                                    d.isOverdue ? (
                                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 text-[9px] font-bold">
                                        💳 Cuota Vencida
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 text-[9px] font-bold">
                                        💳 Cuota al día
                                      </Badge>
                                    )
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500">{d.subtitle}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>Total: {formatCurrency(d.totalAmount)}</span>
                                  <span>·</span>
                                  <span>Abonado: {formatCurrency(d.paidAmount)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePaySingleDebt(d)}
                                className={cn(
                                  "h-7 px-2.5 text-[11px] font-semibold",
                                  isInProgress
                                    ? "bg-amber-50 text-amber-800 border-amber-300"
                                    : isReady
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : isDelivered
                                        ? "bg-rose-50 text-rose-800 border-rose-300"
                                        : "text-purple-700 border-purple-200"
                                )}
                              >
                                {isInProgress ? 'Dar Adelanto' : isReady ? 'Liquidar y Retirar' : isDelivered ? 'Pagar Deuda' : 'Pagar Cuota'}
                              </Button>
                              <p className="font-bold text-slate-900 dark:text-white tabular-nums">
                                {formatCurrency(d.pendingAmount)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                </div>
              </div>

              {/* Botón de Confirmación */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={submitting || numericAmount <= 0}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold gap-2 px-6 shadow-md"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Procesando Cobro...
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4" />
                      Confirmar Abono de {formatCurrency(numericAmount)}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
