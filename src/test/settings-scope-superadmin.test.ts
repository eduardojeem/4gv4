import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({
  usuario: { id: 'u-1', role: 'super_admin', email: 'sa@plataforma.com' } as { id: string; role: string; email: string },
  contexto: null as { id: string } | null,
  miembro: null as { organization_id?: string; role?: string } | null,
  escrituras: [] as Array<{ tabla: string; tipo: string; payload: unknown }>,
  orgSettings: null as Record<string, unknown> | null,
}))

const ORG_SETTINGS = { display_name: 'HCA Celular', currency: 'PYG', timezone: 'America/Asuncion', country_code: null as string | null, locale: null as string | null, modules: {} }

const GLOBAL = {
  id: 'system',
  company_name: 'Plataforma SaaS',
  company_email: 'soporte@plataforma.com',
  company_phone: '',
  company_ruc: '',
  company_address: '',
  city: '',
  currency: 'PYG',
  tax_rate: 10,
  theme: 'system',
  primary_color: 'blue',
  date_format: 'DD/MM/YYYY',
  time_zone: 'America/Asuncion',
  language: 'es',
  maintenance_mode: false,
  allow_registration: true,
}

function tabla(nombre: string) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) q[m] = vi.fn(() => q)

  const lectura = () => {
    if (nombre === 'system_settings') return { data: GLOBAL, error: null }
    if (nombre === 'organization_settings') {
      return { data: estado.orgSettings, error: null }
    }
    if (nombre === 'organizations') return { data: { name: 'HCA Celular', logo_url: null }, error: null }
    if (nombre === 'organization_members') return { data: estado.miembro, error: null }
    return { data: null, error: null }
  }

  q.single = vi.fn(async () => lectura())
  q.maybeSingle = vi.fn(async () => lectura())
  q.upsert = vi.fn((payload: unknown) => {
    estado.escrituras.push({ tabla: nombre, tipo: 'upsert', payload })
    const r: Record<string, unknown> = {}
    r.select = vi.fn(() => r)
    r.single = vi.fn(async () => ({ data: { ...GLOBAL, ...(payload as object) }, error: null }))
    r.then = (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok)
    return r
  })
  q.update = vi.fn((payload: unknown) => {
    estado.escrituras.push({ tabla: nombre, tipo: 'update', payload })
    return q
  })
  q.insert = vi.fn(async () => ({ error: null }))
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok)
  return q
}

// La configuración del comercio se guarda en una sola llamada atómica
// (merge_organization_admin_settings_v2): se registra como una escritura más.
function rpc(nombre: string, args: unknown) {
  estado.escrituras.push({ tabla: nombre, tipo: 'rpc', payload: args })
  return Promise.resolve({ data: null, error: null })
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: (t: string) => tabla(t), rpc }) }))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: async () => ({ user: estado.usuario }) }))
vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: async () => estado.contexto,
  resolveUserOrganizationId: async () => estado.contexto?.id ?? null,
}))
vi.mock('@/lib/api/withAdminAuth', () => ({
  withAdminAuth: (handler: (req: NextRequest, ctx: unknown) => unknown) => (req: NextRequest) =>
    handler(req, {
      user: estado.usuario,
      // Como el real: null para super_admin.
      organizationId: estado.usuario.role === 'super_admin' ? null : estado.contexto?.id ?? null,
    }),
}))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true } }))

import { GET } from '@/app/api/settings/shared/route'
import { PUT } from '@/app/api/admin/system/settings/route'

const guardar = (body: unknown) =>
  PUT(
    new NextRequest('http://localhost/api/admin/system/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  )

const escrituraEn = (t: string) => estado.escrituras.filter((e) => e.tabla === t && e.tipo === 'upsert')
type GuardadoOrganizacion = { p_organization_id: string; p_settings: Record<string, unknown>; p_admin_settings: Record<string, unknown> }
const guardadosDeOrganizacion = () => estado.escrituras
  .filter((e) => e.tabla === 'merge_organization_admin_settings_v2' && e.tipo === 'rpc')
  .map((e) => e.payload as GuardadoOrganizacion)

beforeEach(() => {
  estado.usuario = { id: 'u-1', role: 'super_admin', email: 'sa@plataforma.com' }
  estado.contexto = null
  estado.miembro = null
  estado.escrituras = []
  estado.orgSettings = { ...ORG_SETTINGS }
})

/**
 * A un superadmin la carga le devolvia siempre la fila global. Dentro de su
 * propia organizacion, la pantalla de configuracion, el POS y los tickets
 * mostraban los datos de la plataforma en vez de los de su empresa.
 */
describe('cargar: un superadmin dentro de su organización ve su organización', () => {
  it('con organización, recibe los datos de la empresa', async () => {
    estado.contexto = { id: 'org-1' }
    estado.miembro = { organization_id: 'org-1', role: 'owner' }
    const body = await (await GET()).json()
    expect(body.scope).toBe('organization')
    expect(body.data.company_name).toBe('HCA Celular')
  })

  it('expone identidad regional y marca legado sin país confirmado', async () => {
    estado.contexto = { id: 'org-1' }
    estado.miembro = { organization_id: 'org-1', role: 'owner' }
    estado.orgSettings = { ...ORG_SETTINGS, country_code: null, locale: null }
    const body = await (await GET()).json()
    expect(body.data).toMatchObject({
      country_code: null,
      locale: null,
      currency: 'PYG',
      time_zone: 'America/Asuncion',
      needs_country_confirmation: true,
    })
  })

  it('lee país e idioma regionales guardados sin inferirlos desde moneda o zona', async () => {
    estado.contexto = { id: 'org-1' }
    estado.miembro = { organization_id: 'org-1', role: 'owner' }
    estado.orgSettings = { ...ORG_SETTINGS, currency: 'BRL', timezone: 'America/Sao_Paulo', country_code: 'BR', locale: 'pt-BR' }
    const body = await (await GET()).json()
    expect(body.data).toMatchObject({ country_code: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo', needs_country_confirmation: false })
  })

  it('sin organización, recibe la global marcada como tal', async () => {
    const body = await (await GET()).json()
    expect(body.scope).toBe('platform')
    expect(body.data.company_name).toBe('Plataforma SaaS')
  })

  it('una tienda donde solo es cliente no cuenta como su organización', async () => {
    estado.contexto = { id: 'org-9' }
    estado.miembro = { organization_id: 'org-9', role: 'customer' }
    const body = await (await GET()).json()
    expect(body.scope).toBe('platform')
  })

  it('para un administrador de empresa sin organización no cambia nada', async () => {
    estado.usuario = { id: 'u-2', role: 'admin', email: 'a@hca.com.py' }
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

/**
 * El guardado escribia en `system_settings` todo lo que mandara un superadmin:
 * el nombre, el RUC y el IVA de su empresa pasaban a ser los de la plataforma.
 */
describe('guardar: el alcance decide dónde se escribe', () => {
  it('superadmin con alcance de organización escribe en su organización, no en la plataforma', async () => {
    estado.contexto = { id: 'org-1' }
    estado.miembro = { organization_id: 'org-1', role: 'owner' }
    const res = await guardar({ settings: { companyRuc: '80012345-6' }, scope: 'organization' })

    expect(res.status).toBe(200)
    expect(guardadosDeOrganizacion()).toHaveLength(1)
    expect(guardadosDeOrganizacion()[0].p_organization_id).toBe('org-1')
    expect(escrituraEn('system_settings')).toHaveLength(0)
  })

  it('sin organización lo rechaza en vez de escribir en la plataforma', async () => {
    const res = await guardar({ settings: { companyRuc: '80012345-6' }, scope: 'organization' })
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('NO_ORGANIZATION')
    expect(estado.escrituras).toHaveLength(0)
  })

  it('la configuración global, que no manda alcance, sigue escribiendo en la plataforma', async () => {
    // /superadmin/settings usa este mismo endpoint sin `scope`.
    const res = await guardar({ settings: { maintenanceMode: true } })
    expect(res.status).toBe(200)
    expect(escrituraEn('system_settings')).toHaveLength(1)
    expect(guardadosDeOrganizacion()).toHaveLength(0)
  })
})

/**
 * La web y la app guardan solo lo que cambió. Al armar lo que se escribe, el
 * servidor partía de la fila GLOBAL: guardar el RUC de un comercio le ponía el
 * nombre, la moneda, la zona horaria y la política de reparaciones de la
 * plataforma. Lo propio del comercio tiene que ganar, como al cargar.
 */
describe('guardar un campo no pisa lo demás del comercio con la fila global', () => {
  beforeEach(() => {
    estado.usuario = { id: 'u-2', role: 'admin', email: 'admin@hca.com' }
    estado.contexto = { id: 'org-1' }
    estado.orgSettings = {
      display_name: 'HCA Celular', currency: 'USD', timezone: 'America/Sao_Paulo', modules: {},
      repair_max_discount_percent: 35, repair_labor_tax_rate: 5,
    }
  })

  it('guardar solo el RUC conserva nombre, moneda, zona y reparaciones del comercio', async () => {
    const res = await guardar({ settings: { companyRuc: '80012345-6' }, scope: 'organization' })
    expect(res.status).toBe(200)
    const [escritura] = guardadosDeOrganizacion()
    expect(escritura.p_settings).toMatchObject({
      display_name: 'HCA Celular',
      currency: 'USD',
      timezone: 'America/Sao_Paulo',
      repair_max_discount_percent: 35,
      repair_labor_tax_rate: 5,
    })
    // Solo lo que cambió viaja como admin_settings; la función lo fusiona con lo guardado.
    expect(escritura.p_admin_settings).toEqual({ companyRuc: '80012345-6' })
  })

  it('lo que sí se cambia se escribe', async () => {
    const res = await guardar({ settings: { companyName: 'HCA Celulares', timeZone: 'America/Asuncion' }, scope: 'organization' })
    expect(res.status).toBe(200)
    expect(guardadosDeOrganizacion()[0].p_settings).toMatchObject({ display_name: 'HCA Celulares', timezone: 'America/Asuncion', currency: 'USD' })
  })

  it('normaliza país y locale en el límite de escritura organizacional', async () => {
    const res = await guardar({ settings: { countryCode: ' py ', locale: 'es-py' }, scope: 'organization' })
    expect(res.status).toBe(200)
    expect(guardadosDeOrganizacion()[0].p_settings).toMatchObject({ country_code: 'PY', locale: 'es-PY' })
  })

  it('rechaza país malformado antes de escribir', async () => {
    const res = await guardar({ settings: { countryCode: 'P1' }, scope: 'organization' })
    expect(res.status).toBe(400)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('rechaza locale inválido antes de escribir', async () => {
    const res = await guardar({ settings: { locale: 'not a locale' }, scope: 'organization' })
    expect(res.status).toBe(400)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('preserva country_code y locale existentes al guardar otros ajustes', async () => {
    estado.orgSettings = { ...ORG_SETTINGS, country_code: 'BR', locale: 'pt-BR' }
    const res = await guardar({ settings: { companyRuc: '80012345-6' }, scope: 'organization' })
    expect(res.status).toBe(200)
    expect(guardadosDeOrganizacion()[0].p_settings).toMatchObject({ country_code: 'BR', locale: 'pt-BR' })
  })

  it('no permite guardar identidad regional en los ajustes globales de plataforma', async () => {
    estado.usuario = { id: 'u-1', role: 'super_admin', email: 'sa@plataforma.com' }
    estado.contexto = null
    const res = await guardar({ settings: { countryCode: 'PY' } })
    expect(res.status).toBe(400)
    expect(estado.escrituras).toHaveLength(0)
  })

  it('la respuesta devuelve los datos del comercio, no los de la plataforma', async () => {
    const res = await guardar({ settings: { companyRuc: '80012345-6' }, scope: 'organization' })
    const body = await res.json()
    expect(body.data).toMatchObject({ company_name: 'HCA Celular', currency: 'USD', time_zone: 'America/Sao_Paulo', company_ruc: '80012345-6' })
  })
})

describe('la pantalla y el hook', () => {
  const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

  it('el hook guarda siempre con alcance de organización y expone de dónde cargó', () => {
    const hook = leer('src/hooks/use-shared-settings.ts')
    expect(hook).toContain("scope: 'organization',")
    expect(hook).toContain("setScope(result.scope === 'platform' ? 'platform' : 'organization')")
  })

  it('la pantalla de la organización ya no expulsa a los superadmins', () => {
    const page = leer('src/app/admin/settings/page.tsx')
    expect(page).not.toContain("router.replace('/superadmin/settings')")
    expect(page).not.toContain('isSuperAdmin')
    expect(page).toContain('No estás dentro de ninguna organización')
  })

  it('el menú dice qué se configura ahí', () => {
    const layout = leer('src/components/admin/layout/AdminLayout.tsx')
    expect(layout).not.toContain('Ajustes del sistema')
    expect(layout).toContain('Datos de la empresa, impuestos y moneda')
  })
})
