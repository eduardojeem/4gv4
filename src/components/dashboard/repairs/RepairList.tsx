import React, { memo } from 'react'
import {
    Table, TableBody, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Wrench } from 'lucide-react'
import { Repair, RepairStatus } from '@/types/repairs'
import { RepairRow } from './RepairRow'
import { RepairPerformanceMonitor } from './RepairPerformanceMonitor'

interface RepairListProps {
    repairs: Repair[]
    onStatusChange?: (id: string, status: RepairStatus) => void
    onEdit: (repair: Repair) => void
    onView?: (repair: Repair) => void
    onDelete?: (id: string) => void
    onDeliver?: (repair: Repair) => void
    isLoading?: boolean
}

export const RepairList = memo<RepairListProps>(function RepairList({
    repairs,
    onStatusChange,
    onEdit,
    onView,
    onDelete,
    onDeliver,
    isLoading,
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-2">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <p className="text-sm text-muted-foreground">Cargando reparaciones...</p>
                </div>
            </div>
        )
    }

    if (repairs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-muted-foreground/30 dark:border-muted-foreground/20 rounded-lg bg-muted/20 dark:bg-muted/10">
                <Wrench className="h-12 w-12 text-muted-foreground/50 dark:text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1 text-foreground dark:text-foreground">No se encontraron reparaciones</h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground/80">Intenta ajustar los filtros o crea una nueva reparación</p>
            </div>
        )
    }


    return (
        <div className="rounded-lg border border-border dark:border-muted/50 bg-card dark:bg-card/95 overflow-hidden shadow-sm dark:shadow-lg">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 dark:bg-muted/30 hover:bg-muted/50 dark:hover:bg-muted/30 border-b border-border dark:border-muted/40">
                        <TableHead className="w-[100px] text-muted-foreground dark:text-muted-foreground/90">ID</TableHead>
                        <TableHead className="text-muted-foreground dark:text-muted-foreground/90">Cliente</TableHead>
                        <TableHead className="text-muted-foreground dark:text-muted-foreground/90">Dispositivo</TableHead>
                        <TableHead className="hidden md:table-cell text-muted-foreground dark:text-muted-foreground/90">Problema</TableHead>
                        <TableHead className="text-muted-foreground dark:text-muted-foreground/90">Estado</TableHead>
                        <TableHead className="hidden lg:table-cell text-muted-foreground dark:text-muted-foreground/90">Prioridad</TableHead>
                        <TableHead className="hidden xl:table-cell text-muted-foreground dark:text-muted-foreground/90">Garantía</TableHead>
                        <TableHead className="hidden xl:table-cell text-muted-foreground dark:text-muted-foreground/90">Técnico</TableHead>
                        <TableHead className="hidden sm:table-cell text-muted-foreground dark:text-muted-foreground/90">Creado</TableHead>
                        <TableHead className="hidden sm:table-cell w-[80px] text-muted-foreground dark:text-muted-foreground/90">Fotos</TableHead>
                        <TableHead className="text-right text-muted-foreground dark:text-muted-foreground/90">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {repairs.map((repair) => (
                        <RepairRow
                            key={repair.id}
                            repair={repair}
                            onStatusChange={onStatusChange}
                            onEdit={onEdit}
                            onView={onView}
                            onDelete={onDelete}
                            onDeliver={onDeliver}
                        />
                    ))}
                </TableBody>
            </Table>

            {/* Results count footer with performance monitor */}
            <div className="border-t border-border dark:border-muted/40 bg-muted/40 dark:bg-muted/20 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground dark:text-muted-foreground/80">
                    Mostrando <span className="font-medium text-foreground dark:text-foreground">{repairs.length}</span> reparacion{repairs.length !== 1 && 'es'}
                </span>
                <RepairPerformanceMonitor 
                    repairCount={repairs.length}
                    filteredCount={repairs.length}
                    isVirtualized={false}
                />
            </div>
        </div>
    )
})

RepairList.displayName = 'RepairList'
