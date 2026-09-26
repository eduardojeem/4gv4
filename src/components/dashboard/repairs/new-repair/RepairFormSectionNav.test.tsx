import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RepairFormSectionNav } from './RepairFormSectionNav'

describe('RepairFormSectionNav', () => {
  it('announces the active section and contextual error counts', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<RepairFormSectionNav
      activeSection="customer"
      onSelect={onSelect}
      sectionState={{
        customer: { errorCount: 1 }, device: { errorCount: 0 }, diagnosis: { errorCount: 2 },
        catalog: { errorCount: 0 }, estimate: { errorCount: 0 }, review: { errorCount: 0 },
      }}
    />)

    expect(screen.getByRole('button', { name: /cliente.*1 error/i })).toHaveAttribute('aria-current', 'step')
    await user.click(screen.getByRole('button', { name: /diagnóstico inicial.*2 errores/i }))
    expect(onSelect).toHaveBeenCalledWith('diagnosis')
  })

  it('uses a compact touch-friendly horizontal navigator on mobile', () => {
    render(<RepairFormSectionNav
      activeSection="customer"
      onSelect={vi.fn()}
      sectionState={{
        customer: { errorCount: 0 }, device: { errorCount: 0 }, diagnosis: { errorCount: 0 },
        catalog: { errorCount: 0 }, estimate: { errorCount: 0 }, review: { errorCount: 0 },
      }}
    />)

    const nav = screen.getByRole('navigation', { name: 'Secciones del formulario' })
    expect(nav).toHaveClass('max-sm:-mx-3')
    expect(screen.getByRole('button', { name: /Cliente/ })).toHaveClass('min-h-11')
    expect(screen.getByText('Identificación y contacto')).toHaveClass('max-sm:hidden')
  })
})
