import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

interface UsersFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  roleFilter: string
  onRoleFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
}

export function UsersFilters({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange
}: UsersFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4 bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
      <div className="relative md:col-span-2">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Buscar por nombre, email o departamento..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        />
      </div>
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <SelectValue placeholder="Filtrar por rol" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los roles</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
          <SelectItem value="supervisor">Supervisor</SelectItem>
          <SelectItem value="vendedor">Vendedor</SelectItem>
          <SelectItem value="tecnico">Técnico</SelectItem>
          <SelectItem value="cliente">Cliente</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <SelectValue placeholder="Filtrar por estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="active">Activo</SelectItem>
          <SelectItem value="inactive">Inactivo</SelectItem>
          <SelectItem value="suspended">Suspendido</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
