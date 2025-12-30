'use client'

import { Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface SupplierFiltersProps {
    search: string
    onSearchChange: (value: string) => void
    statusFilter: string
    onStatusChange: (value: string) => void
    businessTypeFilter: string
    onBusinessTypeChange: (value: string) => void
    sortBy: string
    onSortChange: (value: string) => void
}

export function SupplierFilters({
    search,
    onSearchChange,
    statusFilter,
    onStatusChange,
    businessTypeFilter,
    onBusinessTypeChange,
    sortBy,
    onSortChange
}: SupplierFiltersProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar por nombre, email, contacto..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                </SelectContent>
            </Select>

            {/* Business Type Filter */}
            <Select value={businessTypeFilter} onValueChange={onBusinessTypeChange}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="manufacturer">Fabricante</SelectItem>
                    <SelectItem value="distributor">Distribuidor</SelectItem>
                    <SelectItem value="wholesaler">Mayorista</SelectItem>
                    <SelectItem value="service_provider">Proveedor de Servicios</SelectItem>
                    <SelectItem value="retailer">Minorista</SelectItem>
                </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={onSortChange}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                    <SelectItem value="rating-desc">Mejor valorados</SelectItem>
                    <SelectItem value="created-desc">Más recientes</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
