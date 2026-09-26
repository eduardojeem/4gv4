import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CreditStatusPanel, type CreditTerms } from '../CreditStatusPanel'

function Harness() {
  const [terms, setTerms] = useState<CreditTerms>({ count: 3, frequency: 'monthly', interestRate: 0, startDate: '2026-01-31' })
  return <CreditStatusPanel cartTotal={100000} creditSummary={{ availableCredit: 1000000, usedCredit: 0 }} terms={terms} onTermsChange={setTerms} />
}
describe('selección de primer vencimiento', () => {
  it('actualiza el calendario sin cambiar el total', () => {
    render(<Harness />)
    const toggle = screen.getByRole('button', { name: /¿Cuándo vence la primera cuota/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('radio', { name: /Desde el inicio/ })).toBeChecked()
    expect(screen.getByText('31/01/2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Desde el próximo ciclo/ }))
    expect(screen.queryByText('31/01/2026')).not.toBeInTheDocument()
    expect(screen.getByText('30/04/2026')).toBeInTheDocument()
    expect(screen.getByText(/queda pendiente hasta registrar el cobro/)).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('Desde el próximo ciclo')
    fireEvent.click(toggle)
    expect(screen.getByRole('radio', { name: /Desde el próximo ciclo/ })).toBeChecked()
  })
})
