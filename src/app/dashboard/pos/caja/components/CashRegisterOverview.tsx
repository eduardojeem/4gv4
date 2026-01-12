'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DollarSign, ArrowUpCircle, ArrowDownCircle, History,
    Lock, Calculator, Save, AlertTriangle, PlusCircle, MinusCircle
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
        cashReport
    } = useCashRegisterContext()

    const isRegisterOpen = getCurrentRegister.isOpen
    const movements = [...getCurrentRegister.movements].reverse()
    const discrepancy = calculateDiscrepancy()

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
                <Card className="overflow-hidden relative border-none shadow-md bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <DollarSign className="h-24 w-24" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Actual</CardTitle>
                        <div className="p-2 bg-primary/10 rounded-full">
                            <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-bold tracking-tight text-primary">
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

                <Card className="overflow-hidden relative border-none shadow-md bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                            <ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(cashReport ? cashReport.incomes : 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ventas + Entradas</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none shadow-md bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-background">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle>
                        <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-full">
                            <ArrowDownCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                            {formatCurrency(cashReport ? cashReport.expenses : 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Retiros de caja</p>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden relative border-none shadow-md bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-background">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                            <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
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
                        <CardTitle className="text-lg">Análisis de Flujo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CashRegisterCharts cashReport={cashReport || {}} movements={movements} />
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
