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
import { Search, RotateCw, Clock, Shield, Filter, X } from 'lucide-react'
import type { SessionFilter, MonitorPeriod, DiscrepancyFilterType } from '../types'

interface SessionFiltersProps {
  filter: SessionFilter
  onFilterChange: (filter: SessionFilter) => void
}

export function SessionFilters({ filter, onFilterChange }: SessionFiltersProps) {
  const currentPeriod = filter.period || 'week'

  const hasActiveFilters = Boolean(
    filter.search ||
    (filter.status && filter.status !== 'all') ||
    (filter.discrepancy && filter.discrepancy !== 'all') ||
    (filter.period && filter.period !== 'week') ||
    filter.dateFrom ||
    filter.dateTo
  )

  const handlePeriodClick = (p: MonitorPeriod) => {
    onFilterChange({
      ...filter,
      period: p,
      dateFrom: undefined,
      dateTo: undefined
    })
  }

  return (
    <div className="space-y-3">
      {/* Botonera de Período Rápido */}
      <div className="flex items-center justify-between p-2 rounded-2xl border border-border/60 bg-muted/20 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 ml-1">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'today', label: 'Hoy' },
            { key: 'week', label: 'Esta Semana (Por Defecto)' },
            { key: 'month', label: 'Este Mes' },
            { key: 'year', label: 'Este Año' },
            { key: 'all', label: 'Todo el Historial' }
          ].map(p => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={currentPeriod === p.key ? 'default' : 'outline'}
              onClick={() => handlePeriodClick(p.key as MonitorPeriod)}
              className="h-7 text-xs px-3 rounded-xl font-medium"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Barra de Filtros Específicos */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar caja, cajero, sucursal..."
            className="pl-8 h-9 text-xs rounded-xl bg-card"
            value={filter.search || ''}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
          />
          {filter.search && (
            <button
              onClick={() => onFilterChange({ ...filter, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Estado de Sesión */}
        <Select
          value={filter.status || 'all'}
          onValueChange={(value) => onFilterChange({ ...filter, status: value as SessionFilter['status'] })}
        >
          <SelectTrigger className="w-[145px] h-9 text-xs rounded-xl bg-card">
            <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="open">🟢 Abiertas</SelectItem>
            <SelectItem value="closed">⚪ Cerradas</SelectItem>
            <SelectItem value="suspended">🟡 Suspendidas</SelectItem>
            <SelectItem value="blocked">🔴 Bloqueadas</SelectItem>
          </SelectContent>
        </Select>

        {/* Estado de Arqueo / Discrepancia */}
        <Select
          value={filter.discrepancy || 'all'}
          onValueChange={(value) => onFilterChange({ ...filter, discrepancy: value as DiscrepancyFilterType })}
        >
          <SelectTrigger className="w-[165px] h-9 text-xs rounded-xl bg-card">
            <Shield className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
            <SelectValue placeholder="Arqueo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los arqueos</SelectItem>
            <SelectItem value="perfect">✓ Sin diferencia (Exactas)</SelectItem>
            <SelectItem value="with_diff">⚠️ Con descuadre</SelectItem>
            <SelectItem value="over">▲ Solo sobrantes (+)</SelectItem>
            <SelectItem value="short">▼ Solo faltantes (-)</SelectItem>
          </SelectContent>
        </Select>

        {/* Fechas Personalizadas */}
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-[130px] h-9 text-xs rounded-xl bg-card"
            value={filter.dateFrom || ''}
            onChange={(e) => onFilterChange({ ...filter, dateFrom: e.target.value || undefined, period: undefined })}
            placeholder="Desde"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="date"
            className="w-[130px] h-9 text-xs rounded-xl bg-card"
            value={filter.dateTo || ''}
            onChange={(e) => onFilterChange({ ...filter, dateTo: e.target.value || undefined, period: undefined })}
            placeholder="Hasta"
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs rounded-xl gap-1 text-muted-foreground hover:text-foreground font-semibold"
            onClick={() => onFilterChange({ status: 'all', period: 'week', discrepancy: 'all' })}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Restablecer
          </Button>
        )}
      </div>
    </div>
  )
}
