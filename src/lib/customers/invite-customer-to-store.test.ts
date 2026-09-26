import { describe, expect, it, vi } from 'vitest'
import { canInviteCustomer, inviteCustomerToStore } from './invite-customer-to-store'

function fetchReturning(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch
}

describe('canInviteCustomer', () => {
  it('acepta un correo con forma válida', () => {
    expect(canInviteCustomer('cliente@ejemplo.com')).toBe(true)
    expect(canInviteCustomer('  cliente@ejemplo.com  ')).toBe(true)
  })

  it('no ofrece la opción sin correo', () => {
    expect(canInviteCustomer('')).toBe(false)
    expect(canInviteCustomer('   ')).toBe(false)
    expect(canInviteCustomer(null)).toBe(false)
    expect(canInviteCustomer(undefined)).toBe(false)
  })

  it('no ofrece la opción sobre algo que no es un correo', () => {
    expect(canInviteCustomer('cliente')).toBe(false)
    expect(canInviteCustomer('cliente@')).toBe(false)
    expect(canInviteCustomer('cliente@ejemplo')).toBe(false)
  })
})

describe('inviteCustomerToStore', () => {
  it('pide invitación por correo, no contraseña temporal', async () => {
    const fetchImpl = fetchReturning(200, { success: true, message: 'Se envió una invitación.' })

    await inviteCustomerToStore('cus-1', fetchImpl)

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/customers/cus-1/create-account')
    // sendInvite true = el cliente crea su propia contraseña desde el correo.
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ sendInvite: true })
  })

  it('devuelve el mensaje del servidor cuando se envía', async () => {
    const result = await inviteCustomerToStore(
      'cus-1',
      fetchReturning(200, { success: true, message: 'Se envió una invitación a a@b.com.' }),
    )

    expect(result.status).toBe('sent')
    expect(result.message).toContain('a@b.com')
  })

  it('distingue el caso de cuenta ya vinculada', async () => {
    const result = await inviteCustomerToStore(
      'cus-1',
      fetchReturning(409, { error: 'Este cliente ya tiene una cuenta vinculada' }),
    )

    expect(result.status).toBe('already-linked')
  })

  it('propaga el motivo real cuando el servidor rechaza', async () => {
    const result = await inviteCustomerToStore(
      'cus-1',
      fetchReturning(500, { error: 'No se pudo enviar la invitación: SMTP caido' }),
    )

    expect(result.status).toBe('failed')
    expect(result.message).toContain('SMTP caido')
  })

  it('no explota si el servidor responde algo que no es JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json') },
    }) as unknown as typeof fetch

    const result = await inviteCustomerToStore('cus-1', fetchImpl)
    expect(result.status).toBe('failed')
  })

  it('no explota si la red falla', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch

    const result = await inviteCustomerToStore('cus-1', fetchImpl)

    expect(result.status).toBe('failed')
    expect(result.message).toContain('servidor')
  })

  it('no llama al servidor sin id de cliente', async () => {
    const fetchImpl = fetchReturning(200, { success: true })

    const result = await inviteCustomerToStore('', fetchImpl)

    expect(result.status).toBe('failed')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
