import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseDialog } from './ExpenseDialog'
import { PaymentDialog } from './PaymentDialog'
import { PayrollPanel } from './PayrollPanel'
import { PayrollRunDialog } from './PayrollRunDialog'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const uuid = '11111111-1111-4111-8111-111111111111'

describe('finance operational dialogs', () => {
  it('exposes recurrence controls when creating an expense', async () => {
    const user = userEvent.setup()
    render(<ExpenseDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} categories={[{ id: uuid, name: 'Alquiler' }]} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Repetir este gasto' }))
    expect(screen.getByLabelText('Frecuencia')).toBeInTheDocument()
    expect(screen.getByLabelText('Inicio de recurrencia')).toBeInTheDocument()
  })

  it('requires a cash session only for cash payments', async () => {
    const user = userEvent.setup()
    render(<PaymentDialog open onOpenChange={vi.fn()} organizationId={uuid} obligationId={uuid} branchId={uuid} onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('Sesión de caja')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'cash')
    expect(screen.getByLabelText('Sesión de caja')).toBeRequired()
  })

  it('shows server payroll preview totals before creating a run', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ preview: { totals: { netPay: 450000 }, entries: [] } }), { status: 200 })))
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(await screen.findByText('Total neto: ₲ 450.000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear nómina' })).toBeEnabled()
  })

  it('approves a draft run through the production payroll panel', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ runs: [{ id: uuid, status: 'draft', period_from: '2026-08-01', period_to: '2026-08-15', entries: [] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ runs: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PayrollPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} onChanged={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Aprobar nómina' }))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/payroll/${uuid}/approve`), expect.objectContaining({ method: 'POST' }))
  })

  it('propagates the current period and branch to profitability exports', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [] }), { status: 200 })))
    render(<ProfitabilityPanel organizationId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} />)
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute('href', expect.stringContaining('startDate=2026-08-01'))
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute('href', expect.stringContaining('branchId=' + uuid))
  })
})
