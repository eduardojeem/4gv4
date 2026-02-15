import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface ProductFiltersProps {
  filters: {
    category_id: string
    min_price: number
    max_price: number
    in_stock: boolean
  }
  setFilters: (filters: any) => void
}

export function ProductFilters({ filters, setFilters }: ProductFiltersProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Filtros</h3>

      {/* In Stock Only */}
      <div className="flex items-center justify-between">
        <Label htmlFor="in-stock">Solo en stock</Label>
        <Switch
          id="in-stock"
          checked={filters.in_stock}
          onCheckedChange={(checked) =>
            setFilters({ ...filters, in_stock: checked })
          }
        />
      </div>

      {/* Price Range - Simplified for MVP */}
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Más filtros disponibles próximamente
        </p>
      </div>
    </div>
  )
}
