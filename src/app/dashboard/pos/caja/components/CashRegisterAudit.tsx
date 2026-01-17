'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { 
    ShieldAlert, User, Clock, ArrowRight, Activity, 
    DoorOpen, DoorClosed, PlusCircle, MinusCircle, ShoppingCart 
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { AuditLogModal } from '../../components/AuditLogModal'

interface CashRegisterAuditProps {
    onOpenFullAudit: () => void
}

export function CashRegisterAudit({ onOpenFullAudit }: CashRegisterAuditProps) {
    const { auditLog } = useCashRegisterContext()
    const [isFullAuditOpen, setIsFullAuditOpen] = useState(false)

    const getActionIcon = (action: string) => {
        const normalized = action.toLowerCase()
        if (normalized.includes('open') || normalized.includes('apertura')) return <DoorOpen className="h-4 w-4 text-emerald-600" />
        if (normalized.includes('clos') || normalized.includes('cierre')) return <DoorClosed className="h-4 w-4 text-rose-600" />
        if (normalized.includes('in') || normalized.includes('ingreso')) return <PlusCircle className="h-4 w-4 text-blue-600" />
        if (normalized.includes('out') || normalized.includes('egreso') || normalized.includes('retiro')) return <MinusCircle className="h-4 w-4 text-amber-600" />
        if (normalized.includes('sale') || normalized.includes('venta')) return <ShoppingCart className="h-4 w-4 text-violet-600" />
        return <Activity className="h-4 w-4 text-gray-500" />
    }

    const getActionColor = (action: string) => {
        const normalized = action.toLowerCase()
        if (normalized.includes('open')) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        if (normalized.includes('clos')) return 'bg-rose-100 text-rose-700 border-rose-200'
        if (normalized.includes('in')) return 'bg-blue-100 text-blue-700 border-blue-200'
        if (normalized.includes('out')) return 'bg-amber-100 text-amber-700 border-amber-200'
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-gray-500" />
                        Registro de Actividad
                    </h3>
                    <p className="text-sm text-muted-foreground">Monitoreo de seguridad y operaciones sensibles</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullAuditOpen(true)}
                    className="shadow-sm hover:shadow-md transition-all"
                >
                    Ver Registro Completo
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            </div>

            <Card className="shadow-sm border-none bg-white dark:bg-gray-950">
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px] w-full">
                        {auditLog.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {auditLog.slice(0, 20).map((entry, i) => (
                                    <div key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        
                                        {/* Left: Icon & Action */}
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                                                {getActionIcon(entry.action)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className={`text-[10px] font-medium uppercase tracking-wide border ${getActionColor(entry.action)}`}>
                                                        {entry.action.replace(/_/g, ' ')}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground flex items-center">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {new Date(entry.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {entry.details || 'Sin detalles adicionales'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right: User & Amount */}
                                        <div className="flex items-center justify-between sm:justify-end gap-6 min-w-[200px] mt-2 sm:mt-0 pl-12 sm:pl-0">
                                            {entry.amount !== undefined && (
                                                <div className="text-right">
                                                    <span className="block text-xs text-muted-foreground">Monto</span>
                                                    <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                                                        {formatCurrency(entry.amount)}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full">
                                                <User className="h-3 w-3" />
                                                <span className="truncate max-w-[100px]" title={entry.userName || entry.userId}>
                                                    {entry.userName || 'Sistema'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                <Activity className="h-12 w-12 opacity-20 mb-3" />
                                <p>No hay registros de actividad recientes</p>
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            <AuditLogModal 
                isOpen={isFullAuditOpen}
                onClose={() => setIsFullAuditOpen(false)}
            />
        </div>
    )
}
