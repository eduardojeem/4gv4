import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { VariantBulkToolbar } from './VariantBulkToolbar'
const variants = [{ clientKey: 'negro', name: 'Negro', attributes: { color: 'Negro' }, sku: 'OLD', purchasePrice: 5, salePrice: 10, minStock: 0, stockQuantity: 1, isActive: true }]
const props = { variants, selected: new Set(['negro']), onClear: vi.fn(), canUpdateCost: true, baseSku: 'BASE' }
it('requires preview confirmation before applying a bulk price to the draft', () => {
  const onApply = vi.fn()
  render(<VariantBulkToolbar {...props} onApply={onApply} />)
  fireEvent.click(screen.getByRole('button', { name: 'Precio', exact: true }))
  fireEvent.change(screen.getByLabelText('Nuevo valor masivo'), { target: { value: '25' } })
  expect(onApply).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar al borrador' }))
  expect(onApply.mock.calls[0][0][0].salePrice).toBe(25)
})
it('clears cost to null and disables branch stock without context', () => {
  const onApply = vi.fn()
  render(<VariantBulkToolbar {...props} onApply={onApply} />)
  expect(screen.getByRole('button', { name: 'Stock', exact: true })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar costo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar al borrador' }))
  expect(onApply.mock.calls[0][0][0].purchasePrice).toBeNull()
})
it('hides cost actions without permission and shows nothing without selection', () => {
  const { rerender } = render(<VariantBulkToolbar {...props} onApply={vi.fn()} canUpdateCost={false} />)
  expect(screen.queryByRole('button', { name: 'Costo', exact: true })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Limpiar costo' })).not.toBeInTheDocument()
  rerender(<VariantBulkToolbar {...props} selected={new Set()} onApply={vi.fn()} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
