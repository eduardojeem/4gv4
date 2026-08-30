import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProductVariantsEditor } from './ProductVariantsEditor'

describe('ProductVariantsEditor', () => {
  it('configures a shirt with size and color variants in one action', () => {
    const onChange = vi.fn()

    render(
      <ProductVariantsEditor
        businessVertical="clothing"
        value={{ hasVariants: false, attributes: [], variants: [] }}
        onChange={onChange}
        basePrices={{ purchasePrice: 40_000, salePrice: 75_000, wholesalePrice: 65_000 }}
        baseSku="REM"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Configurar una remera' }))
    const configured = onChange.mock.calls.at(-1)?.[0]

    expect(configured.hasVariants).toBe(true)
    expect(configured.attributes).toEqual([
      { key: 'size', label: 'Talle', control: 'select', options: ['S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Color', control: 'color', options: ['Negro', 'Blanco'] },
    ])
    expect(configured.variants).toHaveLength(8)
    expect(configured.variants[0]).toMatchObject({
      clientKey: 'size=S|color=Negro',
      sku: 'REM-01',
      purchasePrice: 40_000,
      salePrice: 75_000,
      wholesalePrice: 65_000,
      stockQuantity: 0,
    })
  })

  it('asks before replacing existing variants with the shirt preset', () => {
    const onChange = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <ProductVariantsEditor
        businessVertical="clothing"
        value={{
          hasVariants: true,
          attributes: [{ key: 'size', label: 'Talle', control: 'select', options: ['Único'] }],
          variants: [{
            clientKey: 'size=Único',
            name: 'Único',
            attributes: { size: 'Único' },
            sku: 'ACTUAL-01',
            purchasePrice: 20_000,
            salePrice: 35_000,
            minStock: 0,
            stockQuantity: 3,
            isActive: true,
          }],
        }}
        onChange={onChange}
        basePrices={{ purchasePrice: 20_000, salePrice: 35_000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Configurar una remera' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('shows cosmetic suggestions and generates tone-volume combinations', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ProductVariantsEditor
        businessVertical="cosmetics"
        value={{ hasVariants: false, attributes: [], variants: [] }}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Producto con variantes' }))
    const enabled = onChange.mock.calls.at(-1)?.[0]
    rerender(
      <ProductVariantsEditor
        businessVertical="cosmetics"
        value={enabled}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    expect(screen.getByRole('button', { name: /Tono/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volumen/ })).toBeInTheDocument()
  })

  it('keeps an edited price when combinations are regenerated', () => {
    const onChange = vi.fn()
    render(
      <ProductVariantsEditor
        businessVertical="clothing"
        value={{
          hasVariants: true,
          attributes: [
            { key: 'color', label: 'Color', control: 'color', options: ['Negro'] },
            { key: 'size', label: 'Talle', control: 'select', options: ['M', 'L'] },
          ],
          variants: [{
            clientKey: 'color=Negro|size=M',
            name: 'Negro / M',
            attributes: { color: 'Negro', size: 'M' },
            sku: 'REM-M',
            purchasePrice: 50_000,
            salePrice: 95_000,
            minStock: 0,
            stockQuantity: 1,
            isActive: true,
          }],
        }}
        onChange={onChange}
        basePrices={{ purchasePrice: 50_000, salePrice: 90_000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /generar combinaciones/i }))
    const next = onChange.mock.calls.at(-1)?.[0]

    expect(next.variants.find((variant: { clientKey: string }) => variant.clientKey === 'color=Negro|size=M').salePrice).toBe(95_000)
    expect(next.variants).toHaveLength(2)
  })
})
