import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { expect, it, vi } from 'vitest'
import { CategoryTree } from '@/components/categories/CategoryTree'

it('muestra las subcategorías de tercer nivel', () => {
  const categories = [
    { id: 'ropa', name: 'Ropa', parent_id: null, is_active: true },
    { id: 'ninos', name: 'Niños', parent_id: 'ropa', is_active: true },
    { id: 'remeras', name: 'Remeras', parent_id: 'ninos', is_active: true },
  ] as ComponentProps<typeof CategoryTree>['categories']
  render(<CategoryTree categories={categories} onEdit={vi.fn()} onDelete={vi.fn()} onToggleActive={vi.fn()} onAddChild={vi.fn()} />)
  expect(screen.getByText('Remeras')).toBeInTheDocument()
})
