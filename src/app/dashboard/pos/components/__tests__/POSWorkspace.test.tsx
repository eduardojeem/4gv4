import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { POSWorkspace } from '../POSWorkspace'

describe('POSWorkspace', () => {
  it('exposes catalog and cart landmarks and announces why checkout is blocked', () => {
    render(
      <POSWorkspace
        catalog={<div>Productos</div>}
        cart={<div>Resumen</div>}
        statusMessage="Abrí la caja para continuar"
      />,
    )

    expect(screen.getByRole('region', { name: 'Catálogo' })).toBeVisible()
    expect(screen.getByRole('complementary', { name: 'Carrito' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Abrí la caja para continuar')
  })
})
