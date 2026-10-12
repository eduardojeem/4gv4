import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const planInfo = vi.fn()
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: (id: string) => planInfo(id) }))

const { ADMIN_API_MODULES, moduleAccessResponse, moduleForAdminApi } = await import('@/lib/api/api-route-modules')

const RAIZ = process.cwd()
const API = join(RAIZ, 'src/app/api')

function rutas(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name === 'route.ts') out.push(relative(API, full).split(sep).join('/'))
    }
  }
  walk(join(API, dir))
  return out
}

/** Cómo una ruta declara su módulo. */
const DECLARA_MODULO = /module: *['[]|resolveRepair(Route|Module)Context|moduleAccessResponse|requireAgenda/

/** Áreas del dashboard cuyas pantallas dependen de un módulo. */
const AREAS = ['pos', 'orders', 'credits', 'agenda', 'promotions', 'repairs', 'quotes', 'suppliers', 'categories', 'brands', 'inventory-counts', 'after-sales', 'loyalty', 'raffles', 'reports', 'customers']

/**
 * Excepciones a propósito. La verificación del QR la usa quien tiene un
 * comprobante impreso: tiene que andar aunque la tienda después apague
 * Reparaciones.
 */
const SIN_MODULO_A_PROPOSITO = new Set(['repairs/verify-qr/route.ts'])

describe('las API del dashboard declaran su módulo', () => {
  it('ninguna ruta de un área con módulo lo olvida', () => {
    const faltan = AREAS.flatMap((area) => {
      try { return rutas(area) } catch { return [] }
    }).filter((ruta) => !SIN_MODULO_A_PROPOSITO.has(ruta) && !DECLARA_MODULO.test(readFileSync(join(API, ruta), 'utf8')))
    expect(faltan).toEqual([])
  })

  it('buscar y crear clientes funciona con CRM o con POS (opción b); editar y borrar es de CRM', () => {
    const clientes = readFileSync(join(API, 'customers/route.ts'), 'utf8')
    expect(clientes).toContain("permission: 'crm.customers.read', module: ['crm', 'pos']")
    expect(clientes).toContain("permission: ['crm.customers.manage', 'pos.sales.create'], module: ['crm', 'pos']")
    expect(clientes).toContain("withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }")
  })
})

describe('las API del admin', () => {
  it('withAdminAuth aplica el módulo según la URL', () => {
    const guard = readFileSync(join(RAIZ, 'src/lib/api/withAdminAuth.ts'), 'utf8')
    expect(guard).toContain('moduleForAdminApi(request.nextUrl.pathname)')
    expect(guard).toContain('moduleAccessResponse(organizationId, requiredModule)')
  })

  it('cubre Finanzas, Monitor de caja, Seguridad y Visitas', () => {
    expect(moduleForAdminApi('/api/admin/finances/expenses/123')).toBe('finances')
    expect(moduleForAdminApi('/api/admin/cash-monitor/actions')).toBe('pos')
    expect(moduleForAdminApi('/api/admin/security/logs')).toBe('security')
    expect(moduleForAdminApi('/api/admin/analytics/website')).toBe('web_analytics')
    expect(moduleForAdminApi('/api/admin/users')).toBeNull()
  })

  it('cada prefijo corresponde a rutas que existen', () => {
    for (const prefix of Object.keys(ADMIN_API_MODULES)) {
      expect(rutas(prefix.replace('/api/', '')).length, prefix).toBeGreaterThan(0)
    }
  })
})

describe('la respuesta cuando no se puede usar el módulo', () => {
  beforeEach(() => planInfo.mockReset())
  const info = (modules: string[], entitledModules: string[]) => ({ modules, entitledModules, moduleTrials: [] })

  it('activo: sigue', async () => {
    planInfo.mockResolvedValue(info(['finances'], ['finances']))
    await expect(moduleAccessResponse('org', 'finances')).resolves.toBeNull()
  })

  it('apagado por la tienda: 403 MODULE_DISABLED', async () => {
    planInfo.mockResolvedValue(info([], ['finances']))
    const response = await moduleAccessResponse('org', 'finances')
    expect(response?.status).toBe(403)
    expect(await response?.json()).toMatchObject({ code: 'MODULE_DISABLED' })
  })

  it('fuera del plan: 402 MODULE_NOT_ENTITLED', async () => {
    planInfo.mockResolvedValue(info([], []))
    const response = await moduleAccessResponse('org', 'finances')
    expect(response?.status).toBe(402)
    expect(await response?.json()).toMatchObject({ code: 'MODULE_NOT_ENTITLED' })
  })

  it('con una lista alcanza cualquiera', async () => {
    planInfo.mockResolvedValue(info(['pos'], ['pos']))
    await expect(moduleAccessResponse('org', ['crm', 'pos'])).resolves.toBeNull()
  })
})
