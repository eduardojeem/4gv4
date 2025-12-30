'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RepairHeaderProps {
    onRefresh: () => void
    onNewRepair: () => void
    isLoading?: boolean
}

export function RepairHeader({ onRefresh, onNewRepair, isLoading }: RepairHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Reparaciones
                </h1>
                <p className="text-muted-foreground mt-1">
                    Gestiona el flujo de trabajo de reparaciones y servicios técnicos.
                </p>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isLoading}
                    title="Actualizar (Ctrl+R)"
                >
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
                <Button onClick={onNewRepair} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nueva Reparación
                    <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                        <span className="text-xs">⌘</span>N
                    </kbd>
                </Button>
            </div>
        </div>
    )
}
