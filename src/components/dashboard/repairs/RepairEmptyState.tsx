'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface RepairEmptyStateProps {
    hasFilters: boolean
    onNewRepair?: () => void
}

export function RepairEmptyState({ hasFilters, onNewRepair }: RepairEmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg">
            <div className="text-center max-w-md">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No hay reparaciones</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    {hasFilters
                        ? 'No se encontraron resultados con los filtros aplicados.'
                        : 'Comienza creando tu primera reparación.'}
                </p>
                {!hasFilters && onNewRepair && (
                    <Button onClick={onNewRepair}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Reparación
                    </Button>
                )}
            </div>
        </div>
    )
}
