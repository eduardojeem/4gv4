'use client'

import Link from 'next/link'
import { useCatalogSync } from '@/hooks/use-catalog-sync'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface IntegratedCatalogSelectorProps {
  selectedCategory?: string
  selectedSubcategory?: string
  selectedBrand?: string
  selectedSupplier?: string
  onCategoryChange?: (id: string, subcategory?: string) => void
  onBrandChange?: (id: string) => void
  onSupplierChange?: (id: string) => void
  showQuickAdd?: boolean
  compact?: boolean
  className?: string
}

export function IntegratedCatalogSelector(props: IntegratedCatalogSelectorProps) {
  const { categories, brands, suppliers, ready, error, refresh } = useCatalogSync()
  const fields = [
    { kind: 'categories', label: 'Categoría', rows: categories, value: props.selectedCategory, change: props.onCategoryChange },
    { kind: 'brands', label: 'Marca', rows: brands, value: props.selectedBrand, change: props.onBrandChange },
    { kind: 'suppliers', label: 'Proveedor', rows: suppliers, value: props.selectedSupplier, change: props.onSupplierChange },
  ]
  return <div className={props.className}>
    {error && <p role="alert">{error}</p>}
    {fields.map(field => <div key={field.kind} className="space-y-2 mb-3">
      <Select value={field.value || ''} onValueChange={field.change} disabled={!ready}>
        <SelectTrigger aria-label={field.label}><SelectValue placeholder={field.label} /></SelectTrigger>
        <SelectContent>{field.rows.filter(item => item.is_active).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
      </Select>
      {props.showQuickAdd && <Link className="text-sm underline" href={`/dashboard/${field.kind}`}>Gestionar {field.label.toLowerCase()}</Link>}
    </div>)}
    <button type="button" className="text-sm underline" onClick={refresh}>Actualizar catálogo</button>
  </div>
}
