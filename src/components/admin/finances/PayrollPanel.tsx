'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  Eye,
  Layers,
  Plus,
  ShieldCheck,
  ShoppingBag,
  User,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { AdminFinanceFilters } from '@/hooks/use-admin-finances'
import { formatCurrency, getLocaleConfig } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { PaymentDialog } from './PaymentDialog'
import { PayrollRunDialog } from './PayrollRunDialog'

type PayrollEntry = {
  id: string
  employee_id: string
  employee_display_name: string
  employee_role: string
  net_amount: number
  paid_amount: number
  outstanding_amount: number
  payment_status: string
}

type PayrollRun = {
  id: string
  status: 'draft' | 'approved' | 'voided'
  period_from: string
  period_to: string
  entries: PayrollEntry[]
}

const payrollStatus = {
  draft: {
    label: 'Revisar y aprobar',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  },
  approved: {
    label: 'Registrar pagos',
    className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
  },
  voided: {
    label: 'Anulada',
    className: 'border-muted-foreground/20 bg-muted/60 text-muted-foreground',
  },
} as const

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  technician: 'Técnico',
  seller: 'Vendedor',
  cashier: 'Cajero',
  support: 'Soporte',
}

type CommissionItem = {
  id: string
  sourceType: 'sale' | 'product' | 'category' | 'repair' | 'repair_labor'
  originType: string
  occurredOn: string
  referenceCode: string
  title: string
  details: string
  basisAmount: number
  commissionAmount: number
  ruleSnapshot: {
    calculationType: 'percentage' | 'fixed'
    value: number
    explanation: string
  }
}

type EmployeeCommissionsData = {
  entry: {
    id: string
    employeeId: string
    employeeDisplayName: string
    employeeRole: string
    baseAmount: number
    commissionAmount: number
    adjustmentAmount: number
    grossAmount: number
    netAmount: number
    paidAmount: number
    outstandingAmount: number
    paymentStatus: string
  }
  commissions: CommissionItem[]
}

function EmployeeCommissionsModal({
  entry,
  organizationId,
  onClose,
  onPayEntry,
  canPay,
}: {
  entry: PayrollEntry
  organizationId: string
  onClose: () => void
  onPayEntry: (entry: PayrollEntry) => void
  canPay: boolean
}) {
  const [data, setData] = useState<EmployeeCommissionsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/admin/finances/payroll/entries/${entry.id}/commissions?organizationId=${organizationId}`,
        )
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'No se pudieron cargar las comisiones del colaborador.')
        }
        if (!isCancelled) {
          setData(json)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar comisiones.')
        }
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      isCancelled = true
    }
  }, [entry.id, organizationId])

  const roleLabel = ROLE_LABELS[entry.employee_role] || entry.employee_role
  const isSeller = entry.employee_role === 'seller'
  const isTechnician = entry.employee_role === 'technician'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl p-0 flex flex-col max-h-[88vh] overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Encabezado Fijo */}
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b bg-card pr-12 text-left">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs font-semibold bg-background">
                  {roleLabel}
                </Badge>
                <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  Liquidación Individual
                </span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                {entry.employee_display_name}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1.5">
            {isSeller
              ? 'Detalle de ventas concretadas, productos comercializados y comisiones devengadas.'
              : isTechnician
              ? 'Detalle de órdenes de servicio, reparaciones técnicas y mano de obra realizada.'
              : 'Desglose de salarios, bonificaciones y comisiones aplicadas al período.'}
          </DialogDescription>
        </DialogHeader>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Tarjetas de Resumen Económico del Colaborador */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border/70 bg-card shadow-xs">
              <CardHeader className="pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Salario Base
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base font-bold text-foreground tabular-nums">
                  {formatCurrency(Number(entry.net_amount) - (data?.entry.commissionAmount ?? 0))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Asignación fija</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 border-border/70 bg-card shadow-xs">
              <CardHeader className="pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Comisiones
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(data?.entry.commissionAmount ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {data?.commissions.length ?? 0} {data?.commissions.length === 1 ? 'operación' : 'operaciones'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card shadow-xs">
              <CardHeader className="pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Devengado
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base font-bold text-foreground tabular-nums">
                  {formatCurrency(Number(entry.net_amount))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Neto a percibir</p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 bg-card shadow-xs',
                entry.outstanding_amount > 0 ? 'border-l-amber-500' : 'border-l-emerald-500',
              )}
            >
              <CardHeader className="pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pendiente
                </span>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p
                  className={cn(
                    'text-base font-bold tabular-nums',
                    entry.outstanding_amount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {formatCurrency(Number(entry.outstanding_amount))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {entry.outstanding_amount <= 0 ? 'Abonado 100%' : 'Saldo a pagar'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Listado de Operaciones y Comisiones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-emerald-500" />
                {isSeller ? 'Productos Vendidos y Comisiones' : isTechnician ? 'Reparaciones y Mano de Obra' : 'Comisiones Devengadas'}
              </h4>
              {data?.commissions.length ? (
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {data.commissions.length} {data.commissions.length === 1 ? 'registro' : 'registros'}
                </span>
              ) : null}
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-border/70 p-8 text-center space-y-2">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Cargando desglose de comisiones...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
                {error}
              </div>
            ) : data && data.commissions.length > 0 ? (
              <div className="space-y-2.5">
                {data.commissions.map((comm) => {
                  const isRepair = comm.sourceType === 'repair' || comm.sourceType === 'repair_labor' || comm.originType === 'repair'

                  return (
                    <div
                      key={comm.id}
                      className="rounded-xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                            {isRepair ? <Wrench className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-sm truncate">{comm.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal">
                                {comm.referenceCode}
                              </Badge>
                              <span>·</span>
                              <span>{comm.details}</span>
                              <span>·</span>
                              <span>{comm.occurredOn}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Base operación</span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                              {formatCurrency(comm.basisAmount)}
                            </span>
                          </div>
                          <div className="border-l border-border/60 pl-3">
                            <span className="text-[10px] text-muted-foreground block">Comisión</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              +{formatCurrency(comm.commissionAmount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Regla Aplicada */}
                      <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                        <span>Regla aplicada: <strong className="text-foreground">{comm.ruleSnapshot.explanation}</strong></span>
                        <span className="text-[10px] font-mono text-muted-foreground">ID: {comm.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 p-6 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Coins className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Sin comisiones variables devengadas en este período
                </p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {isSeller
                    ? 'Este vendedor no registró ventas asignadas con reglas de comisión activas durante este ciclo.'
                    : isTechnician
                    ? 'Este técnico no finalizó reparaciones asignadas con reglas de comisión activas en este período.'
                    : 'La remuneración de este colaborador corresponde a su asignación de salario base fijo.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Fijo */}
        <DialogFooter className="shrink-0 p-4 border-t bg-muted/20 sm:justify-between gap-2">
          <div>
            {canPay && entry.outstanding_amount > 0 && (
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  onPayEntry(entry)
                }}
                className="gap-1.5"
              >
                <CreditCard className="h-4 w-4" />
                Registrar pago ({formatCurrency(Number(entry.outstanding_amount))})
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayrollDetailModal({
  run,
  organizationId,
  onClose,
  onPayEntry,
  onInspectEntry,
  onApproveRun,
  isApproving,
}: {
  run: PayrollRun
  organizationId: string
  onClose: () => void
  onPayEntry: (entry: PayrollEntry) => void
  onInspectEntry: (entry: PayrollEntry) => void
  onApproveRun: (runId: string) => void
  isApproving: boolean
}) {
  const totalAuthorized = run.entries.reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0)
  const totalPaid = run.entries.reduce((sum, e) => sum + (Number(e.paid_amount) || 0), 0)
  const totalOutstanding = run.entries.reduce((sum, e) => sum + (Number(e.outstanding_amount) || 0), 0)
  const paymentRate = totalAuthorized > 0 ? totalPaid / totalAuthorized : 0
  const statusConfig = payrollStatus[run.status]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl p-0 flex flex-col max-h-[88vh] overflow-hidden rounded-2xl shadow-2xl border-border/80">
        {/* Header del Modal */}
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b bg-card pr-12 text-left">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.className}`}>
                  {statusConfig.label}
                </span>
                <Badge variant="outline" className="text-xs bg-background">
                  {run.entries.length} {run.entries.length === 1 ? 'colaborador' : 'colaboradores'}
                </Badge>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                Nómina: {run.period_from} al {run.period_to}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1.5">
            Detalle de importes devengados, comisiones calculadas y pagos emitidos para esta corrida.
          </DialogDescription>
        </DialogHeader>

        {/* Cuerpo del Modal con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Tarjetas KPI de la corrida */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-l-4 border-l-primary border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Autorizado
                </span>
                <Coins className="h-3.5 w-3.5 text-primary" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base sm:text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(totalAuthorized)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sueldos y comisiones</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total Pagado
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(totalPaid)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {Math.round(paymentRate * 100)}% liquidado
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'border-l-4 border-border/70 shadow-xs',
                totalOutstanding > 0 ? 'border-l-amber-500' : 'border-l-border/60',
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Saldo Pendiente
                </span>
                <Wallet
                  className={cn('h-3.5 w-3.5', totalOutstanding > 0 ? 'text-amber-500' : 'text-muted-foreground')}
                />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p
                  className={cn(
                    'text-base sm:text-lg font-bold tabular-nums',
                    totalOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                  )}
                >
                  {formatCurrency(totalOutstanding)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Por abonar</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 border-border/70 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Personal
                </span>
                <Users className="h-3.5 w-3.5 text-indigo-500" />
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-base sm:text-lg font-bold text-foreground tabular-nums">
                  {run.entries.length}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Colaboradores</p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Progreso de Liquidación */}
          {totalAuthorized > 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  Estado General de Liquidación
                </span>
                <span className="text-muted-foreground font-medium">
                  {formatCurrency(totalPaid)} / {formatCurrency(totalAuthorized)} ({Math.round(paymentRate * 100)}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(paymentRate * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Desglose Individual de Colaboradores */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Colaboradores y Liquidaciones
            </h4>

            {run.entries.map((entry) => {
              const isFullyPaid = entry.outstanding_amount <= 0
              const isPartiallyPaid = entry.paid_amount > 0 && entry.outstanding_amount > 0

              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-sm truncate">{entry.employee_display_name}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {ROLE_LABELS[entry.employee_role] || entry.employee_role}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Autorizado: <strong className="text-foreground">{formatCurrency(Number(entry.net_amount))}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Pagado: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(entry.paid_amount))}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Pendiente:{' '}
                          <strong className={cn(entry.outstanding_amount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                            {formatCurrency(Number(entry.outstanding_amount))}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onInspectEntry(entry)}
                      className="gap-1.5 h-8 text-xs font-semibold"
                    >
                      <Coins className="h-3.5 w-3.5 text-emerald-500" />
                      Ver comisiones
                    </Button>

                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                        isFullyPaid
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : isPartiallyPaid
                          ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300'
                          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
                      )}
                    >
                      {isFullyPaid ? 'Pagado' : isPartiallyPaid ? 'Pago parcial' : 'Pendiente'}
                    </span>

                    {run.status === 'approved' && entry.outstanding_amount > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => onPayEntry(entry)}
                        className="gap-1.5 h-8 text-xs font-semibold shadow-xs"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Registrar pago
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Metadatos de la corrida */}
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5 text-xs divide-y divide-border/40 space-y-1">
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Identificador de la corrida</span>
              <span className="font-mono text-foreground font-medium text-[11px] truncate max-w-[280px]">{run.id}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Estado de autorización</span>
              <span className="font-semibold text-foreground">{statusConfig.label}</span>
            </div>
          </div>
        </div>

        {/* Footer del Modal */}
        <DialogFooter className="shrink-0 p-4 border-t bg-muted/20 sm:justify-between gap-2">
          <div>
            {run.status === 'draft' && (
              <Button
                type="button"
                onClick={() => onApproveRun(run.id)}
                disabled={isApproving}
                className="gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                {isApproving ? 'Aprobando…' : 'Aprobar corrida'}
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollPanel({
  organizationId,
  branchId,
  filters,
  onChanged,
}: {
  organizationId: string
  branchId: string | null | undefined
  filters: AdminFinanceFilters
  onChanged: () => unknown | Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [paying, setPaying] = useState<PayrollEntry | null>(null)
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
  const [inspectingEntry, setInspectingEntry] = useState<PayrollEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [confirmingRunId, setConfirmingRunId] = useState<string | null>(null)
  const [isOrganizationWide, setIsOrganizationWide] = useState(false)
  const prevBranchIdRef = useRef(branchId)

  useEffect(() => {
    if (prevBranchIdRef.current !== branchId) {
      prevBranchIdRef.current = branchId
      setIsOrganizationWide(false)
    }
  }, [branchId])

  const activeBranchId = isOrganizationWide ? null : branchId
  const hasDraft = runs.some((run) => run.status === 'draft')
  const hasOutstandingApprovedEntry = runs.some(
    (run) => run.status === 'approved' && run.entries.some((entry) => Number(entry.outstanding_amount) > 0),
  )
  const hasApprovedRuns = runs.some((run) => run.status === 'approved')

  const currentStep = hasOutstandingApprovedEntry
    ? 3
    : hasDraft
    ? 2
    : runs.length > 0 && !hasApprovedRuns
    ? 4
    : hasApprovedRuns
    ? 4
    : 1

  const loadRuns = useCallback(async () => {
    const params = new URLSearchParams({
      organizationId,
      periodFrom: filters.startDate,
      periodTo: filters.endDate,
    })
    if (activeBranchId) params.set('branchId', activeBranchId)
    const response = await fetch(`/api/admin/finances/payroll/runs?${params.toString()}`)
    const payload = (await response.json().catch(() => null)) as { runs?: PayrollRun[]; error?: string } | null
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudieron cargar las nóminas.')
      return
    }
    setError(null)
    setRuns(payload?.runs ?? [])
  }, [activeBranchId, filters.endDate, filters.startDate, organizationId])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  async function changed() {
    await loadRuns()
    await onChanged()
  }

  async function approve(runId: string) {
    if (approvingId) return false
    setApprovingId(runId)
    const response = await fetch(
      `/api/admin/finances/payroll/${runId}/approve?organizationId=${organizationId}`,
      { method: 'POST' },
    )
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    setApprovingId(null)
    if (!response.ok) {
      setError(payload?.error ?? 'No se pudo aprobar la nómina.')
      return false
    }
    await changed()
    return true
  }

  async function confirmApproval() {
    if (!confirmingRunId) return
    if (await approve(confirmingRunId)) setConfirmingRunId(null)
  }

  // Totales consolidados de la nómina
  const totals = useMemo(() => {
    let totalAuthorized = 0
    let totalPaid = 0
    let totalOutstanding = 0
    let totalEmployees = 0

    for (const run of runs) {
      if (run.status === 'voided') continue
      for (const entry of run.entries) {
        totalAuthorized += Number(entry.net_amount) || 0
        totalPaid += Number(entry.paid_amount) || 0
        totalOutstanding += Number(entry.outstanding_amount) || 0
        totalEmployees++
      }
    }

    const paymentRate = totalAuthorized > 0 ? (totalPaid / totalAuthorized) : 0

    return {
      totalAuthorized,
      totalPaid,
      totalOutstanding,
      totalEmployees,
      paymentRate,
    }
  }, [runs])

  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(getLocaleConfig().locale, {
        style: 'percent',
        maximumFractionDigits: 1,
      }),
    [],
  )

  return (
    <div className="space-y-5">
      {/* Header Principal */}
      <section className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Nómina y Salarios</h2>
              {runs.length > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {runs.length} {runs.length === 1 ? 'corrida' : 'corridas'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Gestiona salarios base, comisiones por ventas/reparaciones y pagos devengados a colaboradores.
            </p>
          </div>
        </div>

        <Button onClick={() => setOpen(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Preparar nómina
        </Button>
      </section>

      {/* Tarjetas KPI de Totales */}
      {runs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total devengado
              </CardTitle>
              <Coins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-bold tracking-tight tabular-nums">{formatCurrency(totals.totalAuthorized)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sueldos y comisiones del período</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total pagado
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totals.totalPaid)}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.round(totals.paymentRate * 100)}%` }}
                  />
                </span>
                <span>{percentFormatter.format(totals.paymentRate)} liquidado</span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'border-l-4 border-border/70 shadow-sm',
              totals.totalOutstanding > 0 ? 'border-l-amber-500' : 'border-l-border/60',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saldo pendiente
              </CardTitle>
              <Wallet
                className={cn('h-4 w-4', totals.totalOutstanding > 0 ? 'text-amber-500' : 'text-muted-foreground')}
              />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p
                className={cn(
                  'text-xl font-bold tracking-tight tabular-nums',
                  totals.totalOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                )}
              >
                {formatCurrency(totals.totalOutstanding)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pendiente de liquidar a empleados</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Colaboradores
              </CardTitle>
              <Users className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xl font-bold tracking-tight tabular-nums">{totals.totalEmployees}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Liquidaciones procesadas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Control de Alcance: Sucursal vs Toda la Organización */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <label htmlFor="payroll-organization-wide" className="text-xs font-bold uppercase tracking-wider text-foreground cursor-pointer">
              Toda la organización
            </label>
            <p className="text-xs text-muted-foreground">
              {isOrganizationWide
                ? 'Consolidando nóminas de todas las sucursales del negocio.'
                : 'Filtrando únicamente las nóminas de la sucursal seleccionada.'}
            </p>
          </div>
        </div>
        <Switch
          id="payroll-organization-wide"
          checked={isOrganizationWide}
          onCheckedChange={setIsOrganizationWide}
        />
      </div>

      {/* Flujo de Proceso de Nómina (Stepper) */}
      <ol aria-label="Proceso de nómina" className="grid gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-4">
        {[
          ['1', 'Preparar', 'Calculá salarios y comisiones.'],
          ['2', 'Revisar y aprobar', 'Confirmá los importes finales.'],
          ['3', 'Registrar pagos', 'Cargá pagos completos o parciales.'],
          ['4', 'Cerrar período', 'Verificá que no queden saldos.'],
        ].map(([step, title, description]) => {
          const stepNumber = Number(step)
          const isCurrent = currentStep === stepNumber
          const isDone = currentStep > stepNumber
          return (
            <li
              key={step}
              className={cn(
                'flex items-start gap-2.5 rounded-lg p-2.5 transition-colors',
                isCurrent && 'bg-card border border-primary/40 shadow-sm',
                isDone && 'bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isDone
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground border border-border/60',
                )}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
              </span>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold', isCurrent ? 'text-primary' : isDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
                  {title}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {/* Lista de Corridas de Nómina */}
      <div className="space-y-4">
        {runs.map((run) => {
          const runAuthorized = run.entries.reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0)
          const runPaid = run.entries.reduce((sum, e) => sum + (Number(e.paid_amount) || 0), 0)
          const runOutstanding = run.entries.reduce((sum, e) => sum + (Number(e.outstanding_amount) || 0), 0)
          const runRate = runAuthorized > 0 ? runPaid / runAuthorized : 0
          const statusConfig = payrollStatus[run.status]

          return (
            <article key={run.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {run.period_from} al {run.period_to}
                      </p>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusConfig.className}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {run.entries.length} {run.entries.length === 1 ? 'colaborador' : 'colaboradores'} · Autorizado:{' '}
                      <strong className="text-foreground">{formatCurrency(runAuthorized)}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedRun(run)}
                    className="gap-1.5 shadow-xs text-xs font-semibold"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver detalle
                  </Button>
                  {run.status === 'draft' ? (
                    <Button
                      size="sm"
                      onClick={() => setConfirmingRunId(run.id)}
                      disabled={approvingId === run.id}
                      className="gap-1.5 shadow-sm"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {approvingId === run.id ? 'Aprobando…' : 'Aprobar nómina'}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Barra de Progreso de Pago de la Corrida */}
              {run.status === 'approved' && runAuthorized > 0 && (
                <div className="rounded-lg bg-muted/20 p-3 border border-border/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Progreso de pago:</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatCurrency(runPaid)} de {formatCurrency(runAuthorized)} ({percentFormatter.format(runRate)})
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round(runRate * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Lista de Colaboradores */}
              <div className="space-y-2">
                {run.entries.map((entry) => {
                  const isFullyPaid = entry.outstanding_amount <= 0
                  const isPartiallyPaid = entry.paid_amount > 0 && entry.outstanding_amount > 0

                  return (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground truncate">{entry.employee_display_name}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                              {ROLE_LABELS[entry.employee_role] || entry.employee_role}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                            <span>
                              Autorizado: <strong className="text-foreground">{formatCurrency(Number(entry.net_amount))}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Pendiente:{' '}
                              <strong className={cn(entry.outstanding_amount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                                {formatCurrency(Number(entry.outstanding_amount))}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectingEntry(entry)}
                          className="gap-1.5 h-8 text-xs font-semibold"
                        >
                          <Coins className="h-3.5 w-3.5 text-emerald-500" />
                          Ver comisiones
                        </Button>

                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                            isFullyPaid
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : isPartiallyPaid
                              ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300'
                              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
                          )}
                        >
                          {isFullyPaid ? 'Pagado' : isPartiallyPaid ? 'Pago parcial' : 'Pendiente'}
                        </span>

                        {run.status === 'approved' && entry.outstanding_amount > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPaying(entry)}
                            className="gap-1.5 h-8 text-xs font-semibold"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Pago parcial
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}

        {!runs.length && !error ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No hay corridas de nómina para este período.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Inicia una nueva corrida para calcular salarios base, comisiones devengadas y emitir pagos a colaboradores.
              </p>
            </div>
            <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Preparar nómina ahora
            </Button>
          </div>
        ) : null}
      </div>

      <PayrollRunDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={organizationId}
        branchId={activeBranchId}
        filters={filters}
        onSaved={changed}
      />

      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(nextOpen) => !nextOpen && setPaying(null)}
        organizationId={organizationId}
        payrollEntryId={paying?.id}
        branchId={activeBranchId}
        outstandingAmount={paying?.outstanding_amount}
        onSaved={changed}
      />

      {selectedRun && (
        <PayrollDetailModal
          run={selectedRun}
          organizationId={organizationId}
          onClose={() => setSelectedRun(null)}
          onPayEntry={(entry) => setPaying(entry)}
          onInspectEntry={(entry) => setInspectingEntry(entry)}
          onApproveRun={(runId) => {
            setSelectedRun(null)
            setConfirmingRunId(runId)
          }}
          isApproving={approvingId === selectedRun.id}
        />
      )}

      {inspectingEntry && (
        <EmployeeCommissionsModal
          entry={inspectingEntry}
          organizationId={organizationId}
          onClose={() => setInspectingEntry(null)}
          onPayEntry={(entry) => setPaying(entry)}
          canPay={true}
        />
      )}

      <AlertDialog
        open={Boolean(confirmingRunId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !approvingId) setConfirmingRunId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar nómina de forma definitiva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción autoriza los importes de la corrida y no se puede deshacer. Revisa el período y los montos antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(approvingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmApproval()
              }}
              disabled={Boolean(approvingId)}
            >
              {approvingId ? 'Aprobando…' : 'Sí, aprobar nómina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

