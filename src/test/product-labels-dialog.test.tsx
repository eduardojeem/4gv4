import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrintLabelsDialog } from '@/components/dashboard/products/labels/PrintLabelsDialog'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

let negocio: string | null = '4G Celulares'
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', organization: negocio ? { id: 'o1', name: negocio } : null } }),
}))

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

  it('ofrece los dos tipos de impresora, cada formato como una opción', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)

    expect(screen.getByRole('heading', { name: /Imprimir etiquetas/ })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Impresora térmica' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Hoja de etiquetas' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Rollo térmico 50 × 25 mm' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Hoja A4 — 24 etiquetas/ })).toBeInTheDocument()
  })

  /** El rollo de 50 × 25 es el formato más usado: viene elegido de entrada. */
  it('arranca en el formato más común', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByRole('radio', { name: 'Rollo térmico 50 × 25 mm' })).toBeChecked()
  })

  it('el panel de la muestra dice el tamaño real de la etiqueta', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    const encabezado = screen.getByText('Muestra').closest('div')?.parentElement
    expect(encabezado).toHaveTextContent('50 × 25 mm')
  })

  /** Se podía sumar de a uno sin tipear, que es como se piden 20 de una caja. */
  it('la cantidad se sube y se baja de a uno, y el producto se puede sacar', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo, { ...conCodigo, id: 'p3', name: 'Funda' }]} />)

    const cantidad = screen.getByLabelText('Etiquetas de Cargador USB-C 25W')
    expect(cantidad).toHaveValue(1)
    fireEvent.click(screen.getByLabelText('Una etiqueta más de Cargador USB-C 25W'))
    expect(screen.getByLabelText('Etiquetas de Cargador USB-C 25W')).toHaveValue(2)

    fireEvent.click(screen.getByLabelText('Sacar Funda de la tirada'))
    expect(screen.getByLabelText('Etiquetas de Funda')).toHaveValue(0)
    expect(screen.getByText(/^2 etiquetas/)).toBeInTheDocument()
  })

  it('un botón pone la misma cantidad en todos', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo, { ...conCodigo, id: 'p3', name: 'Funda' }]} />)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(screen.getByLabelText('Etiquetas de Cargador USB-C 25W')).toHaveValue(5)
    expect(screen.getByLabelText('Etiquetas de Funda')).toHaveValue(5)
    expect(screen.getByText(/^10 etiquetas/)).toBeInTheDocument()
  })

  /** Antes había que pasarle el nombre por prop, así que nunca se imprimía. */
  it('el nombre del negocio sale de la sesión', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByLabelText(/Nombre del negocio \(4G Celulares\)/)).toBeInTheDocument()
  })

  it('sin negocio en la sesión, esa opción no se puede marcar', () => {
    negocio = null
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByLabelText('Nombre del negocio')).toBeDisabled()
    negocio = '4G Celulares'
  })

  it('ofrece imprimir una sola para probar la alineación', () => {
    render(<PrintLabelsDialog open onOpenChange={vi.fn()} products={[conCodigo]} />)
    expect(screen.getByRole('button', { name: /Probar con una/ })).toBeEnabled()
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
    expect(screen.getByText(/^1 etiqueta/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imprimir 1/ })).toBeEnabled()
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

/**
 * Se puede llegar a imprimir desde los tres lugares donde alguien mira un
 * producto: el listado con varios elegidos, la vista rápida y la ficha.
 */
describe('desde dónde se imprime', () => {
  it('el listado lo ofrece con los productos elegidos y desde la vista rápida', () => {
    const listado = leer('src/app/dashboard/products/page.tsx')
    expect(listado).toContain('onBulkPrintLabels={() => setLabelsTarget(productsForLabels)}')
    expect(listado).toContain('setLabelsTarget([toLabelProduct(product)])')
  })

  it('la vista rápida trae su propia acción', () => {
    const vistaRapida = leer('src/components/dashboard/products-modern/ProductQuickViewModal.tsx')
    expect(vistaRapida).toContain('onPrintLabel?: (product: Product) => void')
    expect(vistaRapida).toContain('onPrintLabel(product)')
  })

  /** Estaba solo al lado del código, abajo de la ficha: había que buscarlo. */
  it('la ficha del producto lo tiene en las acciones de arriba', () => {
    const ficha = leer('src/app/dashboard/products/[id]/page.tsx')
    // Hasta el cierre del bloque de acciones, no una ventana fija de caracteres:
    // al sumarse otro boton, el de etiquetas quedaba fuera del recorte.
    const desde = ficha.indexOf('{/* Action Buttons */}')
    const hasta = ficha.indexOf('</div>', ficha.indexOf('Eliminar', desde))
    expect(ficha.slice(desde, hasta)).toContain('setLabelsDialogOpen(true)')
  })

  /** Sin código de barras se imprime el SKU: el producto no queda sin etiqueta. */
  it('un producto con SKU y sin código de barras también se puede etiquetar', () => {
    const ficha = leer('src/app/dashboard/products/[id]/page.tsx')
    expect(ficha).toContain("resolveLabelCode({ barcode: product?.barcode ?? null, sku: product?.sku ?? null })")
    expect(ficha).toContain('Imprimir etiqueta con el SKU')
  })
})
