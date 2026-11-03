import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useGlobalCategorySuggest', () => ({
  useGlobalCategorySuggest: () => ({ suggestions: [], isLoading: false, dismiss: vi.fn() }),
}))

import { CategoryModal } from '@/components/categories/CategoryModal'

/**
 * Crear una categoría desde el alta de productos abría el modal sin catálogo
 * global: el `= []` por defecto era un arreglo nuevo en cada render y React
 * cortaba con «Maximum update depth exceeded».
 */
describe('modal de categoría', () => {
  it('se abre sin catálogo global (como desde el alta de productos) sin entrar en bucle', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const props = { isOpen: true, onClose: vi.fn(), onSubmit: vi.fn(async () => {}), categories: [] }
    const { rerender } = render(<CategoryModal {...props} />)
    // Un render del padre con props nuevas (otra función onClose) no reinicia el formulario.
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Fundas' } })
    rerender(<CategoryModal {...props} onClose={vi.fn()} />)
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Fundas')
    expect(errors.mock.calls.some(([message]) => String(message).includes('Maximum update depth'))).toBe(false)
    errors.mockRestore()
  })

  it('un catálogo nuevo con los mismos datos no borra lo que se está escribiendo', () => {
    const props = { isOpen: true, onClose: vi.fn(), onSubmit: vi.fn(async () => {}), categories: [] }
    const { rerender } = render(<CategoryModal {...props} globalCatalog={[]} />)
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Cargadores' } })
    rerender(<CategoryModal {...props} globalCatalog={[]} />)
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Cargadores')
  })
})
