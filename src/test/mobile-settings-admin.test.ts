import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }))
vi.mock('../../mobile/src/lib/supabase', () => ({ supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } } }))
vi.mock('../../mobile/src/lib/marketplace', () => ({ SITE_URL: 'https://tienda.test' }))
vi.mock('../../mobile/node_modules/react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('../../mobile/node_modules/expo-file-system', () => ({ File: class {} }))

import { ApiError } from '../../mobile/src/lib/api'
import { setPrivateCacheOrganization, setPrivateCacheUser } from '../../mobile/src/lib/private-cache-context'
import {
  deleteExchangeRate,
  fetchExchangeRates,
  fetchOrgSettings,
  needsCurrencyConfirmation,
  saveExchangeRate,
  saveOrgSettings,
  settingsErrorMessage,
} from '../../mobile/src/lib/settings-admin'
import {
  addableCurrencies,
  changedSettings,
  describeRate,
  formatNumber,
  fromSharedRow,
  parseDecimal,
  rateIssue,
  settingsIssues,
  toBusinessProfile,
  type OrgSettings,
} from '../../mobile/src/lib/settings-model'

const row = {
  company_name: 'Mi Tienda', company_ruc: '80000000-1', company_email: 'hola@tienda.test', company_phone: '0981123456',
  company_address: 'Calle 1', city: 'Asunción', currency: 'PYG', tax_rate: '10.00', time_zone: 'America/Asuncion', language: 'es',
  maintenance_mode: false, company_logo: null,
}
const saved: OrgSettings = fromSharedRow(row)

describe('lectura: la fila del servidor se lleva a los nombres que acepta el guardado', () => {
  it('mapea nombres de base de datos y convierte el IVA a número', () => {
    expect(saved).toEqual({
      companyName: 'Mi Tienda', companyRuc: '80000000-1', companyEmail: 'hola@tienda.test', companyPhone: '0981123456',
      companyAddress: 'Calle 1', city: 'Asunción', currency: 'PYG', taxRate: 10, timeZone: 'America/Asuncion', language: 'es',
      countryCode: null, locale: null, needsCountryConfirmation: true,
    })
  })

  it('con datos faltantes o desconocidos usa los mismos valores por defecto que la web', () => {
    const empty = fromSharedRow({ currency: 'XXX', language: 'fr', tax_rate: 'abc' })
    expect(empty).toMatchObject({ companyName: '', currency: 'PYG', language: 'es', taxRate: 10, timeZone: 'America/Asuncion' })
    expect(fromSharedRow(null).companyRuc).toBe('')
    expect(fromSharedRow({ country_code: null, locale: null, currency: 'BRL', time_zone: 'America/Sao_Paulo' })).toMatchObject({
      countryCode: null,
      locale: null,
      needsCountryConfirmation: true,
      currency: 'BRL',
      timeZone: 'America/Sao_Paulo',
    })
  })

  it('mapea identidad regional confirmada sin inferirla de la moneda o zona', () => {
    expect(fromSharedRow({ country_code: 'BR', locale: 'pt-BR', currency: 'BRL', time_zone: 'America/Sao_Paulo' })).toMatchObject({
      countryCode: 'BR',
      locale: 'pt-BR',
      needsCountryConfirmation: false,
    })
  })

  it('no trae campos de la plataforma ni de seguridad', () => {
    expect(Object.keys(saved)).not.toContain('maintenanceMode')
    expect(JSON.stringify(saved)).not.toMatch(/maintenance|password|two_factor/i)
  })
})

describe('guardado parcial: solo viaja lo que cambió', () => {
  it('sin cambios no hay nada para guardar', () => {
    expect(changedSettings(saved, { ...saved })).toEqual({})
  })

  it('un campo tocado viaja solo, recortado; los demás no pisan nada', () => {
    expect(changedSettings(saved, { ...saved, companyPhone: '  0991 000 000 ' })).toEqual({ companyPhone: '0991 000 000' })
  })

  it('espacios de más no cuentan como cambio', () => {
    expect(changedSettings(saved, { ...saved, companyName: ' Mi Tienda ' })).toEqual({})
  })

  it('vaciar un campo opcional sí es un cambio (se guarda vacío, no se ignora)', () => {
    expect(changedSettings(saved, { ...saved, companyRuc: '' })).toEqual({ companyRuc: '' })
  })

  it('números y moneda se comparan por valor', () => {
    expect(changedSettings(saved, { ...saved, taxRate: 5, currency: 'USD' })).toEqual({ taxRate: 5, currency: 'USD' })
  })
})

describe('validación: las mismas reglas que el servidor, con mensajes claros', () => {
  it('el nombre es obligatorio y tiene tope', () => {
    expect(settingsIssues({ ...saved, companyName: '  ' }).companyName).toMatch(/obligatorio/)
    expect(settingsIssues({ ...saved, companyName: 'x'.repeat(101) }).companyName).toMatch(/100/)
  })

  it('el email es opcional pero, si está, tiene que ser válido', () => {
    expect(settingsIssues({ ...saved, companyEmail: '' }).companyEmail).toBeUndefined()
    expect(settingsIssues({ ...saved, companyEmail: 'hola@' }).companyEmail).toBeDefined()
  })

  it('el IVA vacío no es 0: se marca como error', () => {
    expect(settingsIssues({ ...saved, taxRate: Number.NaN }).taxRate).toBeDefined()
    expect(settingsIssues({ ...saved, taxRate: 120 }).taxRate).toMatch(/0 y 100/)
    expect(settingsIssues({ ...saved, taxRate: 0 }).taxRate).toBeUndefined()
  })

  it('la zona horaria tiene que ser una de la lista', () => {
    expect(settingsIssues({ ...saved, timeZone: 'Marte/Base' }).timeZone).toBeDefined()
    expect(settingsIssues(saved)).toEqual({})
  })
})

describe('números como se escriben en Paraguay', () => {
  it.each([
    ['7.300', 7300], ['7.300,50', 7300.5], ['7,5', 7.5], ['1.25', 1.25], ['10', 10], ['1.000.000', 1_000_000], [' 5 ', 5],
  ])('«%s» es %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })

  it.each(['', 'abc', '1.2.3', '7,3,0'])('«%s» no es un número', (input) => {
    expect(parseDecimal(input)).toBeNaN()
  })

  it('formatea con miles «.» y decimales «,»', () => {
    expect(formatNumber(7300)).toBe('7.300')
    expect(formatNumber(7300.5, 2)).toBe('7.300,5')
    expect(formatNumber(10, 2)).toBe('10')
  })
})

describe('tipos de cambio', () => {
  it('muestra el tipo de cambio en la moneda local', () => {
    expect(describeRate({ currency: 'USD', rate: 7300 }, 'PYG')).toBe('1 USD = ₲ 7.300')
  })

  it('no ofrece la moneda local ni las ya cargadas', () => {
    const options = addableCurrencies({ localCurrency: 'PYG', rates: [{ currency: 'USD', rate: 7300, rounding: 1 }] })
    expect(options).not.toContain('PYG')
    expect(options).not.toContain('USD')
    expect(options).toContain('BRL')
  })

  it('rechaza valores vacíos, cero o negativos', () => {
    expect(rateIssue(Number.NaN)).toBeTruthy()
    expect(rateIssue(0)).toMatch(/mayor a cero/)
    expect(rateIssue(7300)).toBeNull()
  })
})

describe('perfil del negocio (solo lectura)', () => {
  it('toma rubro, forma de trabajo y herramientas, descartando basura', () => {
    expect(toBusinessProfile({ businessVertical: 'hardware', operatingModel: 'mixed', effectiveModules: ['pos', 3, null, 'crm'] }))
      .toEqual({ businessVertical: 'hardware', operatingModel: 'mixed', effectiveModules: ['pos', 'crm'] })
    expect(toBusinessProfile(null)).toEqual({ businessVertical: 'general', operatingModel: 'retail', effectiveModules: [] })
  })
})

describe('APIs de la app: las mismas rutas que la web, comercio resuelto por el servidor', () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let reply: (url: string, init: RequestInit) => Response
  beforeEach(() => {
    calls.length = 0
    setPrivateCacheUser(null); setPrivateCacheUser('user-1'); setPrivateCacheOrganization('org-1')
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } } })
    reply = (url, init) => {
      if (url.includes('/api/settings/shared')) return new Response(JSON.stringify({ success: true, scope: 'organization', data: row }))
      if (url.includes('/api/exchange-rates') && !init.method) {
        return new Response(JSON.stringify({ available: true, canEdit: true, localCurrency: 'PYG', rates: [{ currency: 'USD', rate: '7300', rounding: '100' }], history: [], usage: { USD: 4 } }))
      }
      if (url.includes('/api/exchange-rates')) return new Response(JSON.stringify({ ok: true, result: { products_updated: 4 } }))
      return new Response(JSON.stringify({ success: true, data: { ...row, company_phone: '0991000000' } }))
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return reply(url, init)
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  const headers = (init: RequestInit) => init.headers as Record<string, string>

  it('lee de /api/settings/shared con la sesión y el comercio activo', async () => {
    expect(await fetchOrgSettings()).toEqual(saved)
    expect(calls[0].url).toMatch(/\/api\/settings\/shared$/)
    expect(headers(calls[0].init).Authorization).toBe('Bearer token-1')
    expect(headers(calls[0].init)['x-organization-id']).toBe('org-1')
  })

  it('sin comercio activo no muestra la configuración de la plataforma para editar', async () => {
    reply = () => new Response(JSON.stringify({ success: true, scope: 'platform', data: row }))
    await expect(fetchOrgSettings()).rejects.toMatchObject({ status: 403 })
  })

  it('guarda solo lo cambiado, dentro de «settings» y con alcance del comercio, como la web', async () => {
    const result = await saveOrgSettings({ companyPhone: '0991000000' })
    expect(calls[0].url).toMatch(/\/api\/admin\/system\/settings$/)
    expect(calls[0].init.method).toBe('PUT')
    const body = JSON.parse(String(calls[0].init.body))
    expect(body).toEqual({ settings: { companyPhone: '0991000000' }, scope: 'organization', confirmCurrencyChange: false })
    expect(JSON.stringify(body)).not.toMatch(/organization_id|organizationId/)
    expect(result?.companyPhone).toBe('0991000000')
  })

  it('no hace pedidos cuando no hay nada que guardar', async () => {
    expect(await saveOrgSettings({})).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('el cambio de moneda viaja con la confirmación explícita', async () => {
    await saveOrgSettings({ currency: 'USD' }, true)
    expect(JSON.parse(String(calls[0].init.body)).confirmCurrencyChange).toBe(true)
  })

  it('reconoce el pedido de confirmación de moneda del servidor', async () => {
    reply = () => new Response(JSON.stringify({ success: false, code: 'CURRENCY_CHANGE_CONFIRMATION_REQUIRED', error: 'Confirma…' }), { status: 409 })
    const error = await saveOrgSettings({ currency: 'USD' }).catch((cause) => cause)
    expect(needsCurrencyConfirmation(error)).toBe(true)
    expect(needsCurrencyConfirmation(new ApiError('otra cosa', 409))).toBe(false)
  })

  it('tipos de cambio: normaliza números y manda moneda, valor y redondeo', async () => {
    const state = await fetchExchangeRates()
    expect(state.rates[0]).toEqual({ currency: 'USD', rate: 7300, rounding: 100 })
    expect(state.usage.USD).toBe(4)
    expect(await saveExchangeRate('USD', 7350, 100)).toEqual({ productsUpdated: 4 })
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ currency: 'USD', rate: 7350, rounding: 100 })
    await deleteExchangeRate('USD')
    expect(calls[2].url).toMatch(/\/api\/exchange-rates\?currency=USD$/)
    expect(calls[2].init.method).toBe('DELETE')
  })

  it('errores en palabras de la persona', () => {
    expect(settingsErrorMessage(new ApiError('Forbidden', 403), 'x')).toMatch(/dueño o un administrador/)
    expect(settingsErrorMessage(new ApiError('x', 0), 'x')).toMatch(/Sin conexión/)
    expect(settingsErrorMessage(new ApiError('boom', 500), 'x')).toMatch(/servidor/)
  })
})

describe('pantallas: sin service_role, sin organization_id y sin abrir la web para lo que ya está en la app', () => {
  const mobile = join(__dirname, '../../mobile/src')
  const read = (file: string) => readFileSync(join(mobile, file), 'utf8')
  const screens = ['index', 'company', 'regional', 'exchange-rates', 'profile'].map((name) => read(`app/admin/settings/${name}.tsx`))

  it('no usan service_role ni mandan el comercio en el cuerpo', () => {
    for (const source of [...screens, read('lib/settings-admin.ts'), read('lib/settings-context.tsx')]) {
      expect(source).not.toMatch(/service_role|SERVICE_ROLE|organization_id/)
    }
  })

  it('el menú de perfil abre la Configuración de la app, no la web', () => {
    const menu = read('components/panel-menus.tsx')
    expect(menu).not.toMatch(/web\('\/admin\/settings'\)/)
    expect(menu).toMatch(/router\.push\('\/admin\/settings'\)/)
  })

  it('ya no existen los interruptores que no correspondían a nada en el servidor', () => {
    for (const source of screens) expect(source).not.toMatch(/allowNegativeStock|autoPrintInvoice|inventoryAlerts|legalName/)
  })

  it('el guardado del servidor sigue exigiendo dueño o administrador y descarta la política de plataforma', () => {
    const route = readFileSync(join(__dirname, '../app/api/admin/system/settings/route.ts'), 'utf8')
    expect(route).toMatch(/export const PUT = withAdminAuth\(handler\)/)
    expect(route).toMatch(/PLATFORM_ONLY_KEYS/)
  })
})
