import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProductTableAdvanced from '@/components/dashboard/products/core/ProductTableAdvanced'

describe('orden de la tabla avanzada de productos', () => {
  it('mantiene el foco al ordenar y permite invertir el orden', () => {
    render(<ProductTableAdvanced products={[
      { id: 'a', name: 'Auricular', price: 20, stock: 5, category: 'Audio' },
      { id: 'b', name: 'Cable', price: 10, stock: 15, category: 'Accesorios' },
    ]} />)

    const button = screen.getByRole('button', { name: 'Precio', exact: true })
    button.focus()
    fireEvent.click(button)

    expect(screen.getByRole('button', { name: 'Precio', exact: true })).toHaveFocus()
    expect(within(screen.getAllByRole('row')[1]).getByText('Cable')).toBeInTheDocument()

    fireEvent.click(button)
    expect(within(screen.getAllByRole('row')[1]).getByText('Auricular')).toBeInTheDocument()
  })
})
