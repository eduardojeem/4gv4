import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { WaitingPartsPanel, groupWaitingParts } from '../WaitingPartsPanel'

const repair = (id: string, part: Repair['waitingPart'], status: Repair['status'] = 'pausado') =>
  ({ id, ticketNumber: `R-${id}`, status, customer: { name: `Cliente ${id}` }, waitingPart: part }) as unknown as Repair

const repairs = [
  repair('1', { name: 'Pantalla A05', supplier: 'Distribuidora X', expected_on: '2026-10-16', ordered_at: '' }),
  repair('2', { name: 'Batería A12', supplier: 'Distribuidora X', expected_on: '2026-10-10', ordered_at: '' }),
  repair('3', { name: 'Flex de carga', supplier: null, expected_on: null, ordered_at: '' }),
  repair('4', null, 'reparacion'),
  repair('5', { name: 'Tapa', supplier: 'Otra', expected_on: '2026-10-20', ordered_at: '' }, 'entregado'),
]

describe('Repuestos por llegar', () => {
  it('agrupa por proveedor, con lo que llega antes primero, sin lo entregado', () => {
    const groups = groupWaitingParts(repairs)
    expect(groups.map((group) => group.supplier)).toEqual(['Distribuidora X', 'Sin proveedor'])
    expect(groups[0].items.map((item) => item.id)).toEqual(['2', '1'])
  })

  it('cuenta, marca los atrasados y abre la reparación al tocarla', () => {
    const onOpenRepair = vi.fn()
    render(<WaitingPartsPanel repairs={repairs} onOpenRepair={onOpenRepair} today="2026-10-13" />)
    fireEvent.click(screen.getByRole('button', { name: /3 repuestos por llegar/ }))
    expect(screen.getByText('1 atrasado')).toBeInTheDocument()
    expect(screen.getByText('debía llegar el 10/10')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Pantalla A05'))
    expect(onOpenRepair).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('sin repuestos esperados no ocupa lugar', () => {
    const { container } = render(<WaitingPartsPanel repairs={[repairs[3]]} onOpenRepair={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
