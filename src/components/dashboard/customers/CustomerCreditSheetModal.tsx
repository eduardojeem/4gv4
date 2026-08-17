'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  Phone,
  Mail,
  Copy,
  DollarSign,
  Calendar,
  ShieldCheck,
  TrendingUp,
  Receipt,
  FileText,
  Download,
  ExternalLink,
  ShoppingBag,
  RefreshCw,
  X,
  Loader2,
  Coins
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useCustomerCredits } from '@/hooks/use-customer-credits'
import type { Customer } from '@/hooks/use-customer-state'
import type { CustomerCreditSummary, InstallmentInfo } from '@/hooks/use-customer-credits'
import { CustomerGlobalPaymentModal } from './CustomerGlobalPaymentModal'

interface CustomerCreditSheetModalProps {
  customer: Customer | null
  open: boolean
  onClose: () => void
  creditSummary?: CustomerCreditSummary | null
  onMarkPaid?: (id: string, method: string, amount: number) => Promise<{ success: boolean; error?: string } | void>
}

export function CustomerCreditSheetModal({
  customer,
  open,
  onClose,
  creditSummary: propSummary,
  onMarkPaid
}: CustomerCreditSheetModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('installments')
  const [payingInst, setPayingInst] = useState<InstallmentInfo | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [globalPaymentOpen, setGlobalPaymentOpen] = useState(false)

  const {
    loading,
    creditSummary: hookSummary,
    credits,
    installments,
    payments,
    refresh
  } = useCustomerCredits(customer?.id || '')

  const summary = hookSummary || propSummary

  const handleOpenPay = (inst: InstallmentInfo) => {
    const outstanding = Math.max(0, Number(inst.amount) - Number(inst.amount_paid || 0))
    setPayingInst(inst)
    setPaymentMethod('cash')
    setPaymentAmount(String(outstanding))
  }

  const handleConfirmPay = async () => {
    if (!payingInst || !onMarkPaid) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Ingresa un monto de pago válido')
      return
    }

    try {
      setIsSubmittingPayment(true)
      const res = await onMarkPaid(payingInst.id, paymentMethod, amt)
      if (res && typeof res === 'object' && res.success === false) {
        toast.error(res.error || 'Error al registrar el pago')
        return
      }
      toast.success(`Pago de ${formatCurrency(amt)} registrado exitosamente`)
      setPayingInst(null)
      refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Error al procesar el pago')
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado al portapapeles`)
  }

  const getWhatsAppUrl = () => {
    if (!customer?.phone) return null
    let digits = customer.phone.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '595' + digits.slice(1)
    }
    const amount = summary?.next_payment?.amount 
      ? formatCurrency(summary.next_payment.amount) 
      : summary?.total_pending 
        ? formatCurrency(summary.total_pending) 
        : '0 Gs'
    const date = summary?.next_payment?.due_date 
      ? new Date(summary.next_payment.due_date).toLocaleDateString('es-PY') 
      : 'próximo vencimiento'

    const isOverdue = summary?.next_payment?.is_overdue
    const text = isOverdue
      ? encodeURIComponent(`Hola ${customer.name}, te recordamos que tienes una cuota pendiente vencida por ${amount} (fecha de vencimiento: ${date}). Por favor indícanos cuándo podemos coordinar tu pago. ¡Muchas gracias!`)
      : encodeURIComponent(`Hola ${customer.name}, te informamos que tu próxima cuota por ${amount} vence el ${date}. ¡Gracias por tu preferencia!`)

    return `https://wa.me/${digits}?text=${text}`
  }

  const exportCreditSheetCSV = () => {
    if (!customer || !summary) return

    const headers = ['Nro Cuota', 'Fecha Vencimiento', 'Monto Cuota', 'Monto Pagado', 'Estado', 'Método de Pago']
    const rows = installments.map(i => [
      i.installment_number,
      i.due_date ? new Date(i.due_date).toLocaleDateString('es-PY') : '-',
      i.amount,
      i.amount_paid || 0,
      i.status === 'paid' ? 'Pagado' : i.status === 'late' ? 'Vencido' : 'Pendiente',
      i.payment_method || '-'
    ])

    const BOM = '\uFEFF'
    const csvContent = BOM + [
      `FICHA CREDITICIA - ${customer.name}`,
      `Documento: ${customer.customerCode || customer.ruc || 'S/C'}`,
      `Saldo Pendiente: ${summary.total_pending}`,
      `Límite de Crédito: ${summary.credit_limit}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ficha_credito_${customer.name.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Ficha crediticia exportada en CSV')
  }

  if (!customer) return null

  const whatsappUrl = getWhatsAppUrl()
  const utilization = summary?.credit_utilization ?? 
    (summary?.credit_limit && summary.credit_limit > 0 
      ? Math.round(((summary.total_pending || 0) / summary.credit_limit) * 100) 
      : 0)

  const score = summary?.payment_history?.payment_score ?? 85

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Ficha Crediticia de {customer.name}</DialogTitle>
          <DialogDescription>Detalle, cuotas y estado de cuenta crediticia del cliente</DialogDescription>
        </DialogHeader>

        {/* Header con Datos del Cliente */}
        <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white/20 shadow-md">
                <AvatarImage src={customer.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                  {(customer.name || 'C').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {customer.name}
                  </h2>
                  {customer.segment === 'vip' && (
                    <Badge className="bg-amber-400 text-amber-950 font-bold text-[10px] uppercase">
                      VIP
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-white/80 border-white/20 text-xs">
                    {customer.customerCode || customer.ruc || 'S/C'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-white/70">
                  {customer.phone && (
                    <div 
                      onClick={() => handleCopy(customer.phone!, 'Teléfono')}
                      className="flex items-center gap-1 hover:text-white cursor-pointer group"
                      title="Copiar teléfono"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{customer.phone}</span>
                      <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                  {customer.email && (
                    <div 
                      onClick={() => handleCopy(customer.email!, 'Email')}
                      className="flex items-center gap-1 hover:text-white cursor-pointer group"
                      title="Copiar email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[180px]">{customer.email}</span>
                      <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones del Header */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <Button
                size="sm"
                onClick={() => setGlobalPaymentOpen(true)}
                className="h-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold gap-1.5 rounded-xl shadow-sm"
              >
                <Coins className="h-3.5 w-3.5" />
                Abonar a Deuda
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs font-semibold gap-1.5 rounded-xl"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Actualizar
              </Button>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 text-xs font-bold shadow-sm transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* KPI Bar en Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/70">
                Deuda Total
              </div>
              <div className="text-lg font-bold text-rose-300 tabular-nums">
                {formatCurrency(summary?.total_pending ?? 0)}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/70">
                Límite de Crédito
              </div>
              <div className="text-lg font-bold text-white tabular-nums">
                {summary?.credit_limit ? formatCurrency(summary.credit_limit) : 'Sin Límite'}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/70">
                Total Pagado
              </div>
              <div className="text-lg font-bold text-emerald-300 tabular-nums">
                {formatCurrency(summary?.total_paid ?? 0)}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/70">
                Score de Pago
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-lg font-bold",
                  score >= 80 ? "text-emerald-300" : score >= 60 ? "text-amber-300" : "text-rose-300"
                )}>
                  {score}/100
                </span>
                <Badge className={cn(
                  "text-[9px] font-bold px-1.5 py-0",
                  score >= 80 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                )}>
                  {score >= 80 ? 'Seguro' : score >= 60 ? 'Moderado' : 'Riesgo'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo del Modal con Pestañas */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Barra de progreso de línea de crédito */}
          {summary?.credit_limit && summary.credit_limit > 0 && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Utilización de Línea de Crédito</span>
                <span className="font-mono text-muted-foreground">{utilization}% utilizado</span>
              </div>
              <Progress value={Math.min(100, utilization)} className="h-2" />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="installments" className="text-xs font-semibold rounded-lg gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Cuotas ({installments.length})
              </TabsTrigger>
              <TabsTrigger value="credits" className="text-xs font-semibold rounded-lg gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Créditos ({credits.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs font-semibold rounded-lg gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Historial de Pagos ({payments.length})
              </TabsTrigger>
            </TabsList>

            {/* Pestaña: Cuotas y Vencimientos */}
            <TabsContent value="installments" className="mt-4 space-y-3">
              <div className="overflow-x-auto border border-border rounded-xl">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border">
                      <TableHead className="py-2.5 text-xs font-bold">N° Cuota</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Vencimiento</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Monto</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Pagado</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Estado</TableHead>
                      <TableHead className="py-2.5 pr-3 text-right text-xs font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                          No hay cuotas registradas para este cliente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      installments.map((inst) => {
                        const isPaid = inst.status === 'paid'
                        const isLate = inst.status === 'late' || (!isPaid && new Date(inst.due_date) < new Date())

                        return (
                          <TableRow key={inst.id} className="border-b border-border/60 text-xs">
                            <TableCell className="font-semibold">
                              Cuota #{inst.installment_number}
                            </TableCell>
                            <TableCell className="font-mono">
                              {inst.due_date ? new Date(inst.due_date).toLocaleDateString('es-PY') : '-'}
                            </TableCell>
                            <TableCell className="font-bold tabular-nums">
                              {formatCurrency(inst.amount)}
                            </TableCell>
                            <TableCell className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(inst.amount_paid || 0)}
                            </TableCell>
                            <TableCell>
                              {isPaid ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Pagado
                                </Badge>
                              ) : isLate ? (
                                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-bold">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Vencido
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-3">
                              {isPaid ? (
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  ✓ Liquidado
                                </span>
                              ) : (
                                onMarkPaid && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPay(inst)}
                                    className="h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                                  >
                                    <DollarSign className="h-3 w-3 mr-0.5" />
                                    Cobrar
                                  </Button>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Modal de Cobro Rápido de Cuota */}
              {payingInst && (
                <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-700/50 space-y-3 mt-3 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Registrar Pago de Cuota #{payingInst.installment_number}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPayingInst(null)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        Método de Pago
                      </label>
                      <Select
                        value={paymentMethod}
                        onValueChange={(v: 'cash' | 'card' | 'transfer') => setPaymentMethod(v)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="card">Tarjeta de Débito/Crédito</SelectItem>
                          <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        Monto a Cobrar (Gs.)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-slate-900 tabular-nums font-bold"
                        placeholder="Monto"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        disabled={isSubmittingPayment}
                        onClick={handleConfirmPay}
                        className="flex-1 h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isSubmittingPayment ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Confirmar Pago
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPayingInst(null)}
                        className="h-8 text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Pestaña: Créditos Activos */}
            <TabsContent value="credits" className="mt-4 space-y-3">
              <div className="overflow-x-auto border border-border rounded-xl">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border">
                      <TableHead className="py-2.5 text-xs font-bold">ID / Fecha</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Monto Financiado</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Tasa</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Plazo</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                          No hay créditos abiertos para este cliente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      credits.map((cr) => (
                        <TableRow key={cr.id} className="border-b border-border/60 text-xs">
                          <TableCell className="font-mono">
                            <div className="font-semibold">#{cr.id.slice(-6)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {cr.created_at ? new Date(cr.created_at).toLocaleDateString('es-PY') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold tabular-nums">
                            {formatCurrency(cr.principal)}
                          </TableCell>
                          <TableCell>{cr.interest_rate ?? 0}%</TableCell>
                          <TableCell>{cr.term_months ?? 1} meses</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-bold uppercase">
                              {cr.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Pestaña: Historial de Pagos */}
            <TabsContent value="payments" className="mt-4 space-y-3">
              <div className="overflow-x-auto border border-border rounded-xl">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border">
                      <TableHead className="py-2.5 text-xs font-bold">Fecha</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Monto Abonado</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Método</TableHead>
                      <TableHead className="py-2.5 text-xs font-bold">Referencia / Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                          No hay registros de pagos previos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p) => (
                        <TableRow key={p.id} className="border-b border-border/60 text-xs">
                          <TableCell className="font-mono">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('es-PY') : '-'}
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell className="uppercase font-semibold">
                            {p.payment_method || 'Efectivo'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer con Acciones Rápidas */}
        <DialogFooter className="p-4 sm:p-5 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCreditSheetCSV}
            className="w-full sm:w-auto h-9 text-xs font-semibold gap-1.5 rounded-xl"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar Ficha CSV
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                router.push(`/dashboard/pos?customerId=${customer.id}`)
              }}
              className="h-9 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Cobrar en POS
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onClose}
              className="h-9 text-xs font-semibold rounded-xl"
            >
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Modal Abono Global / Cobro Unificado */}
      <CustomerGlobalPaymentModal
        customer={customer}
        open={globalPaymentOpen}
        onClose={() => setGlobalPaymentOpen(false)}
        onSuccess={() => {
          refresh()
        }}
      />
    </Dialog>
  )
}
