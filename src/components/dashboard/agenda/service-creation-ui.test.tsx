import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewServiceDialog } from './NewServiceDialog'
import { SuggestedServicesCard } from './SuggestedServicesCard'
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ businessVertical: 'beauty_services', serviceSpecialties: ['nails', 'lashes'] }) }))
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const success = () => new Response(JSON.stringify({ success: true, service: { id: 'created' }, replayed: false }), { status: 200 })
describe('atomic service entry UI', () => {
  it('accepts zero and custom duration, uses one POST and retries the same draft key', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(success())
    vi.stubGlobal('fetch', fetch)
    render(<NewServiceDialog open onOpenChange={vi.fn()} existingNames={[]} currency="PYG" onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Manicura' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '55' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar en catálogo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar servicio' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const first = JSON.parse(fetch.mock.calls[0][1].body)
    expect(first).toMatchObject({ price: 0, durationMinutes: 55, catalogVisible: false, online: true })
    expect(JSON.parse(fetch.mock.calls[1][1].body).requestKey).toBe(first.requestKey)
    expect(fetch.mock.calls.every(([url]) => url === '/api/agenda/services')).toBe(true)
  })
  it('keeps completed batch rows out of retries after a partial failure', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(success()).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(success())
    vi.stubGlobal('fetch', fetch)
    render(<SuggestedServicesCard suggestions={[{ name: 'A' }, { name: 'B' }]} currency="PYG" rubroLabel="servicios" onAdded={vi.fn()} />)
    for (const name of ['A','B']) {
      fireEvent.change(screen.getByLabelText(`Precio de ${name}`), { target: { value: '0' } })
      fireEvent.change(screen.getByLabelText(`Duración de ${name}`), { target: { value: '55' } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicios' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar servicios' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicios' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(fetch.mock.calls.map(([,init]) => JSON.parse(init.body).name)).toEqual(['A','B','B'])
    expect(JSON.parse(fetch.mock.calls[1][1].body).requestKey).toBe(JSON.parse(fetch.mock.calls[2][1].body).requestKey)
  })
  it('preserves an uncertain key through a later module rejection and close/reopen', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Módulo desactivado', code: 'INVENTORY_REQUIRED' }), { status: 403 }))
      .mockResolvedValue(success())
    vi.stubGlobal('fetch', fetch)
    const props = { onOpenChange: vi.fn(), existingNames: [], currency: 'PYG', onCreated: vi.fn() }
    const view = render(<NewServiceDialog {...props} open />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Uñas' } })
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '50.000' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '55' } })
    for (let count = 1; count <= 2; count++) {
      fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(count))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Agregar servicio' })).toBeEnabled())
    }
    expect(screen.getByLabelText('Nombre')).toBeDisabled()
    view.rerender(<NewServiceDialog {...props} open={false} />)
    view.rerender(<NewServiceDialog {...props} open />)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    expect(new Set(fetch.mock.calls.map(([,init]) => JSON.parse(init.body).requestKey)).size).toBe(1)
    expect(JSON.parse(fetch.mock.calls[2][1].body).price).toBe(50000)
  })
})
