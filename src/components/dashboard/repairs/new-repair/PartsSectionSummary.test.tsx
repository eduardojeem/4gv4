import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartsSectionSummary } from './PartsSectionSummary'

describe('PartsSectionSummary', () => {
  it('separates the parts subtotal from the informational reference price', () => {
    render(<PartsSectionSummary
      itemCount={2}
      partsSubtotal={120_000}
      referencePrice={200_000}
      laborCost={80_000}
    />)

    expect(screen.getByText('2 repuestos')).toBeVisible()
    expect(screen.getByText('Subtotal de repuestos')).toBeVisible()
    expect(screen.getByText('Precio de referencia')).toBeVisible()
    expect(screen.getByText(/Referencia informativa/)).toBeVisible()
    expect(screen.getAllByText(/Gs\.\s*120\.000/)).toHaveLength(1)
    expect(screen.getAllByText(/Gs\.\s*200\.000/)).toHaveLength(1)
  })
})
