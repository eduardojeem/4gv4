import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/components/dashboard/agenda/AppointmentDialog', () => ({ AppointmentDialog: () => null, STATUS_COLORS: {} }))
vi.mock('@/components/dashboard/agenda/AppointmentEventsBell', () => ({ AppointmentEventsBell: () => null }))
const tenant = vi.hoisted(() => ({ scope: 'org', currentScope: { current: 'org' } }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => tenant }))
import { AgendaBoard } from '@/components/dashboard/agenda/AgendaBoard'
import { ExpirationsBoard } from '@/components/dashboard/expirations/ExpirationsBoard'
beforeEach(() => { tenant.scope = 'org'; tenant.currentScope.current = 'org' })
afterEach(() => vi.unstubAllGlobals())
describe('failed dashboard requests', () => {
 for (const [name, Board] of [['agenda', AgendaBoard], ['expirations', ExpirationsBoard]] as const) {
  it(`${name} presents HTTP failure and retry instead of empty or missing-schema guidance`, async () => {
   vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden' }) }))
   render(<Board />)
   await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
   expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
   expect(screen.queryByText(/Todavía no registraste lotes/)).toBeNull()
   expect(screen.queryByText(/La agenda todavía no está activada/)).toBeNull()
  })
 }
})

describe('board request lifetime and response validation', () => {
 for (const [name, Board] of [['agenda', AgendaBoard], ['expirations', ExpirationsBoard]] as const) {
  it(`${name} aborts and ignores a response from the previous organization`, async () => {
   let finishOld!: (response: unknown) => void
   const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve })).mockResolvedValueOnce({ ok: true, json: async () => ({ available: false }) })
   vi.stubGlobal('fetch', fetchMock)
   const { rerender } = render(<Board />)
   await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
   tenant.currentScope.current = 'other'
   tenant.scope = 'other'
   rerender(<Board />)
   await waitFor(() => expect(screen.getByText(/todavía no están activados|todavía no está activada/)).toBeTruthy())
   expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
   await act(async () => { finishOld({ ok: false, json: async () => ({ error: 'Old failure' }) }) })
   expect(screen.queryByRole('alert')).toBeNull()
  })
  it(`${name} rejects a malformed 200 payload and can retry`, async () => {
   const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ available: true }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ available: false }) })
   vi.stubGlobal('fetch', fetchMock)
   render(<Board />)
   await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
   fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
   await waitFor(() => expect(screen.getByText(/todavía no están activados|todavía no está activada/)).toBeTruthy())
   expect(screen.queryByRole('alert')).toBeNull()
  })
 }
})
