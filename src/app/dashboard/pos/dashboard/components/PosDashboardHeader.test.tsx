import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PosDashboardHeader } from './PosDashboardHeader'
import { availablePosDashboardTabs } from '../lib/dashboard-tabs'

vi.mock('@/components/dashboard/common/SectionGuideButton', () => ({ SectionGuideButton: () => null }))

const pintar = (modules: string[], overrides: Partial<Parameters<typeof PosDashboardHeader>[0]> = {}) =>
  render(
    <PosDashboardHeader
      dateRange={{ from: new Date('2026-09-10T12:00:00'), to: new Date('2026-09-10T12:00:00') }}
      setDateRange={vi.fn()}
      onExport={vi.fn()}
      activeViewTab="all"
      setActiveViewTab={vi.fn()}
      availableTabs={availablePosDashboardTabs(modules)}
      {...overrides}
    />
  )

describe('el encabezado del dashboard del POS', () => {
  it('sin taller no ofrece la pestaña de reparaciones ni habla de taller', () => {
    pintar(['pos', 'inventory'])
    expect(screen.queryByRole('tab', { name: /Reparaciones/ })).not.toBeInTheDocument()
    expect(screen.getByText('Analíticas POS')).toBeInTheDocument()
    expect(screen.getByText(/Resumen de ventas, ganancias y métodos de pago/)).toBeInTheDocument()
  })

  it('con taller y créditos muestra las cinco pestañas', () => {
    pintar(['pos', 'repairs', 'credits'])
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Vista General',
      'Ventas POS',
      'Créditos',
      'Reparaciones (Taller)',
      'Ganancias & Márgenes',
    ])
    expect(screen.getByText('Analíticas POS & Taller')).toBeInTheDocument()
  })

  it('marca la pestaña activa para lectores de pantalla', () => {
    pintar(['credits'], { activeViewTab: 'credits' })
    expect(screen.getByRole('tab', { name: /Créditos/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Vista General/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('elegir Créditos avisa a la página', async () => {
    const setActiveViewTab = vi.fn()
    pintar(['credits'], { setActiveViewTab })
    await userEvent.setup().click(screen.getByRole('tab', { name: /Créditos/ }))
    expect(setActiveViewTab).toHaveBeenCalledWith('credits')
  })
})
