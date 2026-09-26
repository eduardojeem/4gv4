'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'

interface UsersFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  roleFilter: string
  onRoleFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  showGlobalRoles?: boolean
  /** Oculta el selector de rol cuando la vista ya fija una poblacion (ej. clientes). */
  hideRoleFilter?: boolean
  /** Muestra el selector de acceso mayorista (solo tiene sentido en clientes). */
  showWholesaleFilter?: boolean
  wholesaleFilter?: 'all' | 'wholesale'
  onWholesaleFilterChange?: (value: 'all' | 'wholesale') => void
}

const ROLE_OPTIONS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'owner', label: 'Propietario' },
  { value: 'admin', label: 'Administrador' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'cliente', label: 'Cliente' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'suspended', label: 'Suspendidos' },
]

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  inactive: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  suspended: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
}

export function UsersFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  showGlobalRoles = false,
  hideRoleFilter = false,
  showWholesaleFilter = false,
  wholesaleFilter = 'all',
  onWholesaleFilterChange,
}: UsersFiltersProps) {
  const normalizedSearchTerm = searchTerm.trim()
  const roleOptions = showGlobalRoles
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => option.value !== 'super_admin' && option.value !== 'cliente')
  const activeFilterCount = [
    normalizedSearchTerm !== '',
    !hideRoleFilter && roleFilter !== 'all',
    showWholesaleFilter && wholesaleFilter !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length

  const clearFilters = () => {
    onSearchChange('')
    onRoleFilterChange('all')
    onStatusFilterChange('all')
    onWholesaleFilterChange?.('all')
  }

  const roleLabel = roleOptions.find((o) => o.value === roleFilter)?.label
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label

  return (
    <div className="space-y-3">
      {/* Filter controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm pr-8"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Role filter */}
        {!hideRoleFilter && (
          <Select value={roleFilter} onValueChange={onRoleFilterChange}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Wholesale filter */}
        {showWholesaleFilter && (
          <Select value={wholesaleFilter} onValueChange={(v) => onWholesaleFilterChange?.(v as 'all' | 'wholesale')}>
            <SelectTrigger className="w-[170px] h-9 text-sm">
              <SelectValue placeholder="Tipo de cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              <SelectItem value="wholesale">Solo mayoristas</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear all */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={clearFilters}
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
              {activeFilterCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Filtros:</span>

          {normalizedSearchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              &quot;{normalizedSearchTerm}&quot;
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {roleFilter !== 'all' && (
            <button
              onClick={() => onRoleFilterChange('all')}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {roleLabel}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}

          {showWholesaleFilter && wholesaleFilter !== 'all' && (
            <button
              onClick={() => onWholesaleFilterChange?.('all')}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 transition-opacity hover:opacity-80 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              Solo mayoristas
              <X className="h-3 w-3" />
            </button>
          )}

          {statusFilter !== 'all' && (
            <button
              onClick={() => onStatusFilterChange('all')}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity ${STATUS_BADGE[statusFilter] ?? 'bg-muted/60'}`}
            >
              {statusLabel}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
