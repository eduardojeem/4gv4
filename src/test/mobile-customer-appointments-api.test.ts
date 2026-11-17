import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../../mobile/src/lib/api', () => ({
  apiFetch: api.read,
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message)
    }
  },
}))
import { fetchMyAppointments, fetchMyAppointment } from '../../mobile/src/lib/customer-appointments'
const item = {
  id: 'own-one',
  serviceName: 'Corte',
  startsAt: '2026-11-15T15:00:00Z',
  endsAt: '2026-11-15T15:30:00Z',
  status: 'confirmed',
  professionalName: 'Juan',
  store: { name: 'Tienda', slug: 'tienda', timeZone: 'America/Asuncion', currency: 'PYG' },
}
beforeEach(() => api.read.mockReset())
it('pagina mediante la API personal sin enviar perfil, teléfono ni organización', async () => {
  api.read.mockResolvedValue({ items: [item], nextCursor: null, kind: 'past' })
  await fetchMyAppointments('past', 'date|id')
  expect(api.read).toHaveBeenCalledWith(
    '/api/marketplace/profile/appointments?kind=past&cursor=date%7Cid',
  )
})
it('rechaza una respuesta incompleta en vez de mostrar una lista vacía', async () => {
  api.read.mockResolvedValue(null)
  await expect(fetchMyAppointments('upcoming')).rejects.toThrow('respuesta')
  api.read.mockResolvedValue({ items: [], nextCursor: null, kind: 'past' })
  await expect(fetchMyAppointments('upcoming')).rejects.toThrow('respuesta')
})
it('el detalle debe corresponder al turno solicitado', async () => {
  api.read.mockResolvedValue({ appointment: { ...item, id: 'other', price: 0, managePath: null } })
  await expect(fetchMyAppointment('own-one')).rejects.toThrow('respuesta')
})
