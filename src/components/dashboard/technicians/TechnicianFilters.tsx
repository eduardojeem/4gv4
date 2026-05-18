'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  setSortBy,
}: TechnicianFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1 max-w-sm">
        <Label htmlFor="search" className="sr-only">
          Buscar tecnico
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Buscar por nombre o especialidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="w-full sm:w-48">
        <Label htmlFor="status-filter" className="sr-only">
          Filtrar por carga
        </Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger id="status-filter">
            <SelectValue placeholder="Carga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cargas</SelectItem>
            <SelectItem value="no_load">Sin carga</SelectItem>
            <SelectItem value="light_load">Carga baja</SelectItem>
            <SelectItem value="medium_load">Carga media</SelectItem>
            <SelectItem value="high_load">Carga alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-56">
        <Label htmlFor="sort-by" className="sr-only">
          Ordenar por
        </Label>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger id="sort-by">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre (A-Z)</SelectItem>
            <SelectItem value="activeJobs">Trabajos activos</SelectItem>
            <SelectItem value="completedThisMonth">Cierres este mes</SelectItem>
            <SelectItem value="totalCompleted">Total cerrados</SelectItem>
            <SelectItem value="workload">Carga de trabajo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
