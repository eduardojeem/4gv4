import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CategoryListView } from '@/components/categories/CategoryListView'

describe('orden de categorías', () => {
  it('mantiene el foco en el botón después de cambiar el orden', () => {
    render(<CategoryListView categories={[]} />)

    const sortButton = screen.getByRole('button', { name: 'Nombre' })
    sortButton.focus()
    fireEvent.click(sortButton)

    expect(screen.getByRole('button', { name: 'Nombre' })).toHaveFocus()
  })
})
