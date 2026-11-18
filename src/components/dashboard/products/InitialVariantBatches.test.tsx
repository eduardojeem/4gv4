import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { InitialVariantBatches } from './InitialVariantBatches'
import type { ProductVariantInput } from '@/lib/products/variant-contract'
const variants = [{ clientKey: 'a', name: '30 ml', sku: 'COS-30', stockQuantity: 5, isActive: true }, { clientKey: 'b', name: '50 ml', sku: 'COS-50', stockQuantity: 3, isActive: true }, { clientKey: 'c', name: 'Agotada', sku: 'ZERO', stockQuantity: 0, isActive: true }] as ProductVariantInput[]
it('permite lotes individuales sin cambiar cantidades ni SKU', () => {
  const change = vi.fn()
  render(<InitialVariantBatches variants={variants} value={[]} onChange={change} />)
  fireEvent.change(screen.getAllByLabelText('Vencimiento')[2], { target: { value: '2027-01-01' } })
  expect(change).toHaveBeenCalledWith([{ variant_key: 'b', expires_on: '2027-01-01' }])
  expect(screen.queryByText('SKU: ZERO')).toBeNull()
})
it('aplica fecha común solo a variantes activas con stock', () => {
  const change = vi.fn()
  render(<InitialVariantBatches variants={variants} value={[]} onChange={change} />)
  fireEvent.click(screen.getByText('Aplicar la misma fecha y lote a todas las variantes con stock'))
  fireEvent.change(screen.getAllByLabelText('Vencimiento')[0], { target: { value: '2027-02-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar a 2 variantes' }))
  expect(change).toHaveBeenCalledWith([{ variant_key: 'a', expires_on: '2027-02-01', lot_code: '' }, { variant_key: 'b', expires_on: '2027-02-01', lot_code: '' }])
})
