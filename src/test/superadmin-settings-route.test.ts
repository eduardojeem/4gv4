import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PUT /api/superadmin/settings: la escritura de la configuración GLOBAL.
 * Lista blanca, verificación en dos pasos, revisión (409), confirmación del
 * IVA y CHECK de Postgres (23514 → 400).
 */

const REVISION = '2026-11-01T10:00:00+00:00'

const estado = vi.hoisted(() => ({
  superadmin: { id: 'sa-1', email: 'sa@plataforma.com', role: 'super_admin' } as { id: string; email: string; role: 'super_admin' } | null,
  token: null as string | null,
  factores: [] as Array<{ status: string }>,
  fila: null as Record<string, unknown> | null,
  /** Filas que devuelve el update (vacío = la revisión no coincidió). */
  filasActualizadas: null as Array<Record<string, unknown>> | null,
  errorEscritura: null as { code?: string; message?: string } | null,
  escrituras: [] as Array<{ tipo: string; payload: unknown; filtros: Array<[string, string, unknown]> }>,
  auditoria: [] as unknown[],
}))

function tokenConAal(aal: string) {
  const payload = Buffer.from(JSON.stringify({ aal })).toString('base64url')
  return `x.${payload}.y`
}

function tablaSystemSettings() {
  const filtros: Array<[string, string, unknown]> = []
  let escritura: { tipo: string; payload: unknown } | null = null
  const q: Record<string, unknown> = {}
  q.select = vi.fn(() => q)
  q.eq = vi.fn((col: string, val: unknown) => { filtros.push(['eq', col, val]); return q })
  q.is = vi.fn((col: string, val: unknown) => { filtros.push(['is', col, val]); return q })
  q.maybeSingle = vi.fn(async () => ({ data: estado.fila, error: null }))
  q.update = vi.fn((payload: unknown) => { escritura = { tipo: 'update', payload }; return q })
  q.insert = vi.fn((payload: unknown) => { escritura = { tipo: 'insert', payload }; return q })
  q.then = (ok: (v: unknown) => unknown) => {
    if (escritura) estado.escrituras.push({ ...escritura, filtros: [...filtros] })
    if (estado.errorEscritura) return Promise.resolve({ data: null, error: estado.errorEscritura }).then(ok)
    const payload = (escritura?.payload ?? {}) as Record<string, unknown>
    const filas = estado.filasActualizadas ?? [{ ...(estado.fila ?? {}), ...payload, updated_at: '2026-11-09T12:00:00+00:00' }]
    return Promise.resolve({ data: filas, error: null }).then(ok)
  }
  return q
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: () => tablaSystemSettings() }) }))
vi.mock('@/lib/supabase/server', () => ({
  getRequestBearerToken: async () => null,
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: estado.token ? { access_token: estado.token } : null } }),
      getUser: async () => ({ data: { user: { id: 'sa-1', factors: estado.factores } } }),
    },
  }),
}))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: async () => estado.superadmin }))
vi.mock('@/lib/superadmin/audit', () => ({ logSuperAdminAction: async (entry: unknown) => { estado.auditoria.push(entry) } }))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true } }))

import { PUT } from '@/app/api/superadmin/settings/route'

const guardar = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/superadmin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }))

beforeEach(() => {
  estado.superadmin = { id: 'sa-1', email: 'sa@plataforma.com', role: 'super_admin' }
  estado.token = tokenConAal('aal2')
  estado.factores = [{ status: 'verified' }]
  estado.fila = {
    company_name: 'MiTiendaPy', company_ruc: '', company_email: '', company_phone: '', company_address: '',
    currency: 'PYG', tax_rate: 10, time_zone: 'America/Asuncion', updated_at: REVISION, updated_by: 'sa-0',
  }
  estado.filasActualizadas = null
  estado.errorEscritura = null
  estado.escrituras = []
  estado.auditoria = []
})

describe('acceso', () => {
  it('sin superadmin, 403 y no escribe', async () => {
    estado.superadmin = null
    const res = await guardar({ settings: { companyRuc: '1' }, revision: REVISION })
    expect(res.status).toBe(403)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('exige sesión verificada en dos pasos (aal2)', async () => {
    estado.token = tokenConAal('aal1')
    const res = await guardar({ settings: { companyRuc: '1' }, revision: REVISION })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('MFA_REQUIRED')
    expect(body.mfaPath).toBe('/auth/mfa?redirect=%2Fsuperadmin%2Fsettings')
    expect(estado.escrituras).toHaveLength(0)
  })

  it('sin 2FA activada lo manda a activarla', async () => {
    estado.token = tokenConAal('aal1')
    estado.factores = []
    const body = await (await guardar({ settings: { companyRuc: '1' }, revision: REVISION })).json()
    expect(body.mfaPath).toContain('setup=1')
  })
})

describe('lista blanca', () => {
  it.each([
    [{ features: {} }],
    [{ socialLinks: {} }],
    [{ maintenanceMode: true }],
    [{ companyRuc: '1', requireTwoFactor: true }],
  ])('rechaza %j sin escribir', async (settings) => {
    const res = await guardar({ settings, revision: REVISION })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Esta pantalla no puede cambiar/)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('rechaza campos de más en el cuerpo (p. ej. `scope`)', async () => {
    const res = await guardar({ settings: { companyRuc: '1' }, revision: REVISION, scope: 'organization' })
    expect(res.status).toBe(400)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('escribe solo las columnas de la lista, recortadas, con autor y revisión', async () => {
    const res = await guardar({ settings: { companyRuc: ' 80012345-6 ', companyAddress: ' Centro ' }, revision: REVISION })
    expect(res.status).toBe(200)
    const [escritura] = estado.escrituras
    expect(escritura.tipo).toBe('update')
    const payload = escritura.payload as Record<string, unknown>
    expect(payload).toMatchObject({ company_ruc: '80012345-6', company_address: 'Centro', updated_by: 'sa-1' })
    expect(Object.keys(payload).sort()).toEqual(['company_address', 'company_ruc', 'updated_at', 'updated_by'])
    expect(escritura.filtros).toContainEqual(['eq', 'updated_at', REVISION])
    const body = await res.json()
    expect(body.data.updatedAt).toBe('2026-11-09T12:00:00+00:00')
    expect(body.data.defaults.companyRuc).toBe('80012345-6')
    expect(estado.auditoria).toHaveLength(1)
  })
})

describe('revisión', () => {
  it('si la fila cambió desde que se cargó la pantalla, 409 sin escribir', async () => {
    const res = await guardar({ settings: { companyRuc: '1' }, revision: '2026-10-01T00:00:00+00:00' })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('SETTINGS_REVISION_CONFLICT')
    expect(body.error).toMatch(/Otra persona cambió la configuración/)
    expect(body.error).toMatch(/recargá/)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('si otro guardó entre la lectura y la escritura (0 filas), 409', async () => {
    estado.filasActualizadas = []
    const res = await guardar({ settings: { companyRuc: '1' }, revision: REVISION })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('SETTINGS_REVISION_CONFLICT')
    expect(estado.auditoria).toHaveLength(0)
  })

  it('exige la revisión en el cuerpo', async () => {
    const res = await guardar({ settings: { companyRuc: '1' } })
    expect(res.status).toBe(400)
  })
})

describe('confirmación del IVA global', () => {
  it('sin confirmTaxRateChange, 409 con código propio y no escribe', async () => {
    const res = await guardar({ settings: { taxRate: 5 }, revision: REVISION })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('TAX_RATE_CHANGE_CONFIRMATION_REQUIRED')
    expect(estado.escrituras).toHaveLength(0)
  })

  it('con confirmación, guarda', async () => {
    const res = await guardar({ settings: { taxRate: 5 }, revision: REVISION, confirmTaxRateChange: true })
    expect(res.status).toBe(200)
    expect(estado.escrituras[0].payload).toMatchObject({ tax_rate: 5 })
  })

  it('mandar el mismo IVA no pide confirmación', async () => {
    const res = await guardar({ settings: { taxRate: 10 }, revision: REVISION })
    expect(res.status).toBe(200)
  })
})

describe('CHECK de Postgres', () => {
  it('23514 de moneda → 400 diciendo qué campo falló', async () => {
    estado.errorEscritura = {
      code: '23514',
      message: 'new row for relation "system_settings" violates check constraint "system_settings_currency_check"',
    }
    const res = await guardar({ settings: { currency: 'BRL' }, revision: REVISION })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/^Moneda:/)
  })

  it('23514 de email → 400 con el campo', async () => {
    estado.errorEscritura = {
      code: '23514',
      message: 'new row for relation "system_settings" violates check constraint "system_settings_company_email_check"',
    }
    const res = await guardar({ settings: { companyEmail: '' }, revision: REVISION })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/^Email:/)
  })

  it('otros errores siguen siendo 500', async () => {
    estado.errorEscritura = { code: '42501', message: 'permission denied' }
    const res = await guardar({ settings: { companyRuc: '1' }, revision: REVISION })
    expect(res.status).toBe(500)
  })
})
