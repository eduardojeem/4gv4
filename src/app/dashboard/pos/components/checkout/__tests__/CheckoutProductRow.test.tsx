import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckoutProductRow } from '../CheckoutProductRow'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

describe('productos del resumen de cobro', () => {
  it('Escape cierra solo el detalle y devuelve el foco al producto sin cerrar el cobro', async () => {
    const parentChange = vi.fn()
    render(<Dialog open onOpenChange={parentChange}><DialogContent><DialogTitle>Cobrar venta</DialogTitle><DialogDescription>Resumen de venta</DialogDescription><CheckoutProductRow item={{ id: 'p', name: 'Remera', price: 10, quantity: 1 }} unitPrice={10} formatCurrency={String} /></DialogContent></Dialog>)
    const trigger = screen.getByRole('button', { name: 'Remera' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Remera' })).toBeVisible()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Remera' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Remera' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Cobrar venta' })).toBeVisible()
    expect(parentChange).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger).toHaveFocus())
  })
  it('permite aumentar cantidad hasta el stock y desplegar los datos del producto', () => {
    const change = vi.fn()
    const props = { item: { id: 'p1', name: 'Remera', sku: 'REM-01', category: 'category-id', categoryName: 'Ropa', brand: 'Marca de prueba', image: '/remera.jpg', price: 50000, quantity: 1, stock: 2 }, unitPrice: 50000, formatCurrency: String, onUpdateQuantity: change }
    const view = render(<CheckoutProductRow {...props} />)
    expect(screen.getByRole('button', { name: /Reducir/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Aumentar/ }))
    expect(change).toHaveBeenCalledWith('p1', 2)
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))
    expect(screen.getByRole('dialog', { name: 'Remera' })).toBeVisible()
    expect(screen.getByText('REM-01')).toBeVisible()
    expect(screen.getByText('Ropa')).toBeVisible()
    expect(screen.queryByText('category-id')).not.toBeInTheDocument()
    expect(screen.getByText('Marca de prueba')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Remera' })).toHaveAttribute('src', '/remera.jpg')
    fireEvent.error(screen.getByRole('img', { name: 'Remera' }))
    expect(screen.getByText('Sin imagen')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al cobro' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(change).toHaveBeenCalledTimes(1)
    view.rerender(<CheckoutProductRow {...props} item={{ ...props.item, quantity: 2 }} />)
    expect(screen.getByRole('button', { name: /Aumentar/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Remera' }))
    expect(screen.getByRole('dialog', { name: 'Remera' })).toBeVisible()
  })
  it('no modifica servicios ni permite editar durante el procesamiento', () => {
    const props = { item: { id: 'p1', name: 'Producto', price: 10, quantity: 1, stock: 5 }, unitPrice: 10, formatCurrency: String, onUpdateQuantity: vi.fn() }
    const view = render(<CheckoutProductRow {...props} disabled />)
    expect(screen.getByRole('button', { name: /Aumentar/ })).toBeDisabled()
    view.rerender(<CheckoutProductRow {...props} item={{ ...props.item, isService: true }} />)
    expect(screen.queryByRole('button', { name: /Aumentar/ })).not.toBeInTheDocument()
  })
})
