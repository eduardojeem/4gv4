'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { ArrowLeft, FileText, Shield, RefreshCw } from 'lucide-react'
import { ConnectionStatus } from '../../components/ConnectionStatus'
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import { toast } from 'sonner'

interface CashRegisterHeaderProps {
    onOpenPermissions: () => void
    onOpenAudit: () => void
}

export function CashRegisterHeader({ onOpenPermissions, onOpenAudit }: CashRegisterHeaderProps) {
    const {
        registers,
        activeRegisterId,
        setActiveRegisterId,
        getCurrentRegister,
        isOnline,
        syncWithServer
    } = useCashRegisterContext()

    const handleSync = async () => {
        const success = await syncWithServer()
        if (success) {
            toast.success("Datos sincronizados")
        } else {
            toast.error("Error al sincronizar")
        }
    }

    const registerName = registers.find(r => r.id === activeRegisterId)?.name || 'Caja'
    const isRegisterOpen = getCurrentRegister.isOpen

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/pos">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary" />
                        Detalles de Caja - {registerName}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={isRegisterOpen ? "default" : "secondary"}>
                            {isRegisterOpen ? 'Abierta' : 'Cerrada'}
                        </Badge>
                        <span>•</span>
                        <span>{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
                <div className="mr-2">
                    <Select value={activeRegisterId} onValueChange={(val) => setActiveRegisterId(val)}>
                        <SelectTrigger className="h-9 w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {registers.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSync}
                    title="Sincronizar datos"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>

                <ConnectionStatus
                    status={isOnline ? 'online' : 'offline'}
                    onSync={syncWithServer}
                />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenPermissions}
                >
                    <Shield className="mr-2 h-4 w-4" />
                    Permisos
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenAudit}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Auditoría
                </Button>
            </div>
        </div>
    )
}
