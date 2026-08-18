"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Target,
  Shield,
  AlertCircle,
  Info,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  Eye,
  ExternalLink,
  Download,
  RefreshCw,
  Coins,
  Wallet,
  Wrench,
  Receipt,
  CheckCircle2,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCustomerCredits, CustomerCreditSummary, DebtItem } from '@/hooks/use-customer-credits'
import { Customer } from '@/hooks/use-customer-state'

interface CustomerCreditInfoProps {
  customer: Customer
  compact?: boolean
  showActions?: boolean
  onOpenPayment?: () => void
  onEditCustomer?: () => void
}

export function CustomerCreditInfo({ customer, compact = false, showActions = true, onOpenPayment, onEditCustomer }: CustomerCreditInfoProps) {
  const { loading, error, creditSummary, credits, installments, payments, refresh } = useCustomerCredits(customer.id, customer)
  const [activeTab, setActiveTab] = useState('resumen')

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    )
  }

  // Sin resumen hay dos situaciones distintas que se veian igual: un cliente sin
  // creditos, y una carga que fallo. En el segundo caso el respaldo de abajo
  // mostraba el limite completo como disponible, afirmando con seguridad un
  // numero que nadie verifico.
  if (error && !creditSummary) {
    return (
      <Card className="border-amber-300/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardContent role="alert" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                No pudimos cargar la situación crediticia
              </p>
              <p className="text-sm text-amber-800/90 dark:text-amber-200/80">
                No mostramos el cupo disponible para no darte un número equivocado. {error}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Cliente sin creditos: el respaldo es correcto, tiene todo su cupo libre.
  const summary: CustomerCreditSummary = creditSummary || {
    customer_id: customer.id,
    total_credits: 0,
    active_credits: 0,
    completed_credits: 0,
    defaulted_credits: 0,
    total_principal: 0,
    total_paid: 0,
    total_pending: 0,
    current_balance: 0,
    credit_limit: Number(customer.credit_limit || 0),
    available_credit: Number(customer.credit_limit || 0),
    credit_utilization: 0,
    store_balance: 0,
    store_reserved: 0,
    overdue_debt: 0,
    debts: [],
    payment_history: {
      on_time_payments: 0,
      late_payments: 0,
      missed_payments: 0,
      payment_score: 100
    },
    next_payment: null,
    risk_assessment: {
      risk_level: 'low',
      risk_score: 0,
      factors: ['Sin deudas registradas']
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
      case 'medium': return 'text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
      case 'high': return 'text-orange-700 bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300'
      case 'critical': return 'text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
      default: return 'text-slate-700 bg-slate-100 border-slate-300'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'medium': return <Info className="h-4 w-4 text-amber-600" />
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'critical': return <AlertCircle className="h-4 w-4 text-rose-600" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  const getPaymentScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 70) return 'text-blue-600 dark:text-blue-400'
    if (score >= 50) return 'text-amber-600 dark:text-amber-400'
    return 'text-rose-600 dark:text-rose-400'
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ─── TARJETA PRINCIPAL DE RESUMEN FINANCIERO ─── */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-slate-900 to-indigo-950 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <CardHeader className="pb-4 relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
                  <CreditCard className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    Estado de Créditos y Finanzas
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-300">
                    Línea de crédito comercial, deudas activas y saldo a favor
                  </CardDescription>
                </div>
              </div>

              {showActions && (
                <div className="flex items-center gap-2">
                  {onOpenPayment && (
                    <Button
                      size="sm"
                      onClick={onOpenPayment}
                      className="gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-md shadow-emerald-950/40 text-xs px-3.5"
                    >
                      <Coins className="h-4 w-4" />
                      Cobrar / Abonar Deuda
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs"
                    onClick={refresh}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Actualizar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="relative z-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-xs border border-white/10">
              {/* Límite de Crédito */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs text-slate-300 font-medium block">Límite Autorizado</span>
                  {onEditCustomer && (
                    <button
                      type="button"
                      onClick={onEditCustomer}
                      className="text-[10px] text-blue-300 hover:text-blue-200 underline font-medium"
                    >
                      {summary.credit_limit > 0 ? 'Editar' : '+ Asignar'}
                    </button>
                  )}
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                  {formatCurrency(summary.credit_limit)}
                </div>
                <span className="text-[11px] text-slate-400">
                  {summary.credit_limit > 0 ? 'Crédito activo para POS' : 'Sin línea asignada (0 Gs)'}
                </span>
              </div>

              {/* Deuda Total Activa */}
              <div>
                <span className="text-xs text-slate-300 font-medium block mb-1">Deuda Pendiente Total</span>
                <div className={cn("text-xl sm:text-2xl font-bold font-mono", summary.total_pending > 0 ? "text-amber-400" : "text-emerald-400")}>
                  {formatCurrency(summary.total_pending)}
                </div>
                <span className="text-[11px] text-slate-400">
                  {summary.overdue_debt > 0 ? `⚠️ ${formatCurrency(summary.overdue_debt)} en mora` : 'Al día'}
                </span>
              </div>

              {/* Crédito Disponible */}
              <div>
                <span className="text-xs text-slate-300 font-medium block mb-1">Crédito Disponible</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
                  {formatCurrency(summary.available_credit)}
                </div>
                <span className="text-[11px] text-slate-400">
                  {summary.credit_limit > 0 ? `${100 - summary.credit_utilization}% libre` : '0 Gs disponible'}
                </span>
              </div>

              {/* Saldo a Favor / Billetera */}
              <div>
                <span className="text-xs text-slate-300 font-medium block mb-1">Saldo a Favor (Billetera)</span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300">
                  {formatCurrency(summary.store_balance)}
                </div>
                {/* Lo reservado por pedidos web pendientes no se puede gastar en
                    el mostrador: decirlo evita prometer un saldo que no esta. */}
                <span className="text-[11px] text-slate-400">
                  {summary.store_reserved > 0
                    ? `${formatCurrency(summary.store_reserved)} reservado en pedidos`
                    : 'Disponible para compras'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── PESTAÑAS DETALLADAS ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <TabsTrigger value="resumen" className="rounded-lg text-xs font-semibold">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="deudas" className="rounded-lg text-xs font-semibold relative">
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Deudas Activas
              {summary.debts && summary.debts.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                  {summary.debts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="creditos" className="rounded-lg text-xs font-semibold">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Financiaciones ({credits.length})
            </TabsTrigger>
            <TabsTrigger value="pagos" className="rounded-lg text-xs font-semibold">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Historial Pagos
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: RESUMEN FINANCIERO ─── */}
          <TabsContent value="resumen" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Utilización de Línea de Crédito */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      Utilización de Línea de Crédito
                    </span>
                    <Badge variant={summary.credit_utilization > 80 ? "destructive" : summary.credit_utilization > 50 ? "secondary" : "default"}>
                      {summary.credit_utilization}% Utilizado
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Límite Autorizado:</span>
                      <span className="font-bold font-mono">{formatCurrency(summary.credit_limit)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Deuda / Utilizado:</span>
                      <span className="font-bold font-mono text-amber-600 dark:text-amber-400">{formatCurrency(summary.total_pending)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Disponible para Compras:</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.available_credit)}</span>
                    </div>
                  </div>

                  <Progress 
                    value={summary.credit_utilization} 
                    className={cn(
                      "h-2.5 rounded-full",
                      summary.credit_utilization > 80 ? "[&>div]:bg-rose-500" : summary.credit_utilization > 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
                    )}
                  />

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {summary.credit_limit > 0
                      ? 'El cliente puede retirar mercaderías y servicios a crédito hasta agotar su límite disponible.'
                      : 'Este cliente aún no tiene un límite de crédito configurado. Puedes asignarlo desde el botón Editar Cliente.'}
                  </p>
                </CardContent>
              </Card>

              {/* Próximo Pago / Estado de Vencimiento */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    Estado de Vencimientos y Próximo Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.next_payment ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Concepto:</span>
                        <span className="font-bold">{summary.next_payment.title || 'Cuota / Saldo pendiente'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Monto Pendiente:</span>
                        <span className="font-bold font-mono text-base text-slate-900 dark:text-white">
                          {formatCurrency(summary.next_payment.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fecha de Vencimiento:</span>
                        <span className="font-medium">
                          {new Date(summary.next_payment.due_date).toLocaleDateString('es-PY')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500">Condición:</span>
                        {summary.next_payment.is_overdue ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Vencido
                          </Badge>
                        ) : summary.next_payment.days_until_due <= 3 ? (
                          <Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-800 border-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            Vence en {summary.next_payment.days_until_due} días
                          </Badge>
                        ) : (
                          <Badge variant="default" className="gap-1 text-xs bg-emerald-100 text-emerald-800 border-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Al Día (Vence en {summary.next_payment.days_until_due} días)
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-900 dark:text-white">No registra pagos pendientes</p>
                      <p className="text-xs text-slate-500 mt-0.5">El cliente está completamente al día con sus cuentas.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Conducta y Evaluación de Riesgo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Score de Pago */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    Historial y Puntualidad de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {summary.payment_history.on_time_payments}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">A Tiempo</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60">
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {summary.payment_history.late_payments}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">Tardíos</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60">
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                        {summary.payment_history.missed_payments}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">En Mora</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Puntaje Crediticio Estimado:</span>
                    <span className={cn("text-xl font-bold font-mono", getPaymentScoreColor(summary.payment_history.payment_score))}>
                      {summary.payment_history.payment_score} / 100
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Evaluación de Riesgo */}
              <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-600" />
                    Evaluación de Riesgo Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Nivel de Riesgo:</span>
                    <Badge className={cn("gap-1.5 font-bold text-xs", getRiskColor(summary.risk_assessment.risk_level))}>
                      {getRiskIcon(summary.risk_assessment.risk_level)}
                      {summary.risk_assessment.risk_level === 'low' ? 'Bajo (Confiable)' :
                       summary.risk_assessment.risk_level === 'medium' ? 'Medio (Precaución)' :
                       summary.risk_assessment.risk_level === 'high' ? 'Alto (Restringir)' : 'Crítico (Bloqueado)'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Factores Analizados:</span>
                    <div className="space-y-1">
                      {summary.risk_assessment.factors.map((factor, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── TAB 2: DEUDAS Y COMPROMISOS ACTIVOS ─── */}
          <TabsContent value="deudas" className="space-y-4">
            {summary.debts && summary.debts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {summary.debts.length} Deuda(s) pendiente(s) registrada(s)
                  </h4>
                  {onOpenPayment && (
                    <Button
                      size="sm"
                      onClick={onOpenPayment}
                      className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Coins className="h-3.5 w-3.5" />
                      Pagar Todas las Deudas
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {summary.debts.map((debt) => (
                    <Card key={debt.id} className="border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl mt-0.5",
                              debt.type === 'repair' ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40"
                            )}>
                              {debt.type === 'repair' ? <Wrench className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{debt.title}</h4>
                                {debt.repairCategory === 'in_progress' && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                    🛠️ En Taller (En Curso)
                                  </Badge>
                                )}
                                {debt.repairCategory === 'ready_for_pickup' && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                    ✅ Listo en Taller
                                  </Badge>
                                )}
                                {debt.repairCategory === 'delivered_unpaid' && (
                                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
                                    📦 Retirado con Saldo
                                  </Badge>
                                )}
                                {debt.isOverdue && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    ⚠️ Vencido
                                  </Badge>
                                )}
                              </div>
                              {debt.subtitle && (
                                <p className="text-xs text-slate-500 mt-0.5">{debt.subtitle}</p>
                              )}
                              {debt.debtReason && (
                                <p className="text-[11px] text-slate-400 italic mt-0.5">Motivo: {debt.debtReason}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block">Saldo a Pagar</span>
                              <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                                {formatCurrency(debt.pendingAmount)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Total: {formatCurrency(debt.totalAmount)} {debt.paidAmount > 0 ? `(Abonado: ${formatCurrency(debt.paidAmount)})` : ''}
                              </span>
                            </div>

                            {onOpenPayment && (
                              <Button
                                size="sm"
                                onClick={onOpenPayment}
                                className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1"
                              >
                                <Coins className="h-3.5 w-3.5" />
                                Abonar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    ¡Cliente al Día!
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Este cliente no posee ninguna deuda pendiente por reparaciones ni cuotas atrasadas.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TAB 3: CONTRATOS DE FINANCIACIÓN ─── */}
          <TabsContent value="creditos" className="space-y-4">
            {credits.length > 0 ? (
              <div className="space-y-3">
                {credits.map((credit) => (
                  <Card key={credit.id} className="border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">Crédito #{credit.id.slice(-6)}</h4>
                          <Badge variant={credit.status === 'active' ? 'default' : credit.status === 'completed' ? 'secondary' : 'destructive'}>
                            {credit.status === 'active' ? 'Activo' : credit.status === 'completed' ? 'Completado' : 'En Mora'}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500">
                          Inicio: {new Date(credit.start_date).toLocaleDateString('es-PY')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-xs">
                        <div>
                          <span className="text-slate-500 block">Monto Principal:</span>
                          <span className="font-bold font-mono">{formatCurrency(credit.principal)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Tasa de Interés:</span>
                          <span className="font-bold">{credit.interest_rate}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Plazo:</span>
                          <span className="font-bold">{credit.term_months} meses</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Estado:</span>
                          <span className="font-bold uppercase text-[11px]">{credit.status}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-dashed border-slate-300 dark:border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CreditCard className="h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Sin contratos de financiación formal</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    No se han registrado planes de crédito a cuotas para este cliente.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── TAB 4: HISTORIAL DE PAGOS ─── */}
          <TabsContent value="pagos" className="space-y-4">
            {payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <Card key={payment.id} className="border border-slate-200 dark:border-slate-800 shadow-xs">
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(payment.created_at).toLocaleDateString('es-PY')} • 
                            {payment.payment_method === 'cash' ? ' Efectivo' : 
                             payment.payment_method === 'card' ? ' Tarjeta' : 
                             payment.payment_method === 'transfer' ? ' Transferencia' : ' Pago a cuenta'}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {payment.credit_id ? `Crédito #${payment.credit_id.slice(-6)}` : 'Abono'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border border-dashed border-slate-300 dark:border-slate-800">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-white">No hay pagos registrados en cuotas</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Los abonos procesados aparecerán listados aquí.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}