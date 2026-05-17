'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  Lock,
  Calculator,
  Save,
  AlertTriangle,
  PlusCircle,
  MinusCircle,
  CreditCard,
  Wallet,
  Banknote
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { CashMovementTimeline } from '../../components/CashMovementTimeline'

interface CashRegisterOverviewProps {
  onOpenRegister: () => void
  onCloseRegister: () => void
  onCashIn: () => void
  onCashOut: () => void
  onCashCount: () => void
  advancedMode?: boolean
}

export const CashRegisterOverview = React.memo(function CashRegisterOverview({
  onOpenRegister,
  onCloseRegister,
  onCashIn,
  onCashOut,
  onCashCount,
  advancedMode = false
}: CashRegisterOverviewProps) {
  const {
    getCurrentRegister,
    userPermissions,
    calculateDiscrepancy
  } = useCashRegisterContext()

  const register = getCurrentRegister
  const isRegisterOpen = register.isOpen
  const canCashIn = userPermissions.canAddCashIn
  const canCashOut = userPermissions.canAddCashOut
  const canClose = userPermissions.canCloseRegister

  const movements = useMemo(() => [...register.movements].reverse(), [register.movements])
  const discrepancy = calculateDiscrepancy()

  const metrics = useMemo(() => {
    const incomes = movements
      .filter(m => m.type === 'sale' || m.type === 'cash_in')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

    const expenses = movements
      .filter(m => m.type === 'cash_out')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

    const paymentMethods = movements.reduce((acc, m) => {
      const amount = Number(m.amount) || 0
      if (m.type === 'sale') {
        const method = String(m.payment_method || 'cash').toLowerCase()
        let key: 'cash' | 'card' | 'transfer' | 'credit' | 'others' = 'others'

        if (method === 'cash' || method === 'efectivo') key = 'cash'
        else if (method === 'card' || method === 'tarjeta') key = 'card'
        else if (method === 'transfer' || method === 'transferencia') key = 'transfer'
        else if (method === 'credit' || method === 'credito') key = 'credit'

        acc[key] += amount
        acc.totalSales += amount
      }
      return acc
    }, { cash: 0, card: 0, transfer: 0, credit: 0, others: 0, totalSales: 0 })

    return { incomes, expenses, paymentMethods }
  }, [movements])

  if (!isRegisterOpen) {
    return (
      <Card className="bg-muted/30 border-dashed border-2 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none" />
        <CardContent className="flex flex-col items-center justify-center py-20 space-y-6 relative z-10">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-border/50">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-bold text-2xl text-foreground tracking-tight">Caja cerrada</h3>
            <p className="text-sm text-muted-foreground">
              Para comenzar a registrar ventas y movimientos, abra la caja con un monto inicial.
            </p>
          </div>

          {userPermissions.canOpenRegister && (
            <Button
              onClick={onOpenRegister}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-base font-semibold shadow-md transition-all hover:shadow-lg"
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Abrir caja ahora
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const distribution = metrics.paymentMethods

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border border-blue-200/80 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              {Math.abs(discrepancy) > 0 && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${discrepancy > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  {discrepancy > 0 ? 'SOBRA' : 'FALTA'}
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Saldo actual</p>
            <p className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300 tabular-nums">
              {formatCurrency(register.balance || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className={`border shadow-sm hover:shadow-md transition-shadow ${Math.abs(discrepancy) > 0 ? 'border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20' : 'border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20'}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2.5 rounded-xl ${Math.abs(discrepancy) > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'}`}>
                <AlertTriangle className={`h-5 w-5 ${Math.abs(discrepancy) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Diferencia</p>
            <p className={`text-2xl font-bold tracking-tight tabular-nums ${Math.abs(discrepancy) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {formatCurrency(Math.abs(discrepancy))}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <ArrowUpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Ingresos</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatCurrency(metrics.incomes)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40">
                <ArrowDownCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Egresos</p>
            <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-400 tabular-nums">
              {formatCurrency(metrics.expenses)}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 dark:border-slate-800/60 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/20 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/40">
                <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Movimientos</p>
            <p className="text-2xl font-bold tracking-tight text-slate-700 dark:text-slate-300 tabular-nums">
              {movements.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-6 ${advancedMode ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <div className="space-y-6">
          <Card className="border border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center">
                <Calculator className="h-4 w-4 mr-2 text-blue-600" />
                Acciones rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-1.5 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 dark:border-emerald-900/50 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"
                  onClick={onCashIn}
                  disabled={!canCashIn}
                  title={canCashIn ? 'Registrar entrada de efectivo' : 'Sin permiso'}
                >
                  <PlusCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                  <span className="text-xs font-semibold">Entrada (Alt+E)</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex flex-col gap-1.5 border-rose-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 dark:border-rose-900/50 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-colors"
                  onClick={onCashOut}
                  disabled={!canCashOut}
                  title={canCashOut ? 'Registrar salida de efectivo' : 'Sin permiso'}
                >
                  <MinusCircle className="h-5 w-5 text-rose-600 dark:text-rose-500" />
                  <span className="text-xs font-semibold">Salida (Alt+S)</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-12 flex items-center justify-center gap-2 col-span-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors" 
                  onClick={onCashCount}
                >
                  <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                  <span className="text-sm font-semibold">Arqueo de caja (Alt+A)</span>
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <Button
                  variant="destructive"
                  className="w-full h-11 text-sm font-semibold shadow-sm hover:shadow-md transition-all"
                  onClick={onCloseRegister}
                  disabled={!canClose}
                  title={canClose ? 'Cerrar turno actual de caja' : 'Sin permiso para cerrar caja'}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Cerrar caja
                </Button>
              </div>
            </CardContent>
          </Card>

          {advancedMode && (
            <Card className="border border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center">
                  <CreditCard className="mr-2 h-4 w-4 text-violet-600" />
                  Distribución de cobros
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-900 dark:text-emerald-300">Efectivo</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(distribution.cash)}</p>
                  </div>

                  <div className="flex flex-col p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-900 dark:text-blue-300">Tarjetas</p>
                    </div>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-400 tabular-nums">{formatCurrency(distribution.card)}</p>
                  </div>

                  <div className="flex flex-col p-3 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-violet-900 dark:text-violet-300">Transf.</p>
                    </div>
                    <p className="text-lg font-bold text-violet-700 dark:text-violet-400 tabular-nums">{formatCurrency(distribution.transfer)}</p>
                  </div>

                  <div className="flex flex-col p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-900 dark:text-amber-300">Crédito/Otros</p>
                    </div>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatCurrency(distribution.credit + distribution.others)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className={`border border-border/60 shadow-sm overflow-hidden ${advancedMode ? 'lg:col-span-2' : ''}`}>
          <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center">
              <History className="mr-2 h-4 w-4 text-slate-500" />
              Últimos movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CashMovementTimeline movements={movements.slice(0, 10)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
})
