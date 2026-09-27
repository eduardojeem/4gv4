import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import type { Repair } from '@/types/repairs'
import { UnrepairedCloseoutPanel } from '../UnrepairedCloseoutPanel'

const repair = {
  paidAmount: 100,
  finalCost: 200,
  estimatedCost: 200,
  parts: [{
    id: 0, databaseId: '6d8238d2-fdc5-4939-85d7-130a823982b0', name: 'Pantalla', cost: 80,
    internalCost: 50, quantity: 1, supplier: '', partNumber: '', productId: 'product-1',
  }],
} as Repair

describe('UnrepairedCloseoutPanel', () => {
  it('requires every part disposition and offers store credit for an overpayment', () => {
    const onChange = vi.fn()
    render(<UnrepairedCloseoutPanel repair={repair} value={null} onChange={onChange} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Resolvé todos los repuestos')
    fireEvent.click(screen.getByRole('radio', { name: /Volver a inventario/i }))

    const latest = onChange.mock.calls.at(-1)?.[0]
    expect(latest.parts).toEqual([{
      repairPartId: '6d8238d2-fdc5-4939-85d7-130a823982b0', disposition: 'restocked',
    }])
    expect(screen.getByText('A favor del cliente')).toBeVisible()
    expect(screen.getByRole('radio', { name: /Saldo a favor/i })).toBeVisible()
  })

  it('requires a reason when an exceptional amount is selected', () => {
    function Harness() {
      const [value, setValue] = useState<Parameters<typeof UnrepairedCloseoutPanel>[0]['value']>(null)
      return <UnrepairedCloseoutPanel repair={repair} value={value} onChange={setValue} />
    }
    render(<Harness />)

    fireEvent.click(screen.getByRole('radio', { name: /Importe excepcional/i }))
    expect(screen.getByLabelText('Motivo del importe excepcional')).toBeRequired()
  })
})
