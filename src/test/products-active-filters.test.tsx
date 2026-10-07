import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActiveProductFilters } from '@/components/dashboard/products-modern/ActiveProductFilters'

describe('filtros visibles de productos', () => {
  it('no presenta un fallo de carga como cero coincidencias', () => {
    render(<ActiveProductFilters filters={{}} searchQuery="" categories={[]} suppliers={[]} onChange={vi.fn()} onSearchChange={vi.fn()} onClear={vi.fn()} total={0} error />)
    expect(screen.getByRole('status')).toHaveTextContent('No se pudieron actualizar')
    expect(screen.getByRole('status')).not.toHaveTextContent('0 resultados')
  })
  it('muestra filtros, resultados y sucursal sin depender de la página cargada', () => {
    render(<ActiveProductFilters filters={{ category_id: 'cat', is_active: false, price_min: 0 }} searchQuery="café" categories={[{ id: 'cat', name: 'Almacén' }]} suppliers={[]} onChange={vi.fn()} onSearchChange={vi.fn()} onClear={vi.fn()} total={120} branchName="Centro" />)
    expect(screen.getByRole('status')).toHaveTextContent('120 resultados')
    expect(screen.getByRole('status')).toHaveTextContent('Centro')
    expect(screen.getByRole('button', { name: 'Quitar Categoría: Almacén' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar Estado: Inactivos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar Precio desde: 0' })).toBeInTheDocument()
  })

  it('quitar bajo stock limpia el filtro rápido y el avanzado', () => {
    const onChange = vi.fn()
    render(<ActiveProductFilters filters={{ quick_filter: 'low_stock', stock_status: 'out_of_stock', catalog_kind: 'part' }} searchQuery="" categories={[]} suppliers={[]} onChange={onChange} onSearchChange={vi.fn()} onClear={vi.fn()} total={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Stock: Bajo stock' }))
    expect(onChange).toHaveBeenCalledWith({ quick_filter: null, stock_status: undefined })
  })

  it('limpia la búsqueda por separado y ofrece limpiar todo', () => {
    const onSearch = vi.fn(); const onClear = vi.fn()
    render(<ActiveProductFilters filters={{ catalog_kind: 'part' }} searchQuery="779" categories={[]} suppliers={[]} onChange={vi.fn()} onSearchChange={onSearch} onClear={onClear} total={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Búsqueda: 779' }))
    expect(onSearch).toHaveBeenCalledWith('')
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar todo' }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})
