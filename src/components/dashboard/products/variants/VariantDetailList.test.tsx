import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { VariantDetailList } from './VariantDetailList'
import { filterDetailVariants, summarizeVariants, type DetailVariant } from './variant-detail-logic'
vi.mock('@/components/ui/app-image', () => ({ AppImage: () => <span>Imagen del producto</span> }))
const variants: DetailVariant[] = [
  { id: 'a', name: 'Negro · 128 GB', sku: 'NEG-128', salePrice: 100, purchasePrice: null, stockQuantity: 2, isActive: true, attributes: { Color: 'Negro', Memoria: '128 GB' } },
  { id: 'b', name: 'Blanco · 256 GB', sku: 'BLA-256', salePrice: 150, purchasePrice: 0, stockQuantity: 0, isActive: false, attributes: { Color: 'Blanco', Memoria: '256 GB' } },
]
const props = { variants, canViewCost: false, branchStock: [{variantId: 'a', branchId:'central', branchName:'Casa Central', quantity:2}], branchStockState: 'ready' as const, formatCurrency: (n: number) => `Gs ${n}` }
describe('variant detail', () => {
 it('summarizes all variants including inactive/out of stock', () => expect(summarizeVariants(variants)).toEqual({total:2,active:1,outOfStock:1,stock:2}))
 it('combines search, stock, status and dynamic attribute filters', () => {
   expect(filterDetailVariants(variants, {search:'neg-128',stock:'in_stock',status:'active',attributes:{Color:'Negro'}})).toEqual([variants[0]])
   expect(filterDetailVariants(variants, {search:'',stock:'out_of_stock',status:'inactive',attributes:{Memoria:'256 GB'}})).toEqual([variants[1]])
   expect(filterDetailVariants(variants, {search:'',stock:'in_stock',status:'inactive',attributes:{}})).toEqual([])
 })
 it('filters the responsive views using attribute controls', () => {
   render(<VariantDetailList {...props} />)
   fireEvent.change(screen.getByLabelText('Filtrar Color'), {target:{value:'Negro'}})
   expect(screen.queryByText('Blanco · 256 GB')).not.toBeInTheDocument()
   expect(screen.getByText('1 de 2 variantes')).toBeInTheDocument()
 })
 it('hides every cost and margin value without permission, including expanded cards', () => {
   render(<VariantDetailList {...props} />)
   fireEvent.click(screen.getAllByRole('button', {name:'Expandir Negro · 128 GB'})[1])
   expect(screen.queryByText(/^Costo/)).not.toBeInTheDocument()
   expect(screen.queryByText(/^Margen/)).not.toBeInTheDocument()
   const card = screen.getAllByRole('article')[0]
   expect(within(card).getByText('Casa Central')).toBeInTheDocument()
 })
 it('preserves unknown versus zero authorized cost', () => {
   render(<VariantDetailList {...props} canViewCost />)
   expect(screen.getByText('Sin costo')).toBeInTheDocument()
   expect(screen.getByText('Gs 0')).toBeInTheDocument()
   fireEvent.click(screen.getAllByRole('button', {name:'Expandir Blanco · 256 GB'})[1])
   expect(screen.getAllByText('Costo: Gs 0')[0]).toBeInTheDocument()
   expect(screen.getAllByText('Margen: 100.0%')[0]).toBeInTheDocument()
 })
 it('filters stock and state from accessible controls', () => {
   render(<VariantDetailList {...props} />)
   fireEvent.change(screen.getByLabelText('Filtrar stock'), {target:{value:'out_of_stock'}})
   fireEvent.change(screen.getByLabelText('Filtrar estado'), {target:{value:'inactive'}})
   expect(screen.queryByText('Negro · 128 GB')).not.toBeInTheDocument()
   expect(screen.getByText('1 de 2 variantes')).toBeInTheDocument()
   fireEvent.change(screen.getByLabelText('Buscar variantes por SKU o atributos'), {target:{value:'NEG'}})
   expect(screen.getByText('No hay variantes que coincidan con los filtros.')).toBeInTheDocument()
 })
 it('does not fabricate branch quantities when the read fails', () => {
   render(<VariantDetailList {...props} branchStock={[]} branchStockState="error" />)
   fireEvent.click(screen.getAllByRole('button', {name:'Expandir Negro · 128 GB'})[1])
   expect(screen.getAllByText('No se pudo consultar el desglose.')).toHaveLength(2)
   expect(screen.queryByText('Casa Central')).not.toBeInTheDocument()
 })
 it('renders an empty state without table headers', () => {
   render(<VariantDetailList {...props} variants={[]} />)
   expect(screen.getByText('Este producto no tiene variantes.')).toBeInTheDocument()
   expect(screen.queryByRole('table')).not.toBeInTheDocument()
 })
})
