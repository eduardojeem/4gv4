import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResponsiveProductFilters } from '@/components/dashboard/products-modern/ResponsiveProductFilters'
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }))
describe('filtros móviles', () => {
  it('presenta un diálogo con cierre accesible y controles existentes', () => {
    const close = vi.fn()
    render(<ResponsiveProductFilters open onClose={close}><label>Marca<input /></label></ResponsiveProductFilters>)
    expect(screen.getByRole('dialog', { name: 'Filtrar productos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Marca')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }))
    expect(close).toHaveBeenCalledOnce()
  })
})
