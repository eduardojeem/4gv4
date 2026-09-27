import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RepairQualityBadge } from '../RepairQualityBadge'

describe('RepairQualityBadge', () => {
  it('makes a successful functional test explicit to the cashier', () => {
    render(<RepairQualityBadge qualityCheck={{
      id: 'quality-1', result: 'passed', checkedAt: '2026-09-13T12:00:00Z',
      checkedBy: { id: 'tech-1', name: 'Ana Técnica' },
      checklist: {
        powersOn: true, reportedIssueResolved: true, basicFunctions: true,
        physicalCondition: true, accessoriesVerified: true,
      },
    }} />)

    expect(screen.getByText('Probado · Funciona')).toBeInTheDocument()
    expect(screen.getByLabelText(/verificación técnica aprobada/i)).toBeInTheDocument()
  })

  it('warns clearly when a ready repair has no verification', () => {
    render(<RepairQualityBadge qualityCheck={null} />)
    expect(screen.getByText('Sin verificar')).toBeInTheDocument()
  })

  it.each([
    ['unrepairable', 'No fue posible reparar'],
    ['withdrawn', 'Retiro sin reparar'],
  ] as const)('shows %s as a red unrepaired result', (result, label) => {
    render(<RepairQualityBadge qualityCheck={{
      id: `quality-${result}`,
      result,
      checkedAt: '2026-09-13T12:00:00Z',
      checklist: {
        powersOn: false,
        reportedIssueResolved: false,
        basicFunctions: false,
        physicalCondition: true,
        accessoriesVerified: true,
      },
      note: 'El equipo se retira sin reparación.',
    }} />)

    expect(screen.getByText(label).closest('[data-slot="badge"]')).toHaveClass('border-rose-300')
  })
})
