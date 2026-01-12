'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { PromotionFilters as Filters } from '@/types/promotion'

interface PromotionFiltersProps {
    filters: Filters
    onUpdateFilters: (filters: Partial<Filters>) => void
    onClearFilters: () => void
}

export function PromotionFilters({
    filters,
    onUpdateFilters,
    onClearFilters
}: PromotionFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(true)

    const activeFilterCount = [
        filters.search !== '',
        filters.status !== 'all',
        filters.type !== 'all'
    ].filter(Boolean).length

    return (
        <Card>
            <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        <CardTitle className="text-base">Filtros</CardTitle>
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Search */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Búsqueda</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Nombre, código..."
                                    value={filters.search}
                                    onChange={(e) => onUpdateFilters({ search: e.target.value })}
                                    className="pl-8"
                                />
                                {filters.search && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                                        onClick={() => onUpdateFilters({ search: '' })}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Estado</label>
                            <Select
                                value={filters.status}
                                onValueChange={(value) => onUpdateFilters({ status: value as Filters['status'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="active">Activas</SelectItem>
                                    <SelectItem value="scheduled">Programadas</SelectItem>
                                    <SelectItem value="expired">Expiradas</SelectItem>
                                    <SelectItem value="inactive">Inactivas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type Filter */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <Select
                                value={filters.type}
                                onValueChange={(value) => onUpdateFilters({ type: value as Filters['type'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="percentage">Porcentaje</SelectItem>
                                    <SelectItem value="fixed">Monto Fijo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {activeFilterCount > 0 && (
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClearFilters}
                                className="gap-2"
                            >
                                <X className="h-4 w-4" />
                                Limpiar filtros
                            </Button>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}
