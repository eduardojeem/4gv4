'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Trash2,
  CheckCircle2,
  ShoppingBag,
  Wrench,
  CreditCard,
  Info,
  Loader2,
  ArrowRight,
  Lock
} from 'lucide-react'
import { Customer } from '@/hooks/use-customer-state'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { CustomerCreditSummary } from '@/hooks/use-customer-credits'

interface CustomerDeleteDialogProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onConfirmDelete: (customer: Customer) => Promise<void> | void
  onDeactivate: (customer: Customer) => Promise<void> | void
  isDeleting?: boolean
  creditSummary?: CustomerCreditSummary | null
}

export function CustomerDeleteDialog({
  customer,
  isOpen,
  onClose,
  onConfirmDelete,
  onDeactivate,
  isDeleting = false,
  creditSummary = null
}: CustomerDeleteDialogProps) {
  const [isProcessingDeactivate, setIsProcessingDeactivate] = useState(false)
  const [livePurchases, setLivePurchases] = useState<number | null>(null)
  const [liveRepairs, setLiveRepairs] = useState<number | null>(null)
  const [liveSpent, setLiveSpent] = useState<number | null>(null)
  const [liveCredits, setLiveCredits] = useState<{ total: number; active: number; pendingBalance: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Fetch real-time purchases, repairs and credits on dialog open
  React.useEffect(() => {
    if (!isOpen || !customer?.id) {
      setLivePurchases(null)
      setLiveRepairs(null)
      setLiveSpent(null)
      setLiveCredits(null)
      return
    }

    const controller = new AbortController()
    const fetchLiveHistory = async () => {
      setLoadingStats(true)
      try {
        const [salesRes, repairsRes, creditsRes] = await Promise.allSettled([
          fetch(`/api/customers/${customer.id}/sales?limit=1`, { signal: controller.signal }),
          fetch(`/api/customers/${customer.id}/repairs?limit=1`, { signal: controller.signal }),
          fetch(`/api/customers/${customer.id}/credits`, { signal: controller.signal }),
        ])

        let salesCount = 0
        let salesTotal = 0
        let repairsCount = 0
        let repairsTotal = 0
        let totalCredits = 0
        let activeCredits = 0
        let pendingBalance = 0

        if (salesRes.status === 'fulfilled' && salesRes.value.ok) {
          const salesData = await salesRes.value.json().catch(() => null)
          if (salesData?.stats) {
            salesCount = salesData.stats.totalPurchases || 0
            salesTotal = salesData.stats.totalSpent || 0
          }
        }

        if (repairsRes.status === 'fulfilled' && repairsRes.value.ok) {
          const repairsData = await repairsRes.value.json().catch(() => null)
          if (repairsData?.stats) {
            repairsCount = repairsData.stats.totalRepairs || 0
            repairsTotal = repairsData.stats.totalSpent || 0
          }
        }

        if (creditsRes.status === 'fulfilled' && creditsRes.value.ok) {
          const creditsData = await creditsRes.value.json().catch(() => null)
          if (creditsData?.stats) {
            totalCredits = creditsData.stats.totalCredits || 0
            activeCredits = creditsData.stats.activeCredits || 0
            pendingBalance = creditsData.stats.pendingBalance || 0
          }
        }

        setLivePurchases(salesCount)
        setLiveRepairs(repairsCount)
        setLiveSpent(salesTotal + repairsTotal)
        setLiveCredits({
          total: totalCredits,
          active: activeCredits,
          pendingBalance
        })
      } catch (e) {
        // Fallback to customer prop
      } finally {
        setLoadingStats(false)
      }
    }

    fetchLiveHistory()
    return () => controller.abort()
  }, [isOpen, customer?.id])

  if (!customer) return null

  const initials = customer.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  
  const purchasesCount = livePurchases ?? customer.total_purchases ?? 0
  const repairsCount = liveRepairs ?? customer.total_repairs ?? 0
  const creditsCount = liveCredits?.total ?? creditSummary?.total_credits ?? (creditSummary ? 1 : 0)
  const activeCreditsCount = liveCredits?.active ?? creditSummary?.active_credits ?? (creditSummary?.total_pending && creditSummary.total_pending > 0 ? 1 : 0)
  const pendingCreditBalance = liveCredits?.pendingBalance || creditSummary?.total_pending || creditSummary?.current_balance || 0
  const pendingDebt = customer.current_balance || pendingCreditBalance || 0
  const totalSpent = liveSpent ?? customer.lifetime_value ?? 0

  const hasHistory =
    purchasesCount > 0 ||
    repairsCount > 0 ||
    creditsCount > 0 ||
    activeCreditsCount > 0 ||
    pendingDebt > 0 ||
    totalSpent > 0 ||
    Boolean(creditSummary)

  const normalizedStatus = String(customer.status || '').toLowerCase().trim()
  const isInactive = normalizedStatus === 'inactive' || normalizedStatus === 'inactivo' || normalizedStatus === 'desactivado'
  const isSuspended = normalizedStatus === 'suspended' || normalizedStatus === 'suspendido'
  const isActive = !isInactive && !isSuspended

  const handleDeactivate = async () => {
    try {
      setIsProcessingDeactivate(true)
      await onDeactivate(customer)
      onClose()
    } finally {
      setIsProcessingDeactivate(false)
    }
  }

  const handleDelete = async () => {
    await onConfirmDelete(customer)
    onClose()
  }

  const isBusy = isDeleting || isProcessingDeactivate

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1117] shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Eliminar o Inactivar Cliente</DialogTitle>
          <DialogDescription>Opciones para eliminar o desactivar a {customer.name}</DialogDescription>
        </DialogHeader>

        {/* ─── Encabezado Visual con Gradiente de Advertencia / Bloqueo ─── */}
        <div className={cn(
          "p-6 pb-5 text-white relative overflow-hidden",
          hasHistory 
            ? "bg-gradient-to-r from-red-700 via-rose-800 to-slate-900 dark:from-red-950 dark:via-rose-950 dark:to-slate-950"
            : "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 dark:from-rose-950 dark:via-red-950 dark:to-rose-900"
        )}>
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              {hasHistory ? (
                <Lock className="h-6 w-6 text-white" />
              ) : (
                <Trash2 className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {hasHistory ? '🔒 Eliminación Bloqueada' : '¿Eliminar este cliente?'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {hasHistory
                  ? 'Este cliente tiene datos asociados a la organización'
                  : 'Esta acción eliminará el registro permanentemente'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* ─── Ficha Resumida del Cliente ─── */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/40">
            <Avatar className="h-12 w-12 rounded-xl border border-slate-200 dark:border-white/10">
              <AvatarImage src={customer.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm">
                  {customer.name}
                </h3>
                <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 h-4 bg-white dark:bg-slate-800">
                  {customer.customerCode || 'CLI'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                {customer.phone && <span>Tel: {customer.phone}</span>}
                {customer.ruc && <span>RUC: {customer.ruc}</span>}
                {customer.email && <span className="truncate max-w-[150px]">{customer.email}</span>}
              </div>
            </div>
            <Badge className={cn(
              "text-[10px] font-bold shrink-0",
              isActive
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-0" 
                : isSuspended
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-0"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0"
            )}>
              {isActive ? 'Activo' : isSuspended ? 'Suspendido' : 'Inactivo'}
            </Badge>
          </div>

          {/* ─── Impacto de Transacciones y Registros ─── */}
          {hasHistory ? (
            <div className="space-y-3">
              {/* Tarjetas de Métricas de Historial */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 text-center">
                  <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                  <p className="text-base font-bold text-blue-900 dark:text-blue-200 tabular-nums">{purchasesCount}</p>
                  <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium">Ventas / POS</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 text-center">
                  <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                  <p className="text-base font-bold text-amber-900 dark:text-amber-200 tabular-nums">{repairsCount}</p>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium">Reparaciones</p>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30 text-center">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
                  <p className="text-base font-bold text-purple-900 dark:text-purple-200 tabular-nums">{creditsCount}</p>
                  <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 font-medium">
                    {activeCreditsCount > 0 ? `${activeCreditsCount} Activo(s)` : 'Créditos'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-center">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 tabular-nums truncate">
                    {formatCurrency(totalSpent)}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Total Facturado</p>
                </div>
              </div>

              {/* Mensaje de Bloqueo por Integridad */}
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-950/20 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Lock className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-900 dark:text-red-200 leading-relaxed">
                    <p className="font-bold text-red-950 dark:text-red-100 mb-1">
                      No es posible eliminar este cliente
                    </p>
                    <p>
                      El cliente tiene registros contables (ventas, facturas, órdenes de reparación o créditos). Eliminarlo rompería los balances de caja y la trazabilidad legal.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-950/20 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <strong>Acción recomendada:</strong> Al <strong>Desactivar</strong> el cliente, se ocultará en el POS y para nuevas operaciones, pero su historial y reportes contables quedarán intactos.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-slate-900/40 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Este cliente no posee ventas, órdenes de servicio ni créditos registrados. Puedes eliminarlo de forma segura sin afectar ningún reporte contable.
              </p>
            </div>
          )}
        </div>

        {/* ─── Acciones del Pie ─── */}
        <DialogFooter className="p-4 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-white/5 flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border-slate-200 text-xs font-semibold"
          >
            Cancelar
          </Button>

          {hasHistory ? (
            isInactive ? (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isBusy}
                className="flex-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cerrar (Cliente ya inactivo)
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleDeactivate}
                disabled={isBusy}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                {isProcessingDeactivate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <UserX className="h-3.5 w-3.5 mr-1.5" />
                )}
                Desactivar Cliente (Recomendado)
              </Button>
            )
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isBusy}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Eliminar Cliente Permanentemente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
