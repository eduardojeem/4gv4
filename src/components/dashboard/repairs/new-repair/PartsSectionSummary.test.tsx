import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartsSectionSummary } from './PartsSectionSummary'

describe('PartsSectionSummary', () => {
  it('separates the parts subtotal from the informational reference price', () => {
    render(<PartsSectionSummary
      itemCount={2}
      itemsSubtotal={120_000}
      referencePrice={200_000}
    />)

    expect(screen.getByText('2 ítems')).toBeVisible()
    expect(screen.getByText('Subtotal de servicios y repuestos')).toBeVisible()
    expect(screen.getByText('Precio de referencia')).toBeVisible()
    expect(screen.getByText('Total calculado antes de descuentos')).toBeVisible()
    expect(screen.getByText(/Referencia informativa/)).toBeVisible()
    expect(screen.getAllByText(/Gs\.\s*120\.000/)).toHaveLength(1)
    expect(screen.getAllByText(/Gs\.\s*200\.000/)).toHaveLength(1)
  })
})
