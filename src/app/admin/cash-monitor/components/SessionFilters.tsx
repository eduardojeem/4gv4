'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Search, RotateCw } from 'lucide-react'
import type { SessionFilter } from '../types'

interface SessionFiltersProps {
  filter: SessionFilter
  onFilterChange: (filter: SessionFilter) => void
}

export function SessionFilters({ filter, onFilterChange }: SessionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <Select
        value={filter.status || 'all'}
        onValueChange={(value) => onFilterChange({ ...filter, status: value as SessionFilter['status'] })}
      >
        <SelectTrigger className="w-[140px] h-9 text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="open">Abiertas</SelectItem>
          <SelectItem value="closed">Cerradas</SelectItem>
          <SelectItem value="suspended">Suspendidas</SelectItem>
          <SelectItem value="blocked">Bloqueadas</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar caja, cajero..."
          className="pl-8 h-9 text-xs"
          value={filter.search || ''}
          onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
        />
      </div>

      {/* Date From */}
      <Input
        type="date"
        className="w-[140px] h-9 text-xs"
        value={filter.dateFrom || ''}
        onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value || undefined })}
        placeholder="Desde"
      />

      {/* Date To */}
      <Input
        type="date"
        className="w-[140px] h-9 text-xs"
        value={filter.dateTo || ''}
        onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value || undefined })}
        placeholder="Hasta"
      />

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 text-xs"
        onClick={() => onFilterChange({ status: 'all' })}
      >
        <RotateCw className="h-3.5 w-3.5 mr-1" />
        Limpiar
      </Button>
    </div>
  )
}
