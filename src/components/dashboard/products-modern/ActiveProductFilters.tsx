import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DashboardFilters } from '@/types/products-dashboard'

type NamedOption = { id: string; name: string }
interface Props {
  filters: DashboardFilters
  searchQuery: string
  categories: NamedOption[]
  suppliers: NamedOption[]
  onChange: (filters: Partial<DashboardFilters>) => void
  onSearchChange: (query: string) => void
  onClear: () => void
  total: number
  branchName?: string
  loading?: boolean
  partial?: boolean
  error?: boolean
}

export function ActiveProductFilters({ filters, searchQuery, categories, suppliers, onChange, onSearchChange, onClear, total, branchName, loading, partial, error }: Props) {
  const chips: { label: string; remove: () => void }[] = []
  const add = (label: string, patch: Partial<DashboardFilters>) => chips.push({ label, remove: () => onChange(patch) })
  if (searchQuery.trim()) chips.push({ label: `Búsqueda: ${searchQuery.trim()}`, remove: () => onSearchChange('') })
  if (filters.category_id) add(`Categoría: ${categories.find(row => row.id === filters.category_id)?.name ?? filters.category_id}`, { category_id: undefined })
  if (filters.supplier_id) add(`Proveedor: ${suppliers.find(row => row.id === filters.supplier_id)?.name ?? filters.supplier_id}`, { supplier_id: undefined })
  if (filters.brand) add(`Marca: ${filters.brand}`, { brand: undefined })
  const quickStock = filters.quick_filter === 'low_stock' ? 'low_stock' : filters.quick_filter === 'out_of_stock' ? 'out_of_stock' : undefined
  const stock = quickStock ?? filters.stock_status
  if (stock) add(`Stock: ${{ in_stock: 'Con stock', low_stock: 'Bajo stock', out_of_stock: 'Sin stock' }[stock]}`, { stock_status: undefined, ...(quickStock ? { quick_filter: null } : {}) })
  const active = filters.quick_filter === 'active' ? true : filters.quick_filter === 'inactive' ? false : filters.is_active
  if (typeof active === 'boolean') add(`Estado: ${active ? 'Activos' : 'Inactivos'}`, { is_active: undefined, ...(['active', 'inactive'].includes(filters.quick_filter ?? '') ? { quick_filter: null } : {}) })
  if (typeof filters.price_min === 'number') add(`Precio desde: ${filters.price_min.toLocaleString('es-PY')}`, { price_min: undefined })
  if (typeof filters.price_max === 'number') add(`Precio hasta: ${filters.price_max.toLocaleString('es-PY')}`, { price_max: undefined })
  if (filters.device_brand) add(`Marca del equipo: ${filters.device_brand}`, { device_brand: undefined, device_model: undefined })
  if (filters.device_model) add(`Modelo: ${filters.device_model}`, { device_model: undefined })
  if (filters.quick_filter === 'variants') add('Con variantes', { quick_filter: null })
  if (filters.item_type && filters.item_type !== 'all') add(`Tipo: ${filters.item_type === 'services' ? 'Servicios' : 'Productos'}`, { item_type: undefined })

  return <div className="space-y-2">
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
      {loading ? 'Actualizando resultados…' : error ? 'No se pudieron actualizar los resultados' : `${total.toLocaleString('es-PY')} ${total === 1 ? 'resultado' : 'resultados'}${partial ? ' (parciales)' : ''}`}
      {' · '}{branchName ? `Stock de sucursal: ${branchName}` : 'Inventario general'}
      {' · '}{filters.catalog_kind === 'part' ? 'Productos físicos' : filters.catalog_kind === 'service' ? 'Servicios' : 'Catálogo completo'}
    </p>
    {chips.length > 0 && <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros activos">
      {chips.map(chip => <Button key={chip.label} type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal text-left text-xs" onClick={chip.remove} aria-label={`Quitar ${chip.label}`}>
        <span className="break-all">{chip.label}</span><X className="ml-1 h-3 w-3 shrink-0" aria-hidden="true" />
      </Button>)}
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>Limpiar todo</Button>
    </div>}
  </div>
}
