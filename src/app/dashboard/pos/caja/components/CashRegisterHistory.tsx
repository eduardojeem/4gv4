'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, Shield, CheckCircle, AlertTriangle, Calendar, FileText, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { ScrollArea } from "@/components/ui/scroll-area"
import { ZClosureHistoryModal } from '../../components/ZClosureHistoryModal'

interface CashRegisterHistoryProps {
    onOpenFullHistory: () => void
    onOpenAudit: () => void
}

export function CashRegisterHistory({ onOpenFullHistory, onOpenAudit }: CashRegisterHistoryProps) {
    const { zClosureHistory } = useCashRegisterContext()
    const [selectedClosure, setSelectedClosure] = useState<ZClosureRecord | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

    const handleClosureClick = (closure: ZClosureRecord) => {
        setSelectedClosure(closure)
        setIsDetailModalOpen(true)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Historial de Operaciones</h3>
                    <p className="text-sm text-muted-foreground">Registro de cierres de caja y auditoría</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenFullHistory}
                        className="flex-1 sm:flex-none shadow-sm hover:shadow-md transition-all"
                    >
                        <History className="h-4 w-4 mr-2 text-blue-600" />
                        Historial Completo
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenAudit}
                        className="flex-1 sm:flex-none shadow-sm hover:shadow-md transition-all"
                    >
                        <Shield className="h-4 w-4 mr-2 text-violet-600" />
                        Auditoría
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Stats Summary Card */}
                <Card className="md:col-span-1 shadow-sm border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-950 dark:to-blue-950/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Resumen de Cierres</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Total Cierres</span>
                                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{zClosureHistory.length}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-green-600 dark:text-green-400">
                                        <CheckCircle className="h-3 w-3 mr-2" />
                                        Correctos
                                    </span>
                                    <span className="font-medium">
                                        {zClosureHistory.filter(c => Math.abs(c.discrepancy) < 1).length}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-3 w-3 mr-2" />
                                        Con Diferencias
                                    </span>
                                    <span className="font-medium">
                                        {zClosureHistory.filter(c => Math.abs(c.discrepancy) >= 1).length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent History List */}
                <Card className="md:col-span-2 shadow-sm border-none bg-white dark:bg-gray-950">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-medium flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            Últimos 5 Cierres
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {zClosureHistory.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {zClosureHistory.slice(0, 5).map((closure) => {
                                    const date = new Date(closure.date)
                                    const isPerfect = Math.abs(closure.discrepancy) < 1
                                    
                                    return (
                                        <div 
                                            key={closure.id} 
                                            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group cursor-pointer"
                                            onClick={() => handleClosureClick(closure)}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Left: Date & Status */}
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-1 p-2 rounded-lg ${isPerfect ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {isPerfect ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                            Cierre del {date.toLocaleDateString('es-PY', { day: '2-digit', month: 'long' })}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                                                            <Calendar className="h-3 w-3 mr-1" />
                                                            {date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="mx-1">•</span>
                                                            Por: {closure.closedBy || 'Sistema'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right: Metrics */}
                                                <div className="flex items-center gap-6 text-sm">
                                                    <div className="text-right">
                                                        <p className="text-xs text-muted-foreground">Ventas Totales</p>
                                                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {formatCurrency(closure.totalSales)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-xs text-muted-foreground">Saldo Final</p>
                                                        <p className="font-medium text-gray-700 dark:text-gray-300">
                                                            {formatCurrency(closure.closingBalance)}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                                </div>
                                            </div>
                                            
                                            {!isPerfect && (
                                                <div className="mt-2 ml-12 text-xs font-medium text-amber-600 bg-amber-50 inline-block px-2 py-1 rounded">
                                                    Diferencia: {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                <History className="h-12 w-12 opacity-20 mb-3" />
                                <p>No hay historial de cierres disponible</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Reuse the Modal Component we just refactored */}
            <ZClosureHistoryModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                onViewDetails={() => {}} // Not needed as we open it in detail mode
            />
        </div>
    )
}
