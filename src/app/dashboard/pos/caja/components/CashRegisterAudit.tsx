'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'

interface CashRegisterAuditProps {
    onOpenFullAudit: () => void
}

export function CashRegisterAudit({ onOpenFullAudit }: CashRegisterAuditProps) {
    const { auditLog } = useCashRegisterContext()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Registro de Auditoría</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenFullAudit}
                    >
                        Ver Completo
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] w-full pr-4">
                    <div className="space-y-2">
                        {auditLog.slice(0, 10).map((entry, i) => (
                            <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-xs">
                                        {entry.action.replace('_', ' ')}
                                    </Badge>
                                    <span className="text-sm">{entry.userName || entry.userId || 'Sistema'}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(entry.timestamp).toLocaleString()}
                                </span>
                            </div>
                        ))}
                        {auditLog.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                No hay entradas de auditoría
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
