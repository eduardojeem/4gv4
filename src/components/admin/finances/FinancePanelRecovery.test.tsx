import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FinanceSettingsPanel } from './FinanceSettingsPanel'
import { PayrollPanel } from './PayrollPanel'

const uuid = '11111111-1111-4111-8111-111111111111'
const filters = { startDate: '2026-08-01', endDate: '2026-08-31' }
const json = (body: unknown) => new Response(JSON.stringify(body))
afterEach(() => vi.unstubAllGlobals())

describe('finance panel recovery', () => {
  it.each(['draft', 'approved'])('releases a %s rule action after a network rejection', async (status) => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'PATCH') throw new TypeError('Failed to fetch')
      return json(String(url).includes('/commission-rules') ? { rules: [{ id: uuid, scope_type: 'role', role: 'seller', source_type: 'sale', calculation_type: 'percentage', value: 15, status, effective_from: '2026-08-01' }] } : { employees: [], compensation: [] })
    }))
    render(<FinanceSettingsPanel organizationId={uuid} branchId={null} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))
    const label = status === 'draft' ? 'Aprobar regla' : 'Retirar'
    await user.click(await screen.findByRole('button', { name: label }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/verificá.*estado/i)
    expect(screen.getByRole('button', { name: label })).toBeEnabled()
  })

  it('preserves a commission draft after submit failure and refresh', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.method === 'POST') throw new TypeError('Failed to fetch')
      return json({ employees: [], compensation: [], rules: [] })
    }))
    const view = render(<FinanceSettingsPanel organizationId={uuid} branchId={null} refreshVersion={0} />)
    await user.click(screen.getByRole('button', { name: /Reglas de Comisión/ }))
    await user.selectOptions(screen.getByLabelText('Alcance'), 'role')
    await user.selectOptions(screen.getByLabelText('Rol'), 'seller')
    await user.type(screen.getByLabelText('Valor'), '15')
    await user.type(screen.getByLabelText('Vigente desde'), '2026-08-01')
    await user.click(screen.getByRole('button', { name: 'Crear y aprobar regla' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/verificá.*estado/i)
    expect(screen.getByRole('button', { name: 'Crear y aprobar regla' })).toBeEnabled()
    view.rerender(<FinanceSettingsPanel organizationId={uuid} branchId={null} refreshVersion={1} />)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Valor')).toHaveValue(15)
  })
  it('reports a payroll load rejection and recovers on refresh', async () => {
    let failed = true
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (failed) throw new TypeError('Failed to fetch')
      return json({ runs: [] })
    }))
    const props = { organizationId: uuid, branchId: null, filters, onChanged: vi.fn() }
    const view = render(<PayrollPanel {...props} refreshVersion={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cargar.*nóminas/i)
    failed = false
    view.rerender(<PayrollPanel {...props} refreshVersion={1} />)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('releases payroll approval after a network rejection', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (init?.method === 'POST') throw new TypeError('Failed to fetch')
      return json({ runs: [{ id: uuid, status: 'draft', period_from: filters.startDate, period_to: filters.endDate, entries: [] }] })
    }))
    render(<PayrollPanel organizationId={uuid} branchId={null} filters={filters} onChanged={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Aprobar nómina' }))
    await user.click(screen.getByRole('button', { name: 'Sí, aprobar nómina' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/verificá.*estado/i)
    expect(screen.getByRole('button', { name: 'Sí, aprobar nómina' })).toBeEnabled()
  })

  it('reports settings load failure on the default personnel tab and recovers on refresh', async () => {
    let failed = true
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (failed) throw new TypeError('Failed to fetch')
      return json(String(url).includes('/employees') ? { employees: [{ user_id: uuid, display_name: 'Ana', role: 'seller' }] } : { rules: [], compensation: [] })
    }))
    const view = render(<FinanceSettingsPanel organizationId={uuid} branchId={null} refreshVersion={0} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cargar.*configuración/i)
    failed = false
    view.rerender(<FinanceSettingsPanel organizationId={uuid} branchId={null} refreshVersion={1} />)
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
