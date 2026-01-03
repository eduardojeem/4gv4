'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X, Users, Calendar as CalendarIcon, SlidersHorizontal } from 'lucide-react'
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

interface RepairFiltersProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    statusFilter: RepairStatus | 'all'
    setStatusFilter: (status: RepairStatus | 'all') => void
    priorityFilter: string
    setPriorityFilter: (priority: string) => void
    technicians?: Array<{ id: string; name: string }>
    technicianFilter?: string
    setTechnicianFilter?: (id: string) => void
    dateRange?: DateRange
    setDateRange?: (range: DateRange | undefined) => void
    onOpenSearch?: () => void
}

export const RepairFilters = memo<RepairFiltersProps>(function RepairFilters({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    technicians,
    technicianFilter,
    setTechnicianFilter,
    dateRange,
    setDateRange
}: RepairFiltersProps) {

    // Optimize active filters count calculation
    const activeFiltersCount = useMemo(() => {
        let count = 0
        if (statusFilter !== 'all') count++
        if (priorityFilter !== 'all') count++
        if (technicianFilter && technicianFilter !== 'all') count++
        if (dateRange?.from || dateRange?.to) count++
        return count
    }, [statusFilter, priorityFilter, technicianFilter, dateRange])

    const clearFilters = () => {
        setStatusFilter('all')
        setPriorityFilter('all')
        setSearchTerm('')
        setTechnicianFilter?.('all')
        setDateRange?.(undefined)
    }

    return (
        <div className="space-y-4">
            {/* Main Search Bar with Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, dispositivo, ID de reparación..."
                        className="pl-9 pr-9 h-10"
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
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={activeFiltersCount > 0 ? "default" : "outline"}
                                size="default"
                                className="gap-2"
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                Filtros Avanzados
                                {activeFiltersCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 bg-white dark:bg-muted/90 text-foreground dark:text-foreground border border-muted dark:border-muted/60">
                                        {activeFiltersCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 dark:bg-card/98 dark:border-muted/60 backdrop-blur-sm shadow-lg dark:shadow-2xl" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">Filtros Avanzados</h4>
                                    {activeFiltersCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearFilters}
                                            className="h-8 text-xs"
                                        >
                                            Limpiar todo
                                        </Button>
                                    )}
                                </div>

                                <Separator />

                                {/* Status Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Estado</Label>
                                    <Select
                                        value={statusFilter}
                                        onValueChange={(v) => setStatusFilter(v as RepairStatus | 'all')}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
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
                                </div>

                                {/* Priority Filter */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Prioridad</Label>
                                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                        <SelectTrigger>
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
                                    <div className="space-y-2">
                                        <Label className="text-xs font-medium">Técnico Asignado</Label>
                                        <Select
                                            value={technicianFilter || 'all'}
                                            onValueChange={(v) => setTechnicianFilter?.(v)}
                                        >
                                            <SelectTrigger>
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
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Rango de Fechas</Label>
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
                            className="gap-2"
                        >
                            <X className="h-4 w-4" />
                            Limpiar
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Filters Display */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Filtros activos:</span>

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
