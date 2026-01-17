'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DollarSign, ArrowUpCircle, ArrowDownCircle, History,
    Lock, Calculator, Save, AlertTriangle, PlusCircle, MinusCircle,
    CreditCard, Wallet, Banknote
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { CashRegisterCharts } from '../../components/CashRegisterCharts'
import { CashMovementTimeline } from '../../components/CashMovementTimeline'

interface CashRegisterOverviewProps {
    onOpenRegister: () => void
    onCloseRegister: () => void
    onCashIn: () => void
    onCashOut: () => void
    onCashCount: () => void
}

export function CashRegisterOverview({
    onOpenRegister,
    onCloseRegister,
    onCashIn,
    onCashOut,
    onCashCount
}: CashRegisterOverviewProps) {
    const {
        getCurrentRegister,
        userPermissions,
        calculateDiscrepancy,
        getSessionReport // <-- Changed from cashReport to getSessionReport
    } = useCashRegisterContext()

    const isRegisterOpen = getCurrentRegister.isOpen
    const movements = [...getCurrentRegister.movements].reverse()
    const discrepancy = calculateDiscrepancy()
    
    // Calculate totals directly from current session movements for real-time updates
    const currentSessionReport = getSessionReport ? getSessionReport() : null
    
    // Fallback or override if getSessionReport returns null (shouldn't happen if open)
    const incomes = currentSessionReport?.totalSales ? (currentSessionReport.totalSales + currentSessionReport.totalCashIn) : 
                    movements.filter(m => m.type === 'sale' || m.type === 'cash_in').reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
                    
    const expenses = currentSessionReport?.totalCashOut || 
                     movements.filter(m => m.type === 'cash_out').reduce((sum, m) => sum + (Number(m.amount) || 0), 0)

    // Calculate Payment Methods Breakdown (Real-time)
    const paymentMethods = movements.reduce((acc, m) => {
        const amount = Number(m.amount) || 0
        if (m.type === 'sale') {
            const method = m.payment_method || 'cash'
            // Map methods to standardized keys
            let key = 'others'
            if (method === 'cash' || method === 'efectivo') key = 'cash'
            else if (method === 'card' || method === 'tarjeta') key = 'card'
            else if (method === 'transfer' || method === 'transferencia') key = 'transfer'
            else if (method === 'credit' || method === 'credito') key = 'credit'
            
            acc[key] = (acc[key] || 0) + amount
            acc.totalSales += amount
        }
        return acc
    }, { cash: 0, card: 0, transfer: 0, credit: 0, others: 0, totalSales: 0 })

    // Calculate Cash in Hand (Theoretical)
    // Starts with opening balance (if we had it stored separately, but we can infer or use balance)
    // Actually, getCurrentRegister.balance IS the cash in hand maintained by the backend logic.
    const cashInHand = getCurrentRegister.balance || 0

    // Animation classes
    const containerClass = "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"

    if (!isRegisterOpen) {
        return (
            <Card className="bg-muted/40 border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
                    <div className="p-6 bg-muted rounded-full shadow-inner">
                        <Lock className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-2 max-w-md">
                        <h3 className="font-bold text-2xl text-foreground">Caja Cerrada</h3>
                        <p className="text-muted-foreground">
                            Para comenzar a registrar ventas y movimientos, debe abrir la caja estableciendo un monto inicial.
                        </p>
                    </div>
                    {userPermissions.canOpenRegister && (
                        <Button
                            onClick={onOpenRegister}
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg shadow-lg transition-all hover:-translate-y-1"
                        >
                            <DollarSign className="mr-2 h-5 w-5" />
                            Abrir Caja Ahora
                        </Button>
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <div className={`space-y-6 ${containerClass}`}>
            {/* Key Metrics - Premium Gradient Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Actual</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight text-primary">
                            {formatCurrency(getCurrentRegister.balance || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">En caja ahora mismo</p>
                        {Math.abs(discrepancy) > 0 && (
                            <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${discrepancy > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {discrepancy > 0 ? 'Sobran' : 'Faltan'} {formatCurrency(Math.abs(discrepancy))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                            <ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(incomes)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ventas + Entradas</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-rose-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                            <ArrowDownCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                            {formatCurrency(expenses)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Retiros de caja</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                            {movements.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">En este turno</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Charts Area - 2/3 width */}
                <Card className="md:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Desglose de Caja</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Cash Card */}
                            <div className="flex items-center p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl">
                                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mr-4">
                                    <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Efectivo en Caja</p>
                                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                        {formatCurrency(cashInHand)}
                                    </p>
                                    <p className="text-xs text-emerald-600/80">Disponible físico</p>
                                </div>
                            </div>

                            {/* Card Payments */}
                            <div className="flex items-center p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
                                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-4">
                                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Tarjetas (Vouchers)</p>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                        {formatCurrency(paymentMethods.card)}
                                    </p>
                                    <p className="text-xs text-blue-600/80">Acumulado en banco</p>
                                </div>
                            </div>

                            {/* Transfer Payments */}
                            <div className="flex items-center p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-xl">
                                <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center mr-4">
                                    <ArrowUpCircle className="h-5 w-5 text-violet-600 dark:text-violet-400 rotate-45" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-violet-900 dark:text-violet-200">Transferencias</p>
                                    <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                                        {formatCurrency(paymentMethods.transfer)}
                                    </p>
                                    <p className="text-xs text-violet-600/80">Digital / QR</p>
                                </div>
                            </div>

                            {/* Credit/Other Payments */}
                            <div className="flex items-center p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-xl">
                                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mr-4">
                                    <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Créditos / Otros</p>
                                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                        {formatCurrency(paymentMethods.credit + paymentMethods.others)}
                                    </p>
                                    <p className="text-xs text-amber-600/80">Pendiente de cobro</p>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar Visualization */}
                        <div className="mt-6 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Distribución de Ventas</span>
                                <span className="font-medium">{formatCurrency(paymentMethods.totalSales)} Total</span>
                            </div>
                            <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                                {paymentMethods.totalSales > 0 ? (
                                    <>
                                        {/* Cash */}
                                        <div 
                                            className="h-full bg-emerald-500 hover:bg-emerald-600 transition-colors" 
                                            style={{ width: `${(paymentMethods.cash / paymentMethods.totalSales) * 100}%` }}
                                            title={`Efectivo: ${formatCurrency(paymentMethods.cash)}`}
                                        />
                                        {/* Card */}
                                        <div 
                                            className="h-full bg-blue-500 hover:bg-blue-600 transition-colors" 
                                            style={{ width: `${(paymentMethods.card / paymentMethods.totalSales) * 100}%` }}
                                            title={`Tarjeta: ${formatCurrency(paymentMethods.card)}`}
                                        />
                                        {/* Transfer */}
                                        <div 
                                            className="h-full bg-violet-500 hover:bg-violet-600 transition-colors" 
                                            style={{ width: `${(paymentMethods.transfer / paymentMethods.totalSales) * 100}%` }}
                                            title={`Transferencia: ${formatCurrency(paymentMethods.transfer)}`}
                                        />
                                        {/* Others */}
                                        <div 
                                            className="h-full bg-amber-500 hover:bg-amber-600 transition-colors" 
                                            style={{ width: `${((paymentMethods.credit + paymentMethods.others) / paymentMethods.totalSales) * 100}%` }}
                                            title={`Otros: ${formatCurrency(paymentMethods.credit + paymentMethods.others)}`}
                                        />
                                    </>
                                ) : (
                                    <div className="h-full w-full bg-gray-200 dark:bg-gray-700" />
                                )}
                            </div>
                            <div className="flex gap-4 text-xs text-muted-foreground justify-center flex-wrap">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Efectivo</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Tarjeta</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500"></div>Transf.</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Otros</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions & Timeline - 1/3 width */}
                <div className="space-y-6">
                    {/* Quick Actions Grid */}
                    <Card className="shadow-sm border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Acciones Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {userPermissions.canAddCashIn && (
                                    <Button
                                        variant="outline"
                                        className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-solid hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all"
                                        onClick={onCashIn}
                                    >
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                                            <PlusCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-300">Entrada</span>
                                    </Button>
                                )}

                                {userPermissions.canAddCashOut && (
                                    <Button
                                        variant="outline"
                                        className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-solid hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                                        onClick={onCashOut}
                                    >
                                        <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-full">
                                            <MinusCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <span className="font-semibold text-xs text-rose-700 dark:text-rose-300">Salida</span>
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    className="h-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-solid hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all col-span-2"
                                    onClick={onCashCount}
                                >
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                                        <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="font-semibold text-xs text-blue-700 dark:text-blue-300">Realizar Arqueo</span>
                                </Button>
                            </div>

                            {userPermissions.canCloseRegister && (
                                <div className="mt-4 pt-4 border-t">
                                    <Button
                                        variant="destructive"
                                        className="w-full shadow-lg hover:shadow-xl transition-all"
                                        onClick={onCloseRegister}
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        Cerrar Caja
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card className="flex-1 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                                <History className="mr-2 h-4 w-4" />
                                Últimos Movimientos
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <CashMovementTimeline movements={movements.slice(0, 5)} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
