import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SidebarToggleButton } from './sidebar'

describe('SidebarToggleButton', () => {
  it('makes the expand action prominent and accessible when collapsed', () => {
    const onToggle = vi.fn()
    render(<SidebarToggleButton collapsed onToggle={onToggle} />)

    const button = screen.getByRole('button', { name: 'Expandir menú' })
    expect(button).toHaveAttribute('title', 'Expandir menú')
    expect(button).toHaveClass('bg-primary/10', 'text-primary')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('describes the opposite action when expanded', () => {
    render(<SidebarToggleButton collapsed={false} onToggle={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('title', 'Contraer menú')
  })
})
