'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X, Users, Calendar as CalendarIcon, SlidersHorizontal, Shield, ShieldCheck, ShieldAlert, Sparkles, Wrench } from 'lucide-react'
import { RepairStatus } from '@/types/repairs'
import { statusConfig, priorityConfig } from '@/config/repair-constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { DateRange } from 'react-day-picker'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { memo, useMemo } from 'react'
import type { WarrantyFilterType } from '@/hooks/use-repair-filters'
import { cn } from '@/lib/utils'

interface RepairFiltersProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    statusFilter: RepairStatus | 'all'
    setStatusFilter: (status: RepairStatus | 'all') => void
    priorityFilter: string
    setPriorityFilter: (priority: string) => void
    warrantyFilter?: WarrantyFilterType
    setWarrantyFilter?: (warranty: WarrantyFilterType) => void
    technicians?: Array<{ id: string; name: string }>
    technicianFilter?: string
    setTechnicianFilter?: (id: string) => void
    dateRange?: DateRange
    setDateRange?: (range: DateRange | undefined) => void
    warrantyCounts?: {
        inWarranty: number
        expiring: number
    }
}

export const RepairFilters = memo<RepairFiltersProps>(function RepairFilters({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    warrantyFilter = 'all',
    setWarrantyFilter,
    technicians,
    technicianFilter,
    setTechnicianFilter,
    dateRange,
    setDateRange,
    warrantyCounts,
}: RepairFiltersProps) {

    // Optimize active filters count calculation
    const advancedFiltersCount = useMemo(() => {
        let count = 0
        if (priorityFilter !== 'all') count++
        if (technicianFilter && technicianFilter !== 'all') count++
        if (warrantyFilter !== 'all') count++
        if (dateRange?.from || dateRange?.to) count++
        return count
    }, [priorityFilter, technicianFilter, warrantyFilter, dateRange])

    const activeFiltersCount = useMemo(() => {
        return advancedFiltersCount + (statusFilter !== 'all' ? 1 : 0)
    }, [advancedFiltersCount, statusFilter])

    const clearFilters = () => {
        setStatusFilter('all')
        setPriorityFilter('all')
        setWarrantyFilter?.('all')
        setSearchTerm('')
        setTechnicianFilter?.('all')
        setDateRange?.(undefined)
    }

    return (
        <div className="space-y-3" data-help-id="repair-filters">
            {/* Quick Filter Tabs (Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setStatusFilter('all')
                        setWarrantyFilter?.('all')
                    }}
                    className={cn(
                        "h-8 rounded-full text-xs font-semibold px-3 shrink-0 transition-all border cursor-pointer",
                        statusFilter === 'all' && warrantyFilter === 'all'
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                >
                    <Wrench className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                    Todas las Reparaciones
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setStatusFilter(statusFilter === 'reparacion' ? 'all' : 'reparacion')
                        setWarrantyFilter?.('all')
                    }}
                    className={cn(
                        "h-8 rounded-full text-xs font-semibold px-3 shrink-0 transition-all border cursor-pointer",
                        statusFilter === 'reparacion' && warrantyFilter === 'all'
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    )}
                >
                    ⚡ En Reparación
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setStatusFilter(statusFilter === 'listo' ? 'all' : 'listo')
                        setWarrantyFilter?.('all')
                    }}
                    className={cn(
                        "h-8 rounded-full text-xs font-semibold px-3 shrink-0 transition-all border cursor-pointer",
                        statusFilter === 'listo' && warrantyFilter === 'all'
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    )}
                >
                    ✅ Listos para Entrega
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setStatusFilter(statusFilter === 'entregado' ? 'all' : 'entregado')
                        setWarrantyFilter?.('all')
                    }}
                    className={cn(
                        "h-8 rounded-full text-xs font-semibold px-3 shrink-0 transition-all border cursor-pointer",
                        statusFilter === 'entregado' && warrantyFilter === 'all'
                            ? "bg-slate-700 text-white border-slate-700 shadow-xs"
                            : "bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                >
                    📦 Entregados
                </Button>

                {/* Filtro Directo de Garantía Activa */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setWarrantyFilter?.(warrantyFilter === 'in_warranty' ? 'all' : 'in_warranty')
                    }}
                    className={cn(
                        "h-8 rounded-full text-xs font-bold px-3 shrink-0 transition-all border cursor-pointer gap-1.5",
                        warrantyFilter === 'in_warranty'
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                    )}
                >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>🛡️ Celulares en Garantía</span>
                    {warrantyCounts?.inWarranty !== undefined && warrantyCounts.inWarranty > 0 && (
                        <span className={cn(
                            "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            warrantyFilter === 'in_warranty'
                                ? "bg-white text-emerald-800"
                                : "bg-emerald-600 text-white"
                        )}>
                            {warrantyCounts.inWarranty}
                        </span>
                    )}
                </Button>

                {/* Filtro de Garantías por Vencer */}
                {warrantyCounts?.expiring !== undefined && warrantyCounts.expiring > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setWarrantyFilter?.(warrantyFilter === 'expiring' ? 'all' : 'expiring')
                        }}
                        className={cn(
                            "h-8 rounded-full text-xs font-bold px-3 shrink-0 transition-all border cursor-pointer gap-1.5",
                            warrantyFilter === 'expiring'
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-950/50"
                        )}
                    >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>⚠️ Por Vencer (&le; 30d)</span>
                        <span className={cn(
                            "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            warrantyFilter === 'expiring'
                                ? "bg-white text-amber-800"
                                : "bg-amber-600 text-white"
                        )}>
                            {warrantyCounts.expiring}
                        </span>
                    </Button>
                )}
            </div>

            {/* Main Search Bar with Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, modelo, falla, SKU o # Ticket (ej. R-1001)..."
                        className="pl-9 pr-9 h-10 rounded-xl text-xs sm:text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Quick Filter Buttons */}
                <div className="flex gap-2">
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as RepairStatus | 'all')}
                    >
                        <SelectTrigger className="h-10 w-[170px] rounded-xl text-xs font-semibold">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            {Object.entries(statusConfig).map(([key, config]) => {
                                const Icon = config.icon
                                return (
                                    <SelectItem key={key} value={key}>
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" />
                                            <span>{config.label}</span>
                                        </div>
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={advancedFiltersCount > 0 ? "default" : "outline"}
                                size="default"
                                className="gap-2 rounded-xl text-xs font-semibold"
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                <span className="hidden sm:inline">Filtros Avanzados</span>
                                <span className="sm:hidden">Filtros</span>
                                {advancedFiltersCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 bg-white dark:bg-muted/90 text-foreground dark:text-foreground border border-muted dark:border-muted/60 text-[10px] px-1.5 py-0">
                                        {advancedFiltersCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[calc(100vw-2rem)] max-w-md sm:w-96 dark:bg-card/98 dark:border-muted/60 backdrop-blur-sm shadow-lg dark:shadow-2xl rounded-2xl" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm">Filtros Avanzados</h4>
                                    {advancedFiltersCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearFilters}
                                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Limpiar todo
                                        </Button>
                                    )}
                                </div>

                                <Separator />

                                {/* Warranty Status Filter */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
                                        Estado de Garantía
                                    </Label>
                                    <Select
                                        value={warrantyFilter}
                                        onValueChange={(v) => setWarrantyFilter?.(v as WarrantyFilterType)}
                                    >
                                        <SelectTrigger className="h-9 text-xs rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las reparaciones</SelectItem>
                                            <SelectItem value="in_warranty">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                    <span>Con Garantía Activa</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="expiring">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                                                    <span>Por Vencer (&le; 30 días)</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="expired">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4 text-red-500" />
                                                    <span>Garantía Vencida</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="no_warranty">
                                                <span>Sin Garantía</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Priority Filter */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Prioridad</Label>
                                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                        <SelectTrigger className="h-9 text-xs rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las prioridades</SelectItem>
                                            {Object.entries(priorityConfig).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{config.icon}</span>
                                                        <span>{config.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Technician Filter */}
                                {technicians && technicians.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Técnico Asignado</Label>
                                        <Select
                                            value={technicianFilter || 'all'}
                                            onValueChange={(v) => setTechnicianFilter?.(v)}
                                        >
                                            <SelectTrigger className="h-9 text-xs rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos los técnicos</SelectItem>
                                                {technicians.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Users className="h-4 w-4" />
                                                            <span>{t.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Date Range Filter */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Rango de Fechas</Label>
                                    <DatePickerWithRange
                                        date={dateRange}
                                        onDateChange={setDateRange}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            size="default"
                            onClick={clearFilters}
                            className="gap-1.5 text-xs rounded-xl"
                        >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">Limpiar</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-medium text-muted-foreground">Filtros activos:</span>

                    {warrantyFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1 pr-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50">
                            <Shield className="h-3 w-3" />
                            <span className="text-xs">
                                Garantía: {warrantyFilter === 'in_warranty' ? 'Activa' : warrantyFilter === 'expiring' ? 'Por Vencer' : warrantyFilter === 'expired' ? 'Vencida' : 'Sin Garantía'}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                onClick={() => setWarrantyFilter?.('all')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {statusFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1 pr-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50">
                            <span className="text-xs">Estado: {statusConfig[statusFilter]?.label}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                onClick={() => setStatusFilter('all')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {priorityFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1 pr-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50">
                            <span className="text-xs">Prioridad: {priorityConfig[priorityFilter]?.label}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                onClick={() => setPriorityFilter('all')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {technicianFilter && technicianFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1 pr-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50">
                            <span className="text-xs">
                                Técnico: {technicians?.find(t => t.id === technicianFilter)?.name || technicianFilter}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-green-100 dark:hover:bg-green-900/50"
                                onClick={() => setTechnicianFilter?.('all')}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}

                    {(dateRange?.from || dateRange?.to) && (
                        <Badge variant="secondary" className="gap-1 pr-1 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50">
                            <CalendarIcon className="h-3 w-3" />
                            <span className="text-xs">
                                {dateRange?.from && dateRange.from.toLocaleDateString()}
                                {dateRange?.from && dateRange?.to && ' - '}
                                {dateRange?.to && dateRange.to.toLocaleDateString()}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                                onClick={() => setDateRange?.(undefined)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    )}
                </div>
            )}
        </div>
    )
})

RepairFilters.displayName = 'RepairFilters'
