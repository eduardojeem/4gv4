import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RECEIPT_SETTINGS } from '@/lib/repairs/receipt-settings'

/** Una tabla en memoria con lo justo que usa la ruta. */
const db = vi.hoisted(() => ({
  row: null as null | { repair_receipt_settings: unknown },
  auditFails: false,
  writes: [] as unknown[],
}))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (request: unknown) => handler(request, {
      organization: { id: 'org-1', role: 'owner' },
      user: { id: 'user-1' },
    }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      if (table === 'tenant_audit_log') {
        return { insert: async () => ({ error: db.auditFails ? { message: 'caida' } : null }) }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.row, error: null }) }) }),
        upsert: async (value: { repair_receipt_settings: unknown }) => {
          db.writes.push(value.repair_receipt_settings)
          db.row = { repair_receipt_settings: value.repair_receipt_settings }
          return { error: null }
        },
        update: (value: { repair_receipt_settings: unknown }) => ({
          eq: async () => {
            db.row = value.repair_receipt_settings === null ? null : { repair_receipt_settings: value.repair_receipt_settings }
            return { error: null }
          },
        }),
      }
    },
  }),
}))

vi.mock('@/lib/saas/permissions', () => ({ roleHasPermission: () => true }))

import { PATCH, PUT } from '@/app/api/repairs/receipt-settings/route'

const pedir = (method: 'PATCH' | 'PUT', settings: unknown) =>
  new NextRequest('http://localhost/api/repairs/receipt-settings', {
    method,
    body: JSON.stringify({ settings }),
    headers: { 'Content-Type': 'application/json' },
  })

describe('guardar la configuración del comprobante por campo', () => {
  beforeEach(() => {
    db.row = { repair_receipt_settings: { ...DEFAULT_RECEIPT_SETTINGS, paperFormat: '58mm', legalText: 'Texto propio.' } }
    db.auditFails = false
    db.writes = []
  })

  /**
   * El formulario de reparación guardaba la garantía mandando la configuración
   * entera que había leído. Si esa lectura había fallado, mandaba la de fábrica
   * y reseteaba el papel y el texto legal de toda la empresa.
   */
  it('cambia la garantía sin tocar el papel ni el texto legal', async () => {
    const response = await (PATCH as unknown as (r: NextRequest) => Promise<Response>)(
      pedir('PATCH', { defaultWarrantyMonths: 12, defaultWarrantyType: 'parts' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.defaultWarrantyMonths).toBe(12)
    expect(body.data.defaultWarrantyType).toBe('parts')
    expect(body.data.paperFormat).toBe('58mm')
    expect(body.data.legalText).toBe('Texto propio.')
  })

  it('funciona aunque la empresa todavía no haya guardado nada', async () => {
    db.row = null
    const response = await (PATCH as unknown as (r: NextRequest) => Promise<Response>)(pedir('PATCH', { paperFormat: 'A4' }))
    const body = await response.json()

    expect(body.data.paperFormat).toBe('A4')
    expect(body.data.legalText).toBe(DEFAULT_RECEIPT_SETTINGS.legalText)
  })

  it('rechaza un valor fuera de rango con un mensaje que se entiende', async () => {
    const response = await (PATCH as unknown as (r: NextRequest) => Promise<Response>)(pedir('PATCH', { defaultWarrantyMonths: 40 }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toBe('La garantía va de 0 a 36 meses.')
    expect(db.writes).toHaveLength(0)
  })

  it('rechaza un pedido vacío en vez de reescribir lo mismo', async () => {
    const response = await (PATCH as unknown as (r: NextRequest) => Promise<Response>)(pedir('PATCH', {}))
    expect(response.status).toBe(422)
    expect(db.writes).toHaveLength(0)
  })

  it('si la auditoría falla, deja lo que había', async () => {
    db.auditFails = true
    const response = await (PATCH as unknown as (r: NextRequest) => Promise<Response>)(pedir('PATCH', { paperFormat: 'A4' }))

    expect(response.status).toBe(500)
    expect((db.row?.repair_receipt_settings as { paperFormat: string }).paperFormat).toBe('58mm')
  })

  it('PUT sigue reemplazando la configuración entera', async () => {
    const response = await (PUT as unknown as (r: NextRequest) => Promise<Response>)(pedir('PUT', { paperFormat: 'A4' }))
    const body = await response.json()

    expect(body.data.paperFormat).toBe('A4')
    expect(body.data.legalText).toBe(DEFAULT_RECEIPT_SETTINGS.legalText)
  })
})
