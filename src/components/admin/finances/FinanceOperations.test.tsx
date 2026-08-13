import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseDialog } from './ExpenseDialog'
import { PaymentDialog } from './PaymentDialog'
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
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'bank_transfer')
    expect(screen.queryByLabelText('Sesión de caja')).not.toBeInTheDocument()
  })

  it('shows server payroll preview totals and requires approval confirmation', async () => {
    const user = userEvent.setup()
    const onApprove = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      preview: { totals: { netPay: 450000 }, entries: [] },
    }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} onApprove={onApprove} />)

    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(await screen.findByText('Total neto: ₲ 450.000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprobar nómina' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('no se podrán modificar')
    await user.click(screen.getByRole('button', { name: 'Confirmar aprobación' }))
    expect(onApprove).toHaveBeenCalledOnce()
  })

  it('keeps approved amounts read-only and explains employee exception priority', () => {
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} approvedEntries={[{ id: uuid, employeeId: uuid, employeeName: 'Ana', netPay: 450000 }]} />)

    expect(screen.getByLabelText('Monto aprobado de Ana')).toHaveAttribute('readonly')
    expect(screen.getByText('Las excepciones individuales del empleado prevalecen sobre las reglas de rol.')).toBeInTheDocument()
  })

  it('propagates the current period and branch to profitability exports', () => {
    render(<ProfitabilityPanel organizationId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} />)
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute(
      'href',
      expect.stringContaining('startDate=2026-08-01'),
    )
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute(
      'href',
      expect.stringContaining('branchId=' + uuid),
    )
  })
})
