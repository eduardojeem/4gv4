import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PublicVariantPicker } from '@/components/public/PublicVariantPicker'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const variante = (color: string, size: string, stock: number) => ({
  id: `${color}-${size}`,
  product_id: 'p1',
  variant_name: `${color} / ${size}`,
  attributes: { color, size },
  sku: null,
  sale_price: 55_000,
  stock_quantity: stock,
  is_active: true,
})

const config = [
  { key: 'color', label: 'Color', control: 'color' as const, options: ['Blanco', 'Negro'] },
  { key: 'size', label: 'Talle', control: 'select' as const, options: ['M', 'L'] },
]

/**
 * En la tienda de ropa solo el blanco tenía stock, y los modales deshabilitaban
 * el resto: el cliente hacía clic en «Negro» y no pasaba nada, ni siquiera podía
 * ver la foto. La página de detalle sí dejaba mirarlas.
 */
describe('las variantes agotadas se pueden mirar', () => {
  const variants = [variante('Blanco', 'M', 4), variante('Blanco', 'L', 4), variante('Negro', 'M', 0)]

  it('elegir un color sin stock avisa al cliente en vez de ignorarlo', () => {
    const onChange = vi.fn()
    render(<PublicVariantPicker variants={variants as never} config={config} selected={{}} onChange={onChange} />)

    const negro = screen.getByRole('button', { name: /Negro/ })
    expect(negro).toBeEnabled()
    expect(negro).toHaveAccessibleName(/sin stock/i)

    fireEvent.click(negro)
    expect(onChange).toHaveBeenCalledWith('color', 'Negro')
  })

  it('la opción con stock no se marca como agotada', () => {
    render(<PublicVariantPicker variants={variants as never} config={config} selected={{}} onChange={vi.fn()} />)
    const blanco = screen.getByRole('button', { name: 'Blanco' })
    expect(blanco).toBeEnabled()
    expect(blanco).toHaveAccessibleName('Blanco')
  })

  it('la opción elegida queda marcada para lectores de pantalla', () => {
    render(<PublicVariantPicker variants={variants as never} config={config} selected={{ color: 'Blanco' }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Blanco' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Negro/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('la vista rápida de la tarjeta tampoco las bloquea', () => {
    const card = leer('src/components/public/ProductCard.tsx')
    expect(card).not.toContain('disabled={!hasStock}')
    expect(card).toContain('aria-pressed={isSelected}')
    // Se siguen viendo distintas y con su aviso.
    expect(card).toContain("{hasStock ? `${variant.stock_quantity} disp.` : 'Sin stock'}")
  })
})
