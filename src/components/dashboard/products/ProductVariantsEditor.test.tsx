import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProductVariantsEditor } from './ProductVariantsEditor'

const persistedVariant = { id: '00000000-0000-4000-8000-000000000001', clientKey: 'legacy', name: 'Negro', attributes: { color: 'Negro' }, sku: 'KEEP', purchasePrice: null, salePrice: 50, stockQuantity: 7, minStock: 0, isActive: true }

it.each(['Producto simple', 'Eliminar atributo Color', 'Eliminar Negro de Color', 'Eliminar Negro · tabla'])('blocks %s for persisted variants and allows cancel/review only', action => {
  const onChange = vi.fn()
  render(<ProductVariantsEditor value={{ hasVariants: true, attributes: [{ key: 'color', label: 'Color', control: 'color', options: ['Negro'] }], variants: [persistedVariant] }} onChange={onChange} basePrices={{ purchasePrice: null, salePrice: 50 }} businessVertical="general" />)
  fireEvent.click(screen.getAllByRole('button', { name: action, exact: true })[0])
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Stock afectado: 7 unidades')
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar variantes', exact: true }))
  expect(onChange).not.toHaveBeenCalled()
})

it('blocks regenerating or replacing persisted combinations and allows harmless draft removal', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const onChange = vi.fn()
  const { rerender } = render(<ProductVariantsEditor value={{ hasVariants: true, attributes: [{ key: 'size', label: 'Talle', control: 'select', options: ['L'] }], variants: [persistedVariant] }} onChange={onChange} basePrices={{ purchasePrice: null, salePrice: 50 }} businessVertical="general" />)
  fireEvent.click(screen.getByRole('button', { name: /Generar.*combinaciones/i }))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Configurar una remera' }))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar', exact: true }))
  rerender(<ProductVariantsEditor value={{ hasVariants: true, attributes: [], variants: [{ ...persistedVariant, id: undefined, stockQuantity: 0 }] }} onChange={onChange} basePrices={{ purchasePrice: null, salePrice: 50 }} businessVertical="general" />)
  fireEvent.click(screen.getByRole('button', { name: 'Producto simple', exact: true }))
  expect(onChange).toHaveBeenCalledWith({ hasVariants: false, attributes: [], variants: [] })
  confirm.mockRestore()
})

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
      clientKey: 'color=negro|size=s',
      sku: 'REM-01',
      purchasePrice: 40_000,
      salePrice: 75_000,
      wholesalePrice: 65_000,
      stockQuantity: 0,
    })
  })

  it('offers ready-to-use presets for sportswear and other common products', () => {
    const onChange = vi.fn()

    render(
      <ProductVariantsEditor
        businessVertical="clothing"
        value={{ hasVariants: false, attributes: [], variants: [] }}
        onChange={onChange}
        basePrices={{ purchasePrice: 40_000, salePrice: 75_000 }}
        baseSku="SPORT"
      />,
    )

    expect(screen.getByRole('button', { name: /Remera deportiva/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Calzado/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cosmética/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remera deportiva/i }))
    const configured = onChange.mock.calls.at(-1)?.[0]
    expect(configured.hasVariants).toBe(true)
    expect(configured.attributes.map((attribute: { key: string }) => attribute.key)).toEqual(['size', 'color'])
    expect(configured.variants).toHaveLength(15)
    expect(configured.variants[0].sku).toBe('SPORT-01')
  })

  it('keeps the explanatory guide collapsed initially', () => {
    render(
      <ProductVariantsEditor
        businessVertical="general"
        value={{ hasVariants: false, attributes: [], variants: [] }}
        onChange={vi.fn()}
        basePrices={{ purchasePrice: 10_000, salePrice: 20_000 }}
      />,
    )

    expect(screen.getByRole('button', { name: /Cómo funcionan las variantes/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Multiplicación automática')).not.toBeInTheDocument()
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


it('hides variant costs without read permission and leaves other variant fields editable',()=>{
 const onChange=vi.fn()
 render(<ProductVariantsEditor businessVertical="clothing" value={{hasVariants:true,attributes:[{key:'size',label:'Talle',control:'select',options:['M']}],variants:[{clientKey:'size=M',name:'M',attributes:{size:'M'},sku:'SKU-M',purchasePrice:40000,salePrice:75000,minStock:0,stockQuantity:2,isActive:true}]}} basePrices={{purchasePrice:40000,salePrice:75000}} onChange={onChange} canViewCost={false} canUpdateCost={false}/> )
 expect(screen.queryByText('Costo')).not.toBeInTheDocument()
 expect(screen.queryByDisplayValue('40000')).not.toBeInTheDocument()
 fireEvent.change(screen.getAllByDisplayValue('SKU-M')[0],{target:{value:'SKU-NEW'}})
 expect(onChange.mock.calls.at(-1)?.[0].variants[0].sku).toBe('SKU-NEW')
})

it('shows cost read-only when read is allowed but update is denied',()=>{
 render(<ProductVariantsEditor businessVertical="clothing" value={{hasVariants:true,attributes:[{key:'size',label:'Talle',control:'select',options:['M']}],variants:[{clientKey:'size=M',name:'M',attributes:{size:'M'},sku:'SKU-M',purchasePrice:40000,salePrice:75000,minStock:0,stockQuantity:2,isActive:true}]}} basePrices={{purchasePrice:40000,salePrice:75000}} onChange={vi.fn()} canViewCost canUpdateCost={false}/> )
 for(const cost of screen.getAllByDisplayValue('40000')) expect(cost).toHaveAttribute('readonly')
})

it('tracks modified and reverted values after persisted variants hydrate asynchronously', () => {
  const attrs = [{ key: 'color', label: 'Color', control: 'color' as const, options: ['Negro'] }]
  function Host() {
    const [value, setValue] = useState({ hasVariants: true, attributes: attrs, variants: [] as typeof persistedVariant[] })
    return <><button onClick={() => setValue({ hasVariants: true, attributes: attrs, variants: [persistedVariant] })}>Cargar variantes</button><ProductVariantsEditor value={value} onChange={next => setValue(next as typeof value)} basePrices={{ purchasePrice: null, salePrice: 50 }} businessVertical="general" /></>
  }
  render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: 'Cargar variantes' }))
  expect(screen.getAllByText('Sin cambios')).toHaveLength(2)
  const price = screen.getByLabelText('Precio · Negro · tabla')
  fireEvent.change(price, { target: { value: '40' } })
  expect(screen.getAllByText('Modificada')).toHaveLength(2)
  fireEvent.change(price, { target: { value: '50' } })
  expect(screen.getAllByText('Sin cambios')).toHaveLength(2)
})
