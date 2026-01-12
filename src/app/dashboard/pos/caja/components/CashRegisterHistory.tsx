'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'

interface CashRegisterHistoryProps {
    onOpenFullHistory: () => void
    onOpenAudit: () => void
}

export function CashRegisterHistory({ onOpenFullHistory, onOpenAudit }: CashRegisterHistoryProps) {
    const { zClosureHistory } = useCashRegisterContext()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Historial de Cierres Z</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenFullHistory}
                        >
                            <History className="h-4 w-4 mr-2" />
                            Ver Historial Completo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenAudit}
                        >
                            <Shield className="h-4 w-4 mr-2" />
                            Registro de Auditoría
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {zClosureHistory.length > 0 ? (
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground mb-4">
                            Mostrando los últimos 5 cierres. Haga clic en "Ver Historial Completo" para ver todos los registros.
                        </div>
                        <div className="rounded-md border">
                            <div className="grid grid-cols-6 border-b bg-muted/50 p-4 font-medium text-sm">
                                <div>Fecha</div>
                                <div>Saldo Inicial</div>
                                <div>Saldo Final</div>
                                <div>Ventas</div>
                                <div>Diferencia</div>
                                <div>Estado</div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {zClosureHistory.slice(0, 5).map((closure) => (
                                    <div key={closure.id} className="grid grid-cols-6 p-4 border-b last:border-0 text-sm hover:bg-muted/20">
                                        <div>{new Date(closure.date).toLocaleString()}</div>
                                        <div>{formatCurrency(closure.openingBalance)}</div>
                                        <div className="font-bold">{formatCurrency(closure.closingBalance)}</div>
                                        <div className="text-green-600">{formatCurrency(closure.totalSales)}</div>
                                        <div className={`font-bold ${Math.abs(closure.discrepancy) < 1 ? 'text-green-600' : 'text-red-600'}`}>
                                            {closure.discrepancy >= 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                                        </div>
                                        <div>
                                            {Math.abs(closure.discrepancy) < 1 ? (
                                                <Badge variant="default" className="text-xs">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Sin diferencias
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="text-xs">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Con diferencias
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="mb-4">No hay historial de cierres disponible</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenFullHistory}
                        >
                            <History className="h-4 w-4 mr-2" />
                            Ver Historial Completo
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
