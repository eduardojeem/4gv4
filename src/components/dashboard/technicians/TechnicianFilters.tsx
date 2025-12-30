'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

interface TechnicianFiltersProps {
    searchTerm: string
    setSearchTerm: (value: string) => void
    statusFilter: string
    setStatusFilter: (value: string) => void
    sortBy: string
    setSortBy: (value: string) => void
}

export function TechnicianFilters({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy
}: TechnicianFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 max-w-sm">
                <Label htmlFor="search" className="sr-only">Buscar técnico</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="search"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
                <Label htmlFor="status-filter" className="sr-only">Filtrar por estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="busy">Ocupado</SelectItem>
                        <SelectItem value="offline">Fuera de servicio</SelectItem>
                        <SelectItem value="unavailable">No disponible</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Sort By */}
            <div className="w-full sm:w-52">
                <Label htmlFor="sort-by" className="sr-only">Ordenar por</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger id="sort-by">
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Nombre (A-Z)</SelectItem>
                        <SelectItem value="activeJobs">Trabajos activos</SelectItem>
                        <SelectItem value="completedThisMonth">Completados este mes</SelectItem>
                        <SelectItem value="rating">Calificación</SelectItem>
                        <SelectItem value="workload">Carga de trabajo</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}
