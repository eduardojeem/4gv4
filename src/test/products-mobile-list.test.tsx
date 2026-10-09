import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileProductList } from '@/components/dashboard/products-modern/MobileProductList'
import type { Product } from '@/types/products'

describe('listado móvil', () => {
  it('ofrece edición directa sin abrir el detalle', () => {
    const product = { id: 'p1', name: 'Cable USB', sale_price: 25000, stock_quantity: 7 } as Product
    const edit = vi.fn(), detail = vi.fn()
    render(<MobileProductList products={[product]} selectedProductIds={[]} onProductSelect={vi.fn()} onProductViewDetails={detail} onProductEdit={edit} onProductDelete={vi.fn()} onProductDuplicate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Cable USB' }))
    expect(edit).toHaveBeenCalledWith(product)
    expect(detail).not.toHaveBeenCalled()
  })
  it('suma el stock de variantes de ambos contratos', () => {
    const product = { id: 'p2', name: 'Remera', sale_price: 100, stock_quantity: 99, variants: [{ stock_quantity: 2, sale_price: 100 }, { stockQuantity: 3, salePrice: 200 }] } as Product
    render(<MobileProductList products={[product]} selectedProductIds={[]} onProductSelect={vi.fn()} onProductViewDetails={vi.fn()} onProductEdit={vi.fn()} onProductDelete={vi.fn()} onProductDuplicate={vi.fn()} />)
    expect(screen.getByText('Stock: 5')).toBeInTheDocument()
    expect(screen.queryByText('Stock: 99')).not.toBeInTheDocument()
  })
  it('conserva selección y detalle sin mostrar costos', () => {
    const product = { id: 'p1', name: 'Cable USB', sku: 'USB', sale_price: 25000, purchase_price: 12345, stock_quantity: 7, is_active: true } as Product
    const select = vi.fn(), detail = vi.fn()
    render(<MobileProductList products={[product]} selectedProductIds={['p1']} onProductSelect={select} onProductViewDetails={detail} onProductEdit={vi.fn()} onProductDelete={vi.fn()} onProductDuplicate={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Cable USB' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(select).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('button', { name: 'Cable USB' }))
    expect(detail).toHaveBeenCalledWith(product)
    expect(screen.getByText('Stock: 7')).toBeInTheDocument()
    expect(screen.queryByText(/12[.,]345/)).not.toBeInTheDocument()
  })
})
