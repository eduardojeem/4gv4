import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductCard } from '@/components/dashboard/products-modern/ProductCard'
import type { Product } from '@/types/products'

vi.mock('@/hooks/use-can-view-cost', () => ({ useCanViewCost: () => false }))

describe('tarjeta de producto del dashboard', () => {
  it('expone acciones sin hover y evita que editar abra el detalle', () => {
    const product = { id: 'p1', name: 'Cable USB', sku: 'USB', sale_price: 25000, stock_quantity: 7, is_active: true } as Product
    const edit = vi.fn(), detail = vi.fn(), select = vi.fn()
    render(<ProductCard product={product} isSelected={false} onSelect={select} onEdit={edit} onViewDetails={detail} onDelete={vi.fn()} onDuplicate={vi.fn()} />)
    const actions = screen.getByRole('group', { name: 'Acciones de Cable USB' })
    fireEvent.click(within(actions).getByRole('button', { name: 'Editar: Cable USB' }))
    expect(edit).toHaveBeenCalledWith(product)
    expect(detail).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cable USB' }))
    expect(select).toHaveBeenCalledWith('p1')
    expect(detail).not.toHaveBeenCalled()
  })
  it('no expone el costo sin permiso', () => {
    const product = { id: 'p1', name: 'Cable USB', sale_price: 25000, purchase_price: 12345, stock_quantity: 7 } as Product
    render(<ProductCard product={product} isSelected={false} onSelect={vi.fn()} onEdit={vi.fn()} onViewDetails={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} />)
    expect(screen.queryByText('Costo:')).not.toBeInTheDocument()
  })
})
