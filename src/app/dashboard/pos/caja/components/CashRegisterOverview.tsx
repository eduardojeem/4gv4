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
      <Card className="bg-muted/40 border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="p-6 bg-muted rounded-full shadow-inner">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-bold text-2xl text-foreground">Caja cerrada</h3>
            <p className="text-muted-foreground">
              Para comenzar a registrar ventas y movimientos, abra la caja con un monto inicial.
            </p>
          </div>

          {userPermissions.canOpenRegister && (
            <Button
              onClick={onOpenRegister}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg shadow-lg"
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Abrir caja
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const distribution = metrics.paymentMethods

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo actual</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-primary">
              {formatCurrency(register.balance || 0)}
            </div>
            {Math.abs(discrepancy) > 0 && (
              <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${discrepancy > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {discrepancy > 0 ? 'Sobra' : 'Falta'} {formatCurrency(Math.abs(discrepancy))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diferencia</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${Math.abs(discrepancy) > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${Math.abs(discrepancy) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(Math.abs(discrepancy))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {discrepancy === 0 ? 'Sin diferencia' : discrepancy > 0 ? 'Sobra efectivo' : 'Falta efectivo'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(metrics.incomes)}</div>
            <p className="text-xs text-muted-foreground mt-1">Ventas + entradas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{formatCurrency(metrics.expenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">Retiros de caja</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Movimientos</CardTitle>
            <History className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{movements.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Durante el turno</p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-6 ${advancedMode ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div className="space-y-6">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Acciones rapidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={onCashIn}
                  disabled={!canCashIn}
                  title={canCashIn ? 'Registrar entrada de efectivo' : 'Sin permiso para registrar entradas'}
                >
                  <PlusCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-xs font-semibold">Entrada (Alt+E)</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={onCashOut}
                  disabled={!canCashOut}
                  title={canCashOut ? 'Registrar salida de efectivo' : 'Sin permiso para registrar salidas'}
                >
                  <MinusCircle className="h-5 w-5 text-rose-600" />
                  <span className="text-xs font-semibold">Salida (Alt+S)</span>
                </Button>

                <Button variant="outline" className="h-24 flex flex-col gap-2 col-span-2" onClick={onCashCount}>
                  <Calculator className="h-5 w-5 text-blue-600" />
                  <span className="text-xs font-semibold">Arqueo de caja (Alt+A)</span>
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="destructive"
                  className="w-full"
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

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <History className="mr-2 h-4 w-4" />
                Ultimos movimientos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CashMovementTimeline movements={movements.slice(0, 5)} />
            </CardContent>
          </Card>
        </div>

        {advancedMode && (
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Distribucion de cobros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center p-4 bg-emerald-50 border rounded-xl">
                  <Banknote className="h-5 w-5 text-emerald-600 mr-3" />
                  <div>
                    <p className="text-sm text-emerald-900">Efectivo en caja</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(register.balance || 0)}</p>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-blue-50 border rounded-xl">
                  <CreditCard className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <p className="text-sm text-blue-900">Tarjetas</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(distribution.card)}</p>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-violet-50 border rounded-xl">
                  <ArrowUpCircle className="h-5 w-5 text-violet-600 mr-3" />
                  <div>
                    <p className="text-sm text-violet-900">Transferencias</p>
                    <p className="text-xl font-bold text-violet-700">{formatCurrency(distribution.transfer)}</p>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-amber-50 border rounded-xl">
                  <Wallet className="h-5 w-5 text-amber-600 mr-3" />
                  <div>
                    <p className="text-sm text-amber-900">Credito / otros</p>
                    <p className="text-xl font-bold text-amber-700">{formatCurrency(distribution.credit + distribution.others)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
})

