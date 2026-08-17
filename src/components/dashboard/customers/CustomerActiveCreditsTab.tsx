'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  MessageCircle, 
  ExternalLink, 
  Eye, 
  TrendingUp, 
  Users, 
  DollarSign,
  ArrowRight,
  Filter,
  CalendarClock,
  Coins
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { Customer } from '@/hooks/use-customer-state'
import type { CustomerCreditSummary } from '@/hooks/use-customer-credits'
import type { CreditRow, InstallmentRow } from '@/hooks/use-credits'
import { UpcomingInstallments } from '@/components/dashboard/credits/UpcomingInstallments'
import { CustomerCreditSheetModal } from './CustomerCreditSheetModal'
import { CustomerGlobalPaymentModal } from './CustomerGlobalPaymentModal'

interface CustomerActiveCreditsTabProps {
  customers: Customer[]
  creditSummaries: Record<string, CustomerCreditSummary>
  credits?: CreditRow[]
  installments?: InstallmentRow[]
  onViewCustomer: (customer: Customer) => void
  onMarkPaid?: (id: string, method: string, amount: number) => Promise<{ success: boolean; error?: string } | void>
  compact?: boolean
}

type FilterStatus = 'all' | 'overdue' | 'up_to_date' | 'upcoming'

export function CustomerActiveCreditsTab({
  customers,
  creditSummaries,
  credits = [],
  installments = [],
  onViewCustomer,
  onMarkPaid,
  compact = false
}: CustomerActiveCreditsTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [sheetCustomer, setSheetCustomer] = useState<Customer | null>(null)
  const [globalPaymentCustomer, setGlobalPaymentCustomer] = useState<Customer | null>(null)

  // Obtener clientes con créditos activos
  const customersWithCredits = useMemo(() => {
    return customers.filter(c => {
      const summary = creditSummaries[c.id]
      return summary && (summary.active_credits > 0 || summary.total_pending > 0)
    })
  }, [customers, creditSummaries])

  // Filtrado y búsqueda
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return customersWithCredits.filter(c => {
      const summary = creditSummaries[c.id]
      const isOverdue = summary?.next_payment?.is_overdue ?? false

      // Filtro por estado
      if (statusFilter === 'overdue' && !isOverdue) return false
      if (statusFilter === 'up_to_date' && isOverdue) return false

      // Búsqueda por texto
      if (!term) return true
      const matchesName = c.name?.toLowerCase().includes(term) ?? false
      const matchesCode = (c.customerCode || c.ruc || '').toLowerCase().includes(term)
      const matchesPhone = c.phone?.includes(term) ?? false
      const matchesEmail = c.email?.toLowerCase().includes(term) ?? false

      return matchesName || matchesCode || matchesPhone || matchesEmail
    })
  }, [customersWithCredits, creditSummaries, searchTerm, statusFilter])

  // Métricas agregadas
  const metrics = useMemo(() => {
    const summaries = Object.values(creditSummaries)
    const totalPending = summaries.reduce((acc, s) => acc + (s.total_pending || 0), 0)
    const totalPrincipal = summaries.reduce((acc, s) => acc + (s.total_principal || 0), 0)
    const totalActiveCredits = summaries.reduce((acc, s) => acc + (s.active_credits || 0), 0)
    const overdueCustomers = summaries.filter(s => s.next_payment?.is_overdue).length
    const totalLimit = summaries.reduce((acc, s) => acc + (s.credit_limit || 0), 0)
    const utilizationRate = totalLimit > 0 ? Math.round((totalPending / totalLimit) * 100) : 0

    return {
      totalPending,
      totalPrincipal,
      totalActiveCredits,
      overdueCustomers,
      utilizationRate,
      totalCustomers: customersWithCredits.length
    }
  }, [creditSummaries, customersWithCredits.length])

  const creditById = useMemo(() => {
    const map: Record<string, CreditRow> = {}
    credits.forEach(c => { map[c.id] = c })
    return map
  }, [credits])

  const getWhatsAppPaymentReminder = (customer: Customer, summary: CustomerCreditSummary) => {
    if (!customer.phone) return null
    let digits = customer.phone.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '595' + digits.slice(1)
    }
    const amountStr = summary.next_payment?.amount 
      ? formatCurrency(summary.next_payment.amount) 
      : formatCurrency(summary.total_pending)
    const dateStr = summary.next_payment?.due_date 
      ? new Date(summary.next_payment.due_date).toLocaleDateString('es-PY') 
      : 'próximo vencimiento'

    const isOverdue = summary.next_payment?.is_overdue
    const text = isOverdue
      ? encodeURIComponent(`Hola ${customer.name}, te recordamos que tienes una cuota vencida de ${amountStr} (vencimiento: ${dateStr}). Por favor comunícate para coordinar tu pago. ¡Muchas gracias!`)
      : encodeURIComponent(`Hola ${customer.name}, te recordamos que tu próxima cuota es de ${amountStr} con fecha límite ${dateStr}. ¡Gracias por tu preferencia!`)

    return `https://wa.me/${digits}?text=${text}`
  }

  return (
    <div className="space-y-4">
      {/* Tarjetas de Métricas de Cartera Crediticia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Saldo Pendiente */}
        <Card className="rounded-2xl border border-rose-200/50 dark:border-rose-900/40 bg-gradient-to-br from-rose-500/10 via-card to-card overflow-hidden shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Saldo Pendiente Total
              </span>
              <div className="h-8 w-8 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              En {metrics.totalActiveCredits} créditos activos
            </p>
          </CardContent>
        </Card>

        {/* Cuotas Vencidas / Clientes en Mora */}
        <Card className="rounded-2xl border border-amber-200/50 dark:border-amber-900/40 bg-gradient-to-br from-amber-500/10 via-card to-card overflow-hidden shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Clientes en Mora
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {metrics.overdueCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.overdueCustomers > 0 ? 'Requieren recordatorio urgente' : 'Cartera 100% al día'}
            </p>
          </CardContent>
        </Card>

        {/* Clientes con Crédito Activo */}
        <Card className="rounded-2xl border border-blue-200/50 dark:border-blue-900/40 bg-gradient-to-br from-blue-500/10 via-card to-card overflow-hidden shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Clientes Financiados
              </span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {metrics.totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              Con saldo o préstamos abiertos
            </p>
          </CardContent>
        </Card>

        {/* Utilización de Límites */}
        <Card className="rounded-2xl border border-purple-200/50 dark:border-purple-900/40 bg-gradient-to-br from-purple-500/10 via-card to-card overflow-hidden shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Uso de Línea de Crédito
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {metrics.utilizationRate}%
            </div>
            <Progress value={Math.min(100, metrics.utilizationRate)} className="h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, teléfono o CI/RUC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-border/80"
              />
            </div>

            {/* Selector de Estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="h-8 text-xs font-semibold rounded-lg"
              >
                Todos ({customersWithCredits.length})
              </Button>
              <Button
                variant={statusFilter === 'overdue' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('overdue')}
                className={cn(
                  "h-8 text-xs font-semibold rounded-lg gap-1.5",
                  statusFilter === 'overdue' ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-rose-600 dark:text-rose-400 border-rose-500/30"
                )}
              >
                <AlertTriangle className="h-3 w-3" />
                Vencidos ({metrics.overdueCustomers})
              </Button>
              <Button
                variant={statusFilter === 'up_to_date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('up_to_date')}
                className={cn(
                  "h-8 text-xs font-semibold rounded-lg gap-1.5",
                  statusFilter === 'up_to_date' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                Al Día ({Math.max(0, customersWithCredits.length - metrics.overdueCustomers)})
              </Button>

              {installments.length > 0 && (
                <Button
                  variant={statusFilter === 'upcoming' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('upcoming')}
                  className="h-8 text-xs font-semibold rounded-lg gap-1.5 ml-auto text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                >
                  <CalendarClock className="h-3 w-3" />
                  Próximos Vencimientos
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de Próximos Vencimientos si está seleccionada */}
      {statusFilter === 'upcoming' && installments.length > 0 ? (
        <Card className="border border-border/80 bg-card rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="p-4 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-indigo-500" />
                Calendario de Vencimiento de Cuotas
              </span>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 dark:text-indigo-400 gap-1">
                <Link href="/dashboard/credits">
                  Ir al módulo de créditos
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <UpcomingInstallments
              installments={installments}
              creditById={creditById}
              onMarkPaid={onMarkPaid || (async () => {})}
            />
          </CardContent>
        </Card>
      ) : (
        /* Tabla de Clientes con Créditos Activos */
        <Card className="overflow-hidden border border-border bg-card rounded-2xl shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="py-3 pl-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cliente
                    </TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Créditos Activos
                    </TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Saldo Deudor Total
                    </TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Límite de Crédito
                    </TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Próximo Vencimiento
                    </TableHead>
                    <TableHead className="py-3 pr-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Acciones de Cobro
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-36 text-center text-muted-foreground text-xs">
                        No se encontraron clientes con créditos en este filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const summary = creditSummaries[customer.id]
                      const nextPayment = summary?.next_payment
                      const isOverdue = nextPayment?.is_overdue ?? false
                      const whatsappReminderUrl = summary ? getWhatsAppPaymentReminder(customer, summary) : null

                      return (
                        <TableRow 
                          key={customer.id}
                          className="hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/60"
                          onClick={() => setSheetCustomer(customer)}
                        >
                          {/* Cliente */}
                          <TableCell className="py-3 pl-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/80 shrink-0">
                                <AvatarImage src={customer.avatar} />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs">
                                  {(customer.name || 'C').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate flex items-center gap-1.5 text-xs sm:text-sm">
                                  {customer.name}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground">
                                  {customer.customerCode || customer.ruc || 'S/C'}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Créditos Activos */}
                          <TableCell className="py-3">
                            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary font-bold text-xs">
                              {summary?.active_credits ?? 0} activo{(summary?.active_credits ?? 0) !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>

                          {/* Saldo Deudor Total */}
                          <TableCell className="py-3">
                            <div className="font-bold text-rose-600 dark:text-rose-400 text-sm tabular-nums">
                              {formatCurrency(summary?.total_pending ?? 0)}
                            </div>
                            <div className="text-[10.5px] text-muted-foreground">
                              Pagado: {formatCurrency(summary?.total_paid ?? 0)}
                            </div>
                          </TableCell>

                          {/* Límite de Crédito */}
                          <TableCell className="py-3">
                            <div className="text-xs font-semibold text-foreground tabular-nums">
                              {summary?.credit_limit ? formatCurrency(summary.credit_limit) : 'Sin límite'}
                            </div>
                            {summary?.credit_limit && summary.credit_limit > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                {Math.round(((summary.total_pending || 0) / summary.credit_limit) * 100)}% ocupado
                              </div>
                            )}
                          </TableCell>

                          {/* Próximo Vencimiento */}
                          <TableCell className="py-3">
                            {nextPayment ? (
                              <div className="space-y-0.5">
                                <div className={cn(
                                  "text-xs font-bold flex items-center gap-1",
                                  isOverdue ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {new Date(nextPayment.due_date).toLocaleDateString('es-PY')}
                                </div>
                                <div className="text-[10.5px] text-muted-foreground">
                                  Cuota: {formatCurrency(nextPayment.amount)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin cuotas pendientes</span>
                            )}
                          </TableCell>

                          {/* Acciones de Cobro */}
                          <TableCell className="py-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {whatsappReminderUrl && (
                                <a
                                  href={whatsappReminderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold transition-colors"
                                  title="Enviar recordatorio de cobro por WhatsApp"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                  Recordar
                                </a>
                              )}
                              <Button
                                size="sm"
                                onClick={() => setGlobalPaymentCustomer(customer)}
                                className="h-7 px-2.5 text-xs font-bold rounded-lg gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs"
                                title="Cobro unificado a cuenta"
                              >
                                <Coins className="h-3 w-3" />
                                Cobrar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSheetCustomer(customer)}
                                className="h-7 px-2.5 text-xs font-semibold rounded-lg gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                Ficha
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer informativo con enlace directo */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/60 rounded-2xl text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard className="h-4 w-4 text-primary" />
          <span>Gestiona contratos, amortizaciones y refinanciaciones completas en el módulo principal de créditos.</span>
        </div>
        <Button asChild size="sm" variant="default" className="h-8 gap-1.5 rounded-xl text-xs font-semibold">
          <Link href="/dashboard/credits">
            Módulo de Créditos
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Modal Ficha de Crédito 360 */}
      <CustomerCreditSheetModal
        customer={sheetCustomer}
        open={!!sheetCustomer}
        onClose={() => setSheetCustomer(null)}
        creditSummary={sheetCustomer ? creditSummaries[sheetCustomer.id] : null}
        onMarkPaid={onMarkPaid}
      />

      {/* Modal Cobro Unificado / Abono Global */}
      <CustomerGlobalPaymentModal
        customer={globalPaymentCustomer}
        open={!!globalPaymentCustomer}
        onClose={() => setGlobalPaymentCustomer(null)}
        onSuccess={() => {
          setGlobalPaymentCustomer(null)
          // El usuario podrá ver la actualización en el dashboard
        }}
      />
    </div>
  )
}
