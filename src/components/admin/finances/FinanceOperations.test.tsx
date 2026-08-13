import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseDialog } from './ExpenseDialog'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { PaymentDialog } from './PaymentDialog'
import { PayrollPanel } from './PayrollPanel'
import { PayrollRunDialog } from './PayrollRunDialog'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const uuid = '11111111-1111-4111-8111-111111111111'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ preview: { totals: { netPay: 450000 }, entries: [] } })))
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(await screen.findByText('Total neto: ₲ 450.000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear nómina' })).toBeEnabled()
  })

  it('creates organization-wide payroll with a null branch after previewing it', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ preview: { totals: { netPay: 450000 }, entries: [] } }))
      .mockResolvedValueOnce(json({}, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={null} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    await user.click(await screen.findByRole('button', { name: 'Crear nómina' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [, request] = fetchMock.mock.calls[1]
    expect(JSON.parse(request.body)).toMatchObject({ periodFrom: '2026-08-01', periodTo: '2026-08-15', branchId: null })
  })

  it('switches payroll from the current branch to the organization-wide creation and payment flows', async () => {
    const user = userEvent.setup()
    const runId = '22222222-2222-4222-8222-222222222222'
    const entryId = '33333333-3333-4333-8333-333333333333'
    const approvedRun = {
      id: runId,
      status: 'approved',
      period_from: '2026-08-01',
      period_to: '2026-08-15',
      entries: [{ id: entryId, employee_id: uuid, employee_role: 'seller', net_amount: 450000, paid_amount: 0, outstanding_amount: 450000, payment_status: 'pending' }],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ runs: [] }))
      .mockResolvedValueOnce(json({ runs: [] }))
      .mockResolvedValueOnce(json({ preview: { totals: { netPay: 450000 }, entries: [] } }))
      .mockResolvedValueOnce(json({}, 201))
      .mockResolvedValueOnce(json({ runs: [approvedRun] }))
      .mockResolvedValueOnce(json({}, 201))
      .mockResolvedValueOnce(json({ runs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PayrollPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} onChanged={vi.fn()} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toContain(`branchId=${uuid}`)

    await user.click(screen.getByRole('switch', { name: 'Toda la organización' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).not.toContain('branchId=')

    await user.click(screen.getByRole('button', { name: 'Preparar nómina' }))
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    await user.click(await screen.findByRole('button', { name: 'Crear nómina' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toMatchObject({ branchId: null })

    await user.click(await screen.findByRole('button', { name: 'Pago parcial' }))
    await user.type(screen.getByLabelText('Monto'), '450000')
    await user.type(screen.getByLabelText('Fecha de pago'), '2026-08-15')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(7))
    const payment = JSON.parse(fetchMock.mock.calls[5][1].body)
    expect(payment).toMatchObject({ amount: 450000 })
    expect(payment).not.toHaveProperty('branchId')
  })

  it('requires explicit confirmation before approving a draft run', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ runs: [{ id: uuid, status: 'draft', period_from: '2026-08-01', period_to: '2026-08-15', entries: [] }] }))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ runs: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PayrollPanel organizationId={uuid} branchId={null} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: null }} onChanged={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Preparar nómina' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Aprobar nómina' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('no se puede deshacer')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining(`/payroll/${uuid}/approve`), expect.anything())

    await user.click(screen.getByRole('button', { name: 'Sí, aprobar nómina' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/payroll/${uuid}/approve`), expect.objectContaining({ method: 'POST' })))
  })

  it('creates an approved commission rule so it is effective immediately', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
      .mockResolvedValueOnce(json({ rule: { id: uuid } }, 201))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)

    await user.selectOptions(await screen.findByLabelText('Alcance'), 'role')
    await user.selectOptions(screen.getByLabelText('Rol'), 'seller')
    await user.type(screen.getByLabelText('Valor'), '15')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Crear y aprobar regla' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    const [, request] = fetchMock.mock.calls[2]
    expect(JSON.parse(request.body)).toMatchObject({ scopeType: 'role', role: 'seller', status: 'approved' })
  })

  it('approves a saved draft commission rule through the audited update endpoint', async () => {
    const user = userEvent.setup()
    const draftRule = {
      id: uuid,
      branch_id: null,
      scope_type: 'role',
      role: 'seller',
      employee_id: null,
      source_type: 'sale',
      source_reference_id: null,
      accrual_status: null,
      calculation_type: 'percentage',
      value: 15,
      status: 'draft',
      effective_from: '2026-08-01',
      effective_to: null,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [draftRule] }))
      .mockResolvedValueOnce(json({ rule: { ...draftRule, status: 'approved' } }))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [{ ...draftRule, status: 'approved' }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)

    await user.click(await screen.findByRole('button', { name: 'Aprobar regla' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
    const [, request] = fetchMock.mock.calls[2]
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toMatchObject({ id: uuid, status: 'approved', effectiveFrom: '2026-08-01' })
  })

  it('propagates the current period and branch to profitability exports', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ rows: [] })))
    render(<ProfitabilityPanel organizationId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} />)
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute('href', expect.stringContaining('startDate=2026-08-01'))
    expect(screen.getByRole('link', { name: 'Exportar rentabilidad' })).toHaveAttribute('href', expect.stringContaining('branchId=' + uuid))
  })
})
