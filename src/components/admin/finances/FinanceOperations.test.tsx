import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseDialog } from './ExpenseDialog'
import { ExpensesPanel } from './ExpensesPanel'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { PaymentDialog } from './PaymentDialog'
import { PayrollPanel } from './PayrollPanel'
import { PayrollRunDialog } from './PayrollRunDialog'
import { ProfitabilityPanel } from './ProfitabilityPanel'

const uuid = '11111111-1111-4111-8111-111111111111'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('finance operational dialogs', () => {
  it('presents expense status and outstanding balance with descriptive labels', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ categories: [] }))
      .mockResolvedValueOnce(json({
        obligations: [{
          id: uuid,
          concept: 'Internet del local',
          amount: 240000,
          outstanding_amount: 240000,
          requires_cash_session_on_void: false,
          due_date: '2026-08-18',
          status: 'pending',
        }],
        total: 1,
      })))

    render(<ExpensesPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-31', branchId: uuid }} onChanged={vi.fn()} />)

    expect(await screen.findAllByText('Pendiente')).toHaveLength(2)
    expect(screen.getAllByText('Pendiente de pago')).toHaveLength(3)
  })

  it('exposes recurrence controls when creating an expense', async () => {
    const user = userEvent.setup()
    render(<ExpenseDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} categories={[{ id: uuid, name: 'Alquiler' }]} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Repetir este gasto' }))
    expect(screen.getByLabelText('Frecuencia')).toBeInTheDocument()
    expect(screen.getByLabelText('Inicio de recurrencia')).toBeInTheDocument()
  })

  it('requires a cash session only for cash payments', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      sessions: [{ id: uuid, registerName: 'Caja principal', openingBalance: 100000, openedAt: '2026-08-01T10:00:00.000Z' }],
    })))
    render(<PaymentDialog open onOpenChange={vi.fn()} organizationId={uuid} obligationId={uuid} branchId={uuid} onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('Sesión de caja')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Método de pago'), 'cash')
    expect(await screen.findByLabelText('Sesión de caja')).toBeRequired()
  })

  it('shows server payroll preview totals before creating a run', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ preview: { totals: { netPay: 450000 }, entries: [] } })))
    render(<PayrollRunDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15' }} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(await screen.findByText(/Total neto:\s*(Gs\.|₲)/)).toBeInTheDocument()
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
    expect(screen.getAllByText('Revisar y aprobar')).toHaveLength(2)
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
      .mockResolvedValueOnce(json({ compensation: [] }))
      .mockResolvedValueOnce(json({ rule: { id: uuid } }, 201))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))

    await user.selectOptions(await screen.findByLabelText('Alcance'), 'role')
    await user.selectOptions(screen.getByLabelText('Rol'), 'seller')
    await user.type(screen.getByLabelText('Valor'), '15')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Crear y aprobar regla' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    const [, request] = fetchMock.mock.calls[3]
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
      .mockResolvedValueOnce(json({ compensation: [] }))
      .mockResolvedValueOnce(json({ rule: { ...draftRule, status: 'approved' } }))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [{ ...draftRule, status: 'approved' }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))

    await user.click(await screen.findByRole('button', { name: 'Aprobar regla' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    const [, request] = fetchMock.mock.calls[3]
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toMatchObject({ id: uuid, status: 'approved', effectiveFrom: '2026-08-01' })
  })

  // Una regla aprobada no se podia frenar desde la pantalla: no habia fecha de
  // fin ni accion de retiro, asi que una comision de temporada corria para
  // siempre. No se borra —la base restringe borrar reglas con devengos— se retira.
  it('retires an approved rule instead of deleting its history', async () => {
    const user = userEvent.setup()
    const approvedRule = {
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
      status: 'approved',
      effective_from: '2026-08-01',
      effective_to: null,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [approvedRule] }))
      .mockResolvedValueOnce(json({ compensation: [] }))
      .mockResolvedValueOnce(json({ rule: { ...approvedRule, status: 'retired' } }))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [{ ...approvedRule, status: 'retired' }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))

    await user.click(await screen.findByRole('button', { name: 'Retirar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    const [, request] = fetchMock.mock.calls[3]
    expect(request.method).toBe('PATCH')
    expect(JSON.parse(request.body)).toMatchObject({ id: uuid, status: 'retired' })
  })

  // Escribir 50 en vez de 5 se guardaba sin aviso y recien aparecia en la corrida.
  it('refuses a commission above 100% before sending it', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
      .mockResolvedValueOnce(json({ compensation: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))

    await user.selectOptions(await screen.findByLabelText('Alcance'), 'role')
    await user.selectOptions(screen.getByLabelText('Rol'), 'seller')
    await user.type(screen.getByLabelText('Valor'), '500')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Crear y aprobar regla' }))

    expect(await screen.findByText(/no puede superar el 100%/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('sends the end date so a seasonal rule stops on its own', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
      .mockResolvedValueOnce(json({ compensation: [] }))
      .mockResolvedValueOnce(json({ rule: { id: uuid } }, 201))
      .mockResolvedValueOnce(json({ employees: [] }))
      .mockResolvedValueOnce(json({ rules: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))

    await user.selectOptions(await screen.findByLabelText('Alcance'), 'role')
    await user.selectOptions(screen.getByLabelText('Rol'), 'seller')
    await user.type(screen.getByLabelText('Valor'), '5')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-08-01')
    await user.type(screen.getByLabelText('Vigente hasta'), '2026-08-31')
    await user.click(screen.getByRole('button', { name: 'Crear y aprobar regla' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    const [, request] = fetchMock.mock.calls[3]
    expect(JSON.parse(request.body)).toMatchObject({ effectiveTo: '2026-08-31' })
  })

  it('propagates the current period and branch to profitability exports', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ rows: [] }))
      .mockResolvedValueOnce(new Response('detalle,ingresos\n', { headers: { 'content-disposition': 'attachment; filename="rentabilidad.csv"' } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfitabilityPanel organizationId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: uuid }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Exportar rentabilidad' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toContain('startDate=2026-08-01')
    expect(fetchMock.mock.calls[1][0]).toContain('branchId=' + uuid)
  })

  it('allows editing an unpaid expense and submitting updates', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ categories: [{ id: uuid, name: 'Servicios' }] }))
      .mockResolvedValueOnce(json({
        obligations: [{
          id: uuid,
          concept: 'Luz y Agua',
          amount: 150000,
          outstanding_amount: 150000,
          requires_cash_session_on_void: false,
          due_date: '2026-08-20',
          accounting_date: '2026-08-01',
          vendor: 'ANDE',
          status: 'pending',
          finance_categories: { id: uuid, name: 'Servicios' },
        }],
        total: 1,
      }))
      .mockResolvedValueOnce(json({})) // PATCH response
      .mockResolvedValueOnce(json({ categories: [{ id: uuid, name: 'Servicios' }] }))
      .mockResolvedValueOnce(json({ obligations: [], total: 0 }))

    vi.stubGlobal('fetch', fetchMock)
    render(<ExpensesPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-31', branchId: uuid }} onChanged={vi.fn()} />)

    const editBtns = await screen.findAllByRole('button', { name: 'Editar' })
    expect(editBtns.length).toBeGreaterThan(0)
    await user.click(editBtns[0])

    expect(screen.getByRole('heading', { name: 'Editar gasto' })).toBeInTheDocument()
    const conceptInput = screen.getByDisplayValue('Luz y Agua')
    expect(conceptInput).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/admin/finances/obligations/${uuid}`),
      expect.objectContaining({ method: 'PATCH' }),
    ))
  })

  it('searches obligations through the server across pages', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ categories: [] }))
      .mockResolvedValueOnce(json({
        obligations: [
          {
            id: '1',
            concept: 'Limpieza de oficina',
            amount: 50000,
            outstanding_amount: 50000,
            requires_cash_session_on_void: false,
            due_date: '2026-08-10',
            status: 'paid',
          },
          {
            id: '2',
            concept: 'Repuestos pantalla',
            vendor: 'Proveedor ABC',
            amount: 300000,
            outstanding_amount: 300000,
            requires_cash_session_on_void: false,
            due_date: '2026-08-25',
            status: 'pending',
          },
        ],
        total: 2,
      }))
      .mockResolvedValue(json({ obligations: [{ id: '2', concept: 'Repuestos pantalla', vendor: 'Proveedor ABC', amount: 300000, outstanding_amount: 300000, status: 'pending', due_date: '2026-08-25' }], total: 1 })))

    render(<ExpensesPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-31', branchId: uuid }} onChanged={vi.fn()} />)

    const items = await screen.findAllByText('Limpieza de oficina')
    expect(items.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Repuestos pantalla').length).toBeGreaterThan(0)

    const searchInput = screen.getByPlaceholderText('Buscar por concepto o proveedor…')
    await user.type(searchInput, 'ABC')

    await waitFor(() => expect(screen.queryAllByText('Limpieza de oficina')).toHaveLength(0))
    expect(screen.getAllByText('Repuestos pantalla').length).toBeGreaterThan(0)
  })

  it('excludes voided expenses from pageAmount and pageOutstanding totals', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ categories: [] }))
      .mockResolvedValueOnce(json({
        obligations: [
          {
            id: '1',
            concept: 'Gasto Activo',
            amount: 100000,
            outstanding_amount: 100000,
            requires_cash_session_on_void: false,
            due_date: '2026-08-10',
            status: 'pending',
          },
          {
            id: '2',
            concept: 'Gasto Anulado',
            amount: 500000,
            outstanding_amount: 0,
            requires_cash_session_on_void: false,
            due_date: '2026-08-12',
            status: 'voided',
          },
        ],
        total: 2,
      })))

    render(<ExpensesPanel organizationId={uuid} branchId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-31', branchId: uuid }} onChanged={vi.fn()} />)

    // Solo debe sumar los 100.000 del gasto activo, no los 500.000 del anulado
    const amounts = await screen.findAllByText(/100\.000/)
    expect(amounts.length).toBeGreaterThan(0)
    expect(screen.queryByText(/600\.000/)).not.toBeInTheDocument()
  })
})

describe('profitability analysis', () => {
  const profitabilityRows = [
    { id: 'sale:a', label: 'Venta A', revenue: 1_000_000, directCosts: 600_000, grossProfit: 400_000, complete: true },
    { id: 'sale:b', label: 'Venta B', revenue: 400_000, directCosts: 380_000, grossProfit: 20_000, complete: true },
    { id: 'sale:c', label: 'Venta C sin costo', revenue: 600_000, directCosts: null, grossProfit: null, complete: false },
  ]

  const renderPanel = async (rows = profitabilityRows) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ rows })))
    render(<ProfitabilityPanel organizationId={uuid} filters={{ startDate: '2026-08-01', endDate: '2026-08-15', branchId: null }} />)
    // La tabla de escritorio y las tarjetas móviles conviven en el DOM: las
    // consultas por texto usan la variante plural.
    await screen.findAllByText('Venta A')
  }

  it('shows the gross margin per row and for the period', async () => {
    await renderPanel()

    // 400.000 / 1.000.000 y 20.000 / 400.000
    expect(screen.getAllByText('40%')).not.toHaveLength(0)
    expect(screen.getAllByText('5%')).not.toHaveLength(0)
    // Margen del período sobre los ingresos con costo cargado:
    // 420.000 / 1.400.000 = 30%
    expect(screen.getAllByText('30%')).not.toHaveLength(0)
  })

  it('excludes rows without cost coverage from cost, profit and margin', async () => {
    await renderPanel()

    expect(screen.getByText('El costo, la utilidad y el margen excluyen 1 de 3 filas sin costo cargado.')).toBeInTheDocument()
    expect(screen.getByText('Mostrando 3 de 3 filas por venta.')).toBeInTheDocument()
  })

  it('filters rows by label without touching the server', async () => {
    const user = userEvent.setup()
    await renderPanel()
    const requestsBeforeSearch = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length

    await user.type(screen.getByLabelText('Buscar'), 'Venta B')

    await waitFor(() => expect(screen.getByText('Mostrando 1 de 3 filas por venta.')).toBeInTheDocument())
    expect(screen.queryAllByText('Venta A')).toHaveLength(0)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(requestsBeforeSearch)
  })

  it('reorders rows when a sortable column header is activated', async () => {
    const user = userEvent.setup()
    await renderPanel()

    const labelsOf = () => screen.getAllByRole('row').slice(1).map((row) => row.querySelector('p')?.textContent)
    // Orden por defecto: ingresos descendentes.
    expect(labelsOf()).toEqual(['Venta A', 'Venta C sin costo', 'Venta B'])

    await user.click(screen.getByRole('button', { name: /Utilidad bruta/ }))

    // Utilidad descendente, y la fila sin cobertura al final.
    await waitFor(() => expect(labelsOf()).toEqual(['Venta A', 'Venta B', 'Venta C sin costo']))
  })

  it('distinguishes an empty period from an empty filter result', async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.type(screen.getByLabelText('Buscar'), 'no existe')

    expect(await screen.findAllByText('Ninguna fila coincide con la búsqueda o el filtro de cobertura.')).not.toHaveLength(0)
  })
})
