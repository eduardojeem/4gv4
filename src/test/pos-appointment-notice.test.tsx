import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppointmentCheckoutNotice } from '@/app/dashboard/pos/components/AppointmentCheckoutNotice'
afterEach(cleanup)
describe('appointment checkout notice', () => {
 it('explains that a closed cash register has not charged the appointment and offers opening it', () => {
  const open = vi.fn()
  render(<AppointmentCheckoutNotice code="T-00001" cashOpen={false} onOpenCash={open} onRemove={vi.fn()} />)
  expect(screen.getByText(/Todavía no se registró el cobro/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name:'Abrir caja para cobrar' }))
  expect(open).toHaveBeenCalledOnce()
 })
 it('does not ask to open an already open register', () => {
  render(<AppointmentCheckoutNotice code="T-00001" cashOpen onOpenCash={vi.fn()} onRemove={vi.fn()} />)
  expect(screen.queryByRole('button', { name:'Abrir caja para cobrar' })).not.toBeInTheDocument()
  expect(screen.getByText(/precio acordado/)).toBeInTheDocument()
 })
})
