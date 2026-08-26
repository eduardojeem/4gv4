'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Banknote,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  ShieldCheck,
  Smartphone
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { CashMovementTimeline } from '../../components/CashMovementTimeline'
import { cn } from '@/lib/utils'

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

  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'sale' | 'cash_in' | 'cash_out'>('all')

  const movements = useMemo(() => [...register.movements].reverse(), [register.movements])
  const discrepancy = calculateDiscrepancy()

  const openingMovement = useMemo(() => {
    return register.movements.find(m => m.type === 'opening')
  }, [register.movements])

  const metrics = useMemo(() => {
    const incomes = movements
      .filter(m => m.type === 'sale' || m.type === 'cash_in')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

    const expenses = movements
      .filter(m => m.type === 'cash_out')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

    const salesMovements = movements.filter(m => m.type === 'sale')
    const totalSalesCount = salesMovements.length

    const paymentMethods = movements.reduce((acc, m) => {
      const amount = Number(m.amount) || 0
      if (m.type === 'sale') {
        const method = String(m.payment_method || 'cash').toLowerCase()
        let key: 'cash' | 'card' | 'transfer' | 'credit' | 'others' = 'others'

        if (method === 'cash' || method === 'efectivo') key = 'cash'
        else if (method === 'card' || method === 'tarjeta') key = 'card'
        else if (method === 'transfer' || method === 'transferencia' || method === 'qr') key = 'transfer'
        else if (method === 'credit' || method === 'credito') key = 'credit'

        acc[key] += amount
        acc.totalSales += amount
      }
      return acc
    }, { cash: 0, card: 0, transfer: 0, credit: 0, others: 0, totalSales: 0 })

    return { incomes, expenses, paymentMethods, totalSalesCount }
  }, [movements])

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movementTypeFilter !== 'all' && m.type !== movementTypeFilter) return false
      if (!movementSearch.trim()) return true
      const q = movementSearch.toLowerCase()
      return (
        (m.reason && m.reason.toLowerCase().includes(q)) ||
        (m.type && m.type.toLowerCase().includes(q)) ||
        (m.payment_method && m.payment_method.toLowerCase().includes(q)) ||
        String(m.amount).includes(q)
      )
    })
  }, [movements, movementSearch, movementTypeFilter])

  if (!isRegisterOpen) {
    return (
      <Card className="bg-muted/30 border-dashed border-2 overflow-hidden relative rounded-2xl shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-primary/5 dark:from-blue-900/10 pointer-events-none" />
        <CardContent className="flex flex-col items-center justify-center py-20 space-y-6 relative z-10">
          <div className="p-6 bg-background rounded-2xl shadow-md border border-border/80">
            <Lock className="h-12 w-12 text-primary" />
          </div>

          <div className="text-center space-y-2 max-w-md">
            <h3 className="font-bold text-2xl text-foreground tracking-tight">Turno de Caja Cerrado</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Inicia la jornada ingresando el fondo de cambio inicial para habilitar ventas y movimientos en efectivo.
            </p>
          </div>

          {userPermissions.canOpenRegister && (
            <Button
              onClick={onOpenRegister}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base font-bold shadow-lg rounded-xl transition-all hover:scale-105"
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Abrir Turno de Caja
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const distribution = metrics.paymentMethods

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* ── 1. HUB DE ACCIONES RÁPIDAS (REUBICADO AL INICIO) ── */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Operaciones Rápidas del Turno
            </h3>
            <p className="text-xs text-muted-foreground">Acciones frecuentes para registrar movimientos o cuadrar efectivo</p>
          </div>
          <Badge variant="outline" className="w-fit text-[11px] font-semibold bg-muted/40 gap-1.5 py-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {openingMovement ? `Abierta a las ${new Date(openingMovement.created_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}` : 'Turno en curso'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Ingreso */}
          <Button
            variant="outline"
            className="h-16 flex items-center justify-start gap-3 p-3.5 rounded-xl border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/70 hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300 transition-all shadow-2xs group"
            onClick={onCashIn}
            disabled={!canCashIn}
            title={canCashIn ? 'Registrar entrada de efectivo (Alt+E)' : 'Sin permiso'}
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <span className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">Ingreso</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">Alt + E</span>
            </div>
          </Button>

          {/* Egreso / Salida */}
          <Button
            variant="outline"
            className="h-16 flex items-center justify-start gap-3 p-3.5 rounded-xl border-rose-200 bg-rose-50/40 hover:bg-rose-100/70 hover:border-rose-300 hover:text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:hover:text-rose-300 transition-all shadow-2xs group"
            onClick={onCashOut}
            disabled={!canCashOut}
            title={canCashOut ? 'Registrar salida o gasto de caja (Alt+S)' : 'Sin permiso'}
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <MinusCircle className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <span className="block text-xs font-bold text-rose-900 dark:text-rose-200 truncate">Egreso / Gasto</span>
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-mono">Alt + S</span>
            </div>
          </Button>

          {/* Arqueo de Caja */}
          <Button 
            variant="outline" 
            className="h-16 flex items-center justify-start gap-3 p-3.5 rounded-xl border-blue-200 bg-blue-50/40 hover:bg-blue-100/70 hover:border-blue-300 hover:text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-all shadow-2xs group" 
            onClick={onCashCount}
            title="Realizar conteo físico y arqueo (Alt+A)"
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <span className="block text-xs font-bold text-blue-900 dark:text-blue-200 truncate">Arqueo / Conteo</span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-mono">Alt + A</span>
            </div>
          </Button>

          {/* Cerrar Turno */}
          <Button
            variant="outline"
            className="h-16 flex items-center justify-start gap-3 p-3.5 rounded-xl border-slate-300 bg-slate-100/60 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800 transition-all shadow-2xs group"
            onClick={onCloseRegister}
            disabled={!canClose}
            title={canClose ? 'Finalizar y cerrar turno de caja' : 'Sin permiso para cerrar caja'}
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-800 text-white dark:bg-slate-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Save className="h-5 w-5" />
            </div>
            <div className="text-left min-w-0">
              <span className="block text-xs font-bold truncate">Cerrar Turno</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-slate-200">Cierre Z</span>
            </div>
          </Button>
        </div>
      </div>

      {/* ── 2. HERO METRICS & KPI CARDS ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Saldo Principal */}
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm hover:shadow-md transition-all rounded-2xl sm:col-span-2 lg:col-span-2">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <Banknote className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Efectivo en Caja
                  </span>
                  <span className="text-xs text-muted-foreground">Saldo teórico calculado</span>
                </div>
              </div>

              {Math.abs(discrepancy) > 0 ? (
                <Badge variant="outline" className={cn("font-bold text-[11px] px-2 py-0.5", discrepancy > 0 ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300")}>
                  {discrepancy > 0 ? '+ SOBRANTE' : '- FALTANTE'}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 font-semibold text-[10px]">
                  ✓ Cuadrada
                </Badge>
              )}
            </div>

            <div className="mt-2">
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground tabular-nums font-mono">
                {formatCurrency(register.balance || 0)}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Fondo Inicial: <strong>{formatCurrency(openingMovement?.amount || 0)}</strong></span>
                <span>•</span>
                <span>{metrics.totalSalesCount} venta(s)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingresos Totales */}
        <Card className="border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                <ArrowUpCircle className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Entradas</p>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
              +{formatCurrency(metrics.incomes)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Ventas contado + aportes</p>
          </CardContent>
        </Card>

        {/* Egresos Totales */}
        <Card className="border border-rose-200/80 dark:border-rose-800/60 bg-gradient-to-br from-rose-50/50 to-transparent dark:from-rose-950/20 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">
                <ArrowDownCircle className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Total Salidas</p>
            </div>
            <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-400 tabular-nums">
              -{formatCurrency(metrics.expenses)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Gastos, insumos y retiros</p>
          </CardContent>
        </Card>

        {/* Discrepancia / Estado de Arqueo */}
        <Card className={cn(
          "border shadow-sm hover:shadow-md transition-shadow rounded-2xl",
          Math.abs(discrepancy) > 0 
            ? "border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 dark:border-amber-900/40" 
            : "border-slate-200/80 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/20 dark:border-slate-800/60"
        )}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "p-2 rounded-xl",
                Math.abs(discrepancy) > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
              )}>
                {Math.abs(discrepancy) > 0 ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Último Arqueo</p>
            </div>
            <p className={cn("text-2xl font-bold tracking-tight tabular-nums", Math.abs(discrepancy) > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
              {Math.abs(discrepancy) > 0 ? `${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}` : '0 Gs.'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {Math.abs(discrepancy) > 0 ? 'Diferencia no conciliada' : 'Caja perfectamente cuadrada'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. DISTRIBUCIÓN DE COBROS + TIMELINE DE MOVIMIENTOS ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Distribución por Formas de Cobro */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Cobros del Turno
                </span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  {formatCurrency(distribution.totalSales)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-2.5">
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Efectivo</p>
                    <p className="text-[10px] text-muted-foreground">Impacta en saldo de caja</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatCurrency(distribution.cash)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Tarjetas</p>
                    <p className="text-[10px] text-muted-foreground">Débito / Crédito POS</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {formatCurrency(distribution.card)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <div>
                    <p className="text-xs font-bold text-violet-900 dark:text-violet-200">Transferencias / QR</p>
                    <p className="text-[10px] text-muted-foreground">Bancos / Billeteras</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                  {formatCurrency(distribution.transfer)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Créditos / Otros</p>
                    <p className="text-[10px] text-muted-foreground">Cuentas pendientes</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  {formatCurrency(distribution.credit + distribution.others)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline de Últimos Movimientos con Filtros */}
        <Card className="border border-border/70 shadow-sm rounded-2xl overflow-hidden lg:col-span-2">
          <CardHeader className="bg-muted/20 border-b border-border/40 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Línea de Tiempo de Movimientos ({movements.length})
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    placeholder="Buscar movimiento..."
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Chips de filtro rápido */}
            <div className="flex gap-1.5 pt-2 flex-wrap">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'sale', label: 'Ventas' },
                { id: 'cash_in', label: 'Entradas' },
                { id: 'cash_out', label: 'Salidas' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMovementTypeFilter(f.id as any)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all",
                    movementTypeFilter === f.id
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-y-auto">
            <CashMovementTimeline movements={filteredMovements.slice(0, 20)} />
          </CardContent>
        </Card>
      </div>

    </div>
  )
})
