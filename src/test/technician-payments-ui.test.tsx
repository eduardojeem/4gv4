// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TechnicianPaymentsTab } from '@/components/dashboard/technicians/detail/TechnicianPaymentsTab'
import { useTechnicianCompensation } from '@/hooks/use-technician-compensation'
import { useTechnicianStats } from '@/hooks/use-technician-stats'
import { TechnicianCompensationCard } from '@/components/dashboard/technicians/detail/TechnicianCompensationCard'
import { DEFAULT_COMPENSATION } from '@/lib/technician/earnings'
import { renderHook } from '@testing-library/react'
const state = vi.hoisted(() => ({ finance: false, organizationId: 'org' }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch' }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: state.organizationId }, isLoading: false }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useEffectiveModule: () => state.finance }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ hasPermission: (permission: string) => permission === 'settings.read' }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear(); state.finance = false; state.organizationId = 'org' })
describe('technician payment interface', () => {
  it('does not retain editable terms when the technician identity changes', () => {
    const props = { technicianId: 'first-tech', canManage: true, compensation: { ...DEFAULT_COMPENSATION, base_salary: 123 }, earnings: null, isLoading: false, onSaved: vi.fn() }
    const { rerender } = render(<TechnicianCompensationCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByDisplayValue('123')).toBeTruthy()
    rerender(<TechnicianCompensationCard {...props} technicianId="second-tech" compensation={{ ...DEFAULT_COMPENSATION, base_salary: 456 }} />)
    expect(screen.queryByDisplayValue('123')).toBeNull()
  })
  it('suppresses obsolete save callbacks after organization identity changes', async () => {
    let resolveSave!: (response: unknown) => void
    vi.stubGlobal('fetch', () => new Promise(resolve => { resolveSave = resolve }))
    const onSaved = vi.fn()
    const props = { technicianId: 'tech', canManage: true, compensation: DEFAULT_COMPENSATION, earnings: null, isLoading: false, onSaved }
    const { rerender } = render(<TechnicianCompensationCard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    state.organizationId = 'org-2'; rerender(<TechnicianCompensationCard {...props} />)
    await act(async () => resolveSave({ ok: true }))
    expect(onSaved).not.toHaveBeenCalled()
  })
  it('reuses the same payment key after a lost response and tab remount', async () => {
    const keys: string[] = []
    vi.stubGlobal('fetch', async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        keys.push(new Headers(options.headers).get('x-idempotency-key') || '')
        if (keys.length === 1) throw new Error('Connection lost')
        return { ok: true, json: async () => ({ payment: { id: 'saved' } }) }
      }
      return { ok: true, json: async () => ({ payments: [], summary: { devengado: 100, pagado: 0, saldo: 100 } }) }
    })
    const first = render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar', exact: true }))
    await screen.findByRole('button', { name: 'Reintentar misma solicitud' })
    first.unmount()
    render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    fireEvent.click(screen.getByRole('button', { name: /Registrar|Reintentar misma solicitud/, exact: true }))
    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[0]).not.toBe('')
    expect(keys[1]).toBe(keys[0])
  })
  it('does not reuse the technician cache across organizations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ technicians: [{ id: 'old-tech', name: 'Old', specialty: null, activeJobs: 0, completedThisMonth: 0, totalCompleted: 0, avgCompletionDays: 0 }] }) }).mockImplementation(() => new Promise(() => {})))
    const { result, rerender } = renderHook(() => useTechnicianStats())
    await waitFor(() => expect(result.current.technicians[0]?.id).toBe('old-tech'))
    state.organizationId = 'another-org'; rerender()
    expect(result.current.technicians).toEqual([])
  })
  it('exposes a configuration error instead of a zero compensation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const { result } = renderHook(() => useTechnicianCompensation('tech', true))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.earnings).toBeNull()
  })
  it('hides previous organization earnings immediately while the next one loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ compensation: {}, earnings: { total: 999 } }) }).mockImplementation(() => new Promise(() => {})))
    const { result, rerender } = renderHook(() => useTechnicianCompensation('tech', true))
    await waitFor(() => expect(result.current.earnings?.total).toBe(999))
    state.organizationId = 'org-2'; rerender()
    expect(result.current.earnings).toBeNull()
  })
  it('ignores a late payment response from the previous organization', async () => {
    let resolveOld!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve })).mockResolvedValue({ ok: true, json: async () => ({ payments: [], summary: { devengado: 100, pagado: 0, saldo: 100 } }) }))
    const { rerender } = render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    state.organizationId = 'org-2'; rerender(<TechnicianPaymentsTab technicianId="tech" canManage />)
    await screen.findByText('Registrar pago')
    await act(async () => resolveOld({ ok: true, json: async () => ({ payments: [], summary: { devengado: 999, pagado: 0, saldo: 999 } }) }))
    expect(screen.queryByText(/999/)).toBeNull()
  })
  it('shows a query failure instead of an empty balance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Sin pagos registrados.')).toBeNull()
    expect(screen.queryByText('Registrar pago')).toBeNull()
  })
  it('retains basic payout and lets the user select a period without Finance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ payments: [], summary: { devengado: 100, pagado: 0, saldo: 100 } }) }))
    render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    await screen.findByText('Registrar pago')
    expect(screen.getByLabelText('Período')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-09' } })
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Período').value).toBe('2026-09'))
  })
  it('offers Finance navigation for an authorized plan without another payout button', async () => {
    state.finance = true
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ payments: [], summary: { devengado: 100, pagado: 0, saldo: 100 } }) }))
    render(<TechnicianPaymentsTab technicianId="tech" canManage />)
    expect(await screen.findByRole('link', { name: 'Ver liquidación en Finanzas' })).toBeTruthy()
    expect(screen.queryByText('Registrar pago')).toBeNull()
  })
})
