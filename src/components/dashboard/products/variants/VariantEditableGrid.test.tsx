import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VariantEditableGrid, VariantMobileCard, type VariantEditableGridProps } from './VariantEditableGrid'

const setup = (overrides: Partial<VariantEditableGridProps> = {}): VariantEditableGridProps => ({
  rows: [{ index: 3, state: 'new', variant: { clientKey: 'blue', name: 'Azul / M', attributes: { color: 'Azul', talla: 'M' }, sku: 'AZ-M', salePrice: 15000, purchasePrice: null, minStock: 1, stockQuantity: 4, isActive: true } }],
  selectedKeys: new Set(), onToggle: vi.fn(), onToggleAll: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(), canViewCost: true, canUpdateCost: true, stockEditable: false, ...overrides,
})

describe('VariantEditableGrid', () => {
  it('preserves unknown cost and explicit zero without coercing either on render', () => {
    const props = setup()
    const view = render(<VariantEditableGrid {...props} />)
    expect(screen.getByLabelText('Costo · Azul / M · tabla')).toHaveValue(null)
    expect(screen.getByPlaceholderText('Sin costo')).toBeInTheDocument()
    expect(props.onUpdate).not.toHaveBeenCalled()
    view.rerender(<VariantEditableGrid {...props} rows={[{ ...props.rows[0], variant: { ...props.rows[0].variant, purchasePrice: 0 } }]} />)
    expect(screen.getByLabelText('Costo · Azul / M · tabla')).toHaveValue(0)
    fireEvent.change(screen.getByLabelText('Costo · Azul / M · tabla'), { target: { value: '' } })
    expect(props.onUpdate).toHaveBeenCalledWith(3, { purchasePrice: null })
  })

  it('omits cost from unauthorized DOM and makes authorized read access read only', () => {
    const props = setup({ canViewCost: false, canUpdateCost: false })
    const view = render(<VariantEditableGrid {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.queryByText('Costo')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Sin costo')).not.toBeInTheDocument()
    view.rerender(<VariantEditableGrid {...props} canViewCost />)
    expect(screen.getByLabelText('Costo · Azul / M · tabla')).toHaveAttribute('readonly')
  })

  it('sends stable selection keys and original indexes for updates and removal', () => {
    const props = setup()
    render(<VariantEditableGrid {...props} />)
    fireEvent.click(screen.getByLabelText('Seleccionar Azul / M · tabla'))
    expect(props.onToggle).toHaveBeenCalledWith('blue')
    fireEvent.click(screen.getByLabelText('Seleccionar todas las variantes'))
    expect(props.onToggleAll).toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('SKU · Azul / M · tabla'), { target: { value: 'NEW' } })
    expect(props.onUpdate).toHaveBeenCalledWith(3, { sku: 'NEW' })
    fireEvent.click(screen.getByLabelText('Eliminar Azul / M · tabla'))
    expect(props.onRemove).toHaveBeenCalledWith(3)
    expect(screen.getByLabelText('Stock · Azul / M · tabla')).toBeDisabled()
  })

  it('keeps mobile cards compact and reveals secondary fields on edit', () => {
    const props = setup({ stockEditable: true, branchName: 'Centro' })
    render(<VariantMobileCard {...props} row={props.rows[0]} />)
    const card = screen.getByRole('article')
    expect(within(card).getByText('Gs. 15.000')).toBeInTheDocument()
    expect(within(card).queryByLabelText('Código de barras · Azul / M · móvil')).not.toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: 'Editar' }))
    expect(within(card).getByLabelText('Código de barras · Azul / M · móvil')).toBeInTheDocument()
    expect(within(card).getByLabelText('Stock · Azul / M · móvil')).toBeEnabled()
    expect(within(card).getByRole('button', { name: 'Editar' })).toHaveAttribute('aria-expanded', 'true')
  })
})
