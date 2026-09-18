import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrintLabelsDialog } from '@/components/dashboard/products/labels/PrintLabelsDialog'

/**
 * La pantalla de etiquetas: lo que se puede comprobar sin una impresora.
 */
describe('diálogo de etiquetas', () => {
  const conCodigo = {
    id: 'p1',
    name: 'Cargador USB-C 25W',
    sku: 'CAR-25W',
    barcode: '5901234123457',
    price: 85000,
    stock: 12,
  }

  it('ofrece los dos tipos de impresora', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)

    expect(screen.getByRole('heading', { name: /Imprimir etiquetas/ })).toBeInTheDocument()
    expect(screen.getByText('Impresora térmica')).toBeInTheDocument()
    expect(screen.getByText('Hoja de etiquetas')).toBeInTheDocument()
    expect(screen.getByText('Rollo térmico 50 × 25 mm')).toBeInTheDocument()
    expect(screen.getByText(/Hoja A4 — 24 etiquetas/)).toBeInTheDocument()
  })

  /** El rollo de 50 × 25 es el formato más usado: viene elegido de entrada. */
  it('arranca en el formato más común', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByRole('button', { name: /Rollo térmico 50 × 25 mm/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('avisa del producto que no puede tener etiqueta, en vez de imprimirlo vacío', async () => {
    render(
      <PrintLabelsDialog
        open
        onOpenChange={vi.fn()}
        products={[conCodigo, { id: 'p2', name: 'Producto suelto', sku: '', barcode: null, price: 1000 }]}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/«Producto suelto» no tiene código de barras ni SKU/)).toBeInTheDocument(),
    )
    // El que sí tiene código sigue en la lista, con su cantidad.
    expect(screen.getByLabelText('Etiquetas de Cargador USB-C 25W')).toHaveValue(1)
  })

  it('cuenta las etiquetas que se van a imprimir', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByText('1 etiqueta')).toBeInTheDocument()
  })

  it('sin ningún producto imprimible no deja imprimir', () => {
    render(
      <PrintLabelsDialog
        open
        onOpenChange={vi.fn()}
        products={[{ id: 'p2', name: 'Producto suelto', sku: null, barcode: null }]}
      />,
    )
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeDisabled()
  })
})
