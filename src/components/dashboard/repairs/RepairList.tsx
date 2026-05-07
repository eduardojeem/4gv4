import React, { memo } from 'react'
import {
    Table, TableBody, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { Repair, RepairStatus } from '@/types/repairs'
import { RepairRow } from './RepairRow'

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
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                    <p className="text-sm text-muted-foreground">Cargando reparaciones...</p>
                </div>
            </div>
        )
    }

    if (repairs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                <Wrench className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No se encontraron reparaciones</h3>
                <p className="text-sm text-gray-400 dark:text-gray-500">Ajustá los filtros o creá una nueva reparación</p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                            <TableHead className="w-[90px] text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ticket</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Cliente</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dispositivo</TableHead>
                            <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Problema</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Estado</TableHead>
                            <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Prioridad</TableHead>
                            <TableHead className="hidden xl:table-cell text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Garantía</TableHead>
                            <TableHead className="hidden xl:table-cell text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Técnico</TableHead>
                            <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Creado</TableHead>
                            <TableHead className="hidden sm:table-cell w-[60px] text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fotos</TableHead>
                            <TableHead className="w-[50px] text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <span className="sr-only">Acciones</span>
                            </TableHead>
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
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{repairs.length}</span> reparacion{repairs.length !== 1 ? 'es' : ''}
                </span>
                <div className="flex items-center gap-2">
                    {repairs.filter(r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado').length > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {repairs.filter(r => r.urgency === 'urgent' && r.status !== 'entregado' && r.status !== 'cancelado').length} urgentes
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    )
})

RepairList.displayName = 'RepairList'
