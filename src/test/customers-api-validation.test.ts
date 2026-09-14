import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const escrituras = vi.hoisted(() => ({ count: 0 }))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (request: unknown) => handler(request, { organization: { id: 'org-1' }, user: { id: 'u1' } }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    escrituras.count += 1
    throw new Error('no debería llegar a la base con datos inválidos')
  },
}))

import { POST, PUT } from '@/app/api/customers/route'

const ID = '44444444-4444-4444-8444-444444444444'

const enviar = async (handler: unknown, body: unknown) => {
  const response = await (handler as (r: NextRequest) => Promise<Response>)(
    new NextRequest('http://localhost/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  )
  return { status: response.status, body: await response.json() }
}

/**
 * El formulario limitaba el crédito y el descuento, pero la API aceptaba
 * cualquier número: desde una edición masiva o una llamada directa se podía
 * guardar un límite negativo o un descuento del 500%.
 */
describe('la API de clientes valida los rangos', () => {
  it('rechaza un límite de crédito negativo', async () => {
    const { status, body } = await enviar(POST, { name: 'Ana', credit_limit: -500 })
    expect(status).toBe(400)
    expect(body.error).toBe('El límite de crédito no puede ser negativo.')
    expect(body.field).toBe('credit_limit')
  })

  it('rechaza un descuento de más del 100%, también al editar', async () => {
    const { status, body } = await enviar(PUT, { id: ID, discount_percentage: 500 })
    expect(status).toBe(400)
    expect(body.error).toBe('El descuento no puede superar el 100%.')
  })

  it('rechaza un descuento negativo', async () => {
    const { body } = await enviar(POST, { name: 'Ana', discount_percentage: -1 })
    expect(body.error).toBe('El descuento no puede ser negativo.')
  })

  /** «Error de validación» a secas no decía qué campo corregir. */
  it('explica en castellano qué falta', async () => {
    expect((await enviar(POST, { name: '   ' })).body.error).toBe('Ingresá el nombre del cliente.')
    expect((await enviar(POST, { name: 'Ana', email: 'no-es-correo' })).body.error).toBe('El correo no es válido.')
  })

  it('nada de eso llega a la base', () => {
    expect(escrituras.count).toBe(0)
  })
})
