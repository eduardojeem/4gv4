import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ProductVariantsEditor } from '../ProductVariantsEditor'
import type { ProductVariantsPayload } from '@/lib/products/variant-contract'
function Harness({ initial }: { initial: ProductVariantsPayload }) {
  const [value, setValue] = useState(initial)
  return <ProductVariantsEditor value={value} onChange={setValue} basePrices={{ purchasePrice: null, salePrice: 10 }} businessVertical="general" />
}
it('asks before materializing more than 50 combinations and blocks more than 500', () => {
  const { unmount } = render(<Harness initial={{ hasVariants: true, attributes: [{ key: 'color', label: 'Color', control: 'select', options: Array.from({ length: 60 }, (_, i) => `Color ${i}`) }], variants: [] }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Generar combinaciones', exact: true }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Generar 60 variantes')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  unmount()
  render(<Harness initial={{ hasVariants: true, attributes: [{ key: 'color', label: 'Color', control: 'select', options: Array.from({ length: 501 }, (_, i) => `Color ${i}`) }], variants: [] }} />)
  expect(screen.getByRole('button', { name: 'Generar combinaciones', exact: true })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('500')
})
it('shows contextual toolbar only after selecting variants', () => {
  render(<Harness initial={{ hasVariants: true, attributes: [{ key: 'color', label: 'Color', control: 'select', options: ['Negro'] }], variants: [{ clientKey: 'negro', name: 'Negro', attributes: { color: 'Negro' }, sku: 'NEG', purchasePrice: null, salePrice: 10, stockQuantity: 0, minStock: 0, isActive: true }] }} />)
  expect(screen.queryByRole('button', { name: 'Generar SKU' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Negro · tabla' }))
  expect(screen.getByRole('button', { name: 'Generar SKU' })).toBeInTheDocument()
})
