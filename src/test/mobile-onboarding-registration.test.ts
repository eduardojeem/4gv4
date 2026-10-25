import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MOBILE_APP_SCHEME, appReturnWithResult, safeAppReturnUrl } from '@/lib/mobile-app-return'
import { loadOnboardingProgress, onboardingStepProgress, type OnboardingProgressInput } from '@/lib/onboarding/progress'
import {
  buildOnboardingSteps,
  doneCount,
  hiddenKey,
  nextStep,
  shouldShowFirstSteps,
  toOnboardingProgress,
  type OnboardingProgress,
} from '../../mobile/src/lib/onboarding-model'
import { parseRegistrationReturn, registerCtaLabel, registrationNotice, registrationUrl } from '../../mobile/src/lib/registration-model'

const root = join(__dirname, '../..')
const read = (file: string) => readFileSync(join(root, file), 'utf8')

describe('vuelta a la app: solo a la dirección de la app', () => {
  it('el esquema de la web es el de mobile/app.json', () => {
    expect(JSON.parse(read('mobile/app.json')).expo.scheme).toBe(MOBILE_APP_SCHEME)
  })

  it('acepta la dirección de la app', () => {
    expect(safeAppReturnUrl('mitiendapy://sign-in', 'production')).toBe('mitiendapy://sign-in')
  })

  it('Expo Go vale en desarrollo, nunca en producción', () => {
    expect(safeAppReturnUrl('exp://192.168.0.5:8083/--/sign-in', 'development')).toBe('exp://192.168.0.5:8083/--/sign-in')
    expect(safeAppReturnUrl('exp://192.168.0.5:8083/--/sign-in', 'production')).toBeNull()
  })

  it.each([
    'https://otro-sitio.com/robar', 'http://localhost:3000', 'javascript:alert(1)', '//otro-sitio.com', 'data:text/html,hola',
    'mitiendapyx://sign-in', '', null, `mitiendapy://${'a'.repeat(400)}`,
  ])('ignora «%s»', (value) => {
    expect(safeAppReturnUrl(value as string | null, 'development')).toBeNull()
  })

  it('vuelve con el resultado del registro', () => {
    expect(appReturnWithResult('mitiendapy://sign-in', { requiresEmailConfirmation: true })).toBe('mitiendapy://sign-in?registered=1&confirmar=1')
    expect(appReturnWithResult('exp://h:1/--/sign-in?x=1', { requiresEmailConfirmation: false })).toBe('exp://h:1/--/sign-in?x=1&registered=1')
  })

  it('la página de registro valida la dirección antes de usarla', () => {
    const page = read('src/app/register/page.tsx')
    expect(page).toMatch(/safeAppReturnUrl\(searchParams\.get\('app_return'\)\)/)
    expect(page).not.toMatch(/window\.location\.(assign|href)\s*\(?\s*=?\s*searchParams/)
  })
})

describe('la app abre el registro con su dirección de vuelta', () => {
  it('arma /register con app_return y conserva el plan', () => {
    const url = new URL(registrationUrl('https://tienda.test', '/register?plan=pro', 'mitiendapy://sign-in'))
    expect(url.origin).toBe('https://tienda.test')
    expect(url.pathname).toBe('/register')
    expect(url.searchParams.get('plan')).toBe('pro')
    expect(url.searchParams.get('app_return')).toBe('mitiendapy://sign-in')
  })

  it('nunca abre otra página que no sea el registro', () => {
    expect(new URL(registrationUrl('https://tienda.test', '/otra?x=1', 'mitiendapy://sign-in')).pathname).toBe('/register')
  })

  it('lee el resultado y arma el aviso del ingreso', () => {
    expect(parseRegistrationReturn({ registered: '1', confirmar: '1' })).toEqual({ registered: true, confirmEmail: true })
    expect(registrationNotice({ registered: true, confirmEmail: true })).toMatch(/Confirmá tu email/)
    expect(registrationNotice({ registered: true, confirmEmail: false })).toMatch(/Ingresá con tu email/)
    expect(registrationNotice(parseRegistrationReturn({}))).toBeNull()
  })

  it('ninguna entrada de la app abre el registro de la forma vieja', () => {
    expect(read('mobile/src/app/index.tsx')).not.toMatch(/openWeb\('\/register'\)/)
    expect(read('mobile/src/lib/saas.tsx')).toMatch(/openRegistration\(href\)/)
  })
})

const input = (overrides: Partial<OnboardingProgressInput> = {}): OnboardingProgressInput => ({
  displayName: 'Mi Tienda', organizationName: 'Mi Tienda', modules: {}, branch: null, companyInfo: null,
  storefrontPublic: false, productsCount: 0, membersCount: 1, agendaProfessionals: 0, hasAgendaSettings: false, ...overrides,
})

describe('primeros pasos: el mismo cálculo en la web y en la app', () => {
  it('un comercio recién registrado no tiene ningún paso listo', () => {
    expect(onboardingStepProgress(input())).toEqual({ hasCompanyInfo: false, hasProducts: false, hasPublicStore: false, hasTeam: false, hasAgenda: false })
  })

  it('los datos del negocio piden teléfono, dirección y ciudad (de la configuración o de la sucursal)', () => {
    expect(onboardingStepProgress(input({ modules: { admin_settings: { companyPhone: '0981', companyAddress: 'Calle 1', city: 'Luque' } } })).hasCompanyInfo).toBe(true)
    expect(onboardingStepProgress(input({ branch: { phone: '0981', address: 'Calle 1', city: 'Luque' } })).hasCompanyInfo).toBe(true)
    expect(onboardingStepProgress(input({ branch: { phone: '0981', address: 'Calle 1' } })).hasCompanyInfo).toBe(false)
  })

  it('cada paso se marca con lo que hizo el comercio', () => {
    const steps = onboardingStepProgress(input({ productsCount: 3, membersCount: 2, storefrontPublic: true, hasAgendaSettings: true }))
    expect(steps).toMatchObject({ hasProducts: true, hasTeam: true, hasPublicStore: true, hasAgenda: true })
  })

  it('la página de onboarding de la web usa este cálculo', () => {
    expect(read('src/app/admin/onboarding/page.tsx')).toMatch(/stepProgress=\{stepProgress\}/)
    expect(read('src/app/admin/onboarding/page.tsx')).toMatch(/onboardingStepProgress\(/)
  })

  it('la API de la app exige configurar el comercio y no recibe el comercio del pedido', () => {
    const route = read('src/app/api/mobile/onboarding/route.ts')
    expect(route).toMatch(/withTenantAuth\(\{ permission: 'settings\.manage' \}/)
    expect(route).toMatch(/organization\.id/)
    expect(route).not.toMatch(/searchParams|request\.json/)
  })

  it('arma el progreso desde la base, filtrando por el comercio', async () => {
    const filters: string[] = []
    const table = (name: string) => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (column: string, value: unknown) => { filters.push(`${name}.${column}=${value}`); return q }
      const rows: Record<string, unknown> = {
        organization_settings: { display_name: 'Mi Tienda', modules: { onboarding: { completed_at: null }, admin_settings: { companyPhone: '1', companyAddress: 'a', city: 'c' } } },
        organizations: { name: 'Mi Tienda', slug: 'mi-tienda', business_vertical: 'barbershop', operating_model: 'service', storefront_public: true },
      }
      q.maybeSingle = async () => ({ data: rows[name] ?? null, error: null })
      q.then = (ok: (value: unknown) => unknown) => Promise.resolve({ count: name === 'products' ? 2 : name === 'organization_members' ? 1 : 0, error: null }).then(ok)
      return q
    }
    const progress = await loadOnboardingProgress({ from: table } as never, 'org-1')
    expect(progress.steps).toEqual({ hasCompanyInfo: true, hasProducts: true, hasPublicStore: true, hasTeam: false, hasAgenda: false })
    expect(progress.serviceFocused).toBe(true)
    expect(progress.slug).toBe('mi-tienda')
    for (const filter of filters.filter((item) => item.includes('organization_id') || item.startsWith('organizations.id'))) expect(filter).toMatch(/=org-1$/)
  })
})

const progress = (overrides: Partial<OnboardingProgress> = {}): OnboardingProgress => ({
  steps: { hasCompanyInfo: false, hasProducts: false, hasAgenda: false, hasPublicStore: false, hasTeam: false },
  completedAt: null, servicesEnabled: true, serviceFocused: false, slug: 'mi-tienda', ...overrides,
})

describe('primeros pasos en la app', () => {
  it('son los 5 pasos de la web, en el mismo orden', () => {
    expect(buildOnboardingSteps(progress()).map((step) => step.title)).toEqual(['Datos del negocio', 'Productos y catálogo', 'Agenda y reservas', 'Tienda pública', 'Equipo de trabajo'])
  })

  it('sin servicios en el plan no aparece la agenda', () => {
    expect(buildOnboardingSteps(progress({ servicesEnabled: false })).map((step) => step.key)).not.toContain('hasAgenda')
  })

  it('una barbería carga «Servicios y precios»', () => {
    expect(buildOnboardingSteps(progress({ serviceFocused: true }))[1].title).toBe('Servicios y precios')
  })

  it('cada paso abre una pantalla que existe en la app', () => {
    for (const step of buildOnboardingSteps(progress())) {
      const file = join(root, 'mobile/src/app', `${step.route}.tsx`)
      const index = join(root, 'mobile/src/app', step.route, 'index.tsx')
      expect(existsSync(file) || existsSync(index), step.route).toBe(true)
    }
  })

  it('cuenta lo listo y señala el próximo paso', () => {
    const steps = buildOnboardingSteps(progress({ steps: { hasCompanyInfo: true, hasProducts: true, hasAgenda: false, hasPublicStore: false, hasTeam: false } }))
    expect(doneCount(steps)).toBe(2)
    expect(nextStep(steps)?.key).toBe('hasAgenda')
  })

  it('se oculta con todo listo o si el dueño la ocultó en este teléfono', () => {
    const all = buildOnboardingSteps(progress({ steps: { hasCompanyInfo: true, hasProducts: true, hasAgenda: true, hasPublicStore: true, hasTeam: true } }))
    expect(shouldShowFirstSteps(all, false)).toBe(false)
    expect(shouldShowFirstSteps(buildOnboardingSteps(progress()), true)).toBe(false)
    expect(shouldShowFirstSteps(buildOnboardingSteps(progress()), false)).toBe(true)
  })

  it('el «ocultar» es por comercio y con una clave válida para SecureStore', () => {
    expect(hiddenKey('a1000000-0000-4000-8000-000000000001')).toMatch(/^[\w.-]+$/)
    expect(hiddenKey('org-1')).not.toBe(hiddenKey('org-2'))
  })

  it('normaliza la respuesta del servidor', () => {
    expect(toOnboardingProgress({ steps: { hasProducts: true, hasTeam: 'si' } }).steps).toEqual({ hasCompanyInfo: false, hasProducts: true, hasAgenda: false, hasPublicStore: false, hasTeam: false })
  })
})

describe('el botón de registro dice los días de prueba reales', () => {
  it('con un solo plazo, lo dice tal cual', () => {
    expect(registerCtaLabel([{ trial_days: 20, price: 45000 }, { trial_days: 20, price: 90000 }])).toBe('Probar gratis 20 días')
    expect(registerCtaLabel([{ trial_days: 1, price: 1 }])).toBe('Probar gratis 1 día')
  })

  it('con plazos distintos, dice el máximo', () => {
    expect(registerCtaLabel([{ trial_days: 14, price: 1 }, { trial_days: 30, price: 2 }, { trial_days: 0, price: 3 }])).toBe('Probar gratis hasta 30 días')
  })

  it('sin pruebas no promete días', () => {
    expect(registerCtaLabel([{ trial_days: 0, price: 0 }])).toBe('Crear cuenta gratis')
    expect(registerCtaLabel([{ trial_days: null, price: 45000 }])).toBe('Crear mi cuenta')
  })

  it('sin catálogo (cargando o sin conexión) no inventa un número', () => {
    expect(registerCtaLabel(null)).toBe('Crear mi cuenta')
    expect(registerCtaLabel([])).toBe('Crear mi cuenta')
  })

  it('la app ya no tiene «20 días» escrito a mano', () => {
    expect(read('mobile/src/app/index.tsx')).not.toMatch(/\d+ días\)/)
    expect(read('mobile/src/app/index.tsx')).toMatch(/\{registerLabel\}/)
  })
})
