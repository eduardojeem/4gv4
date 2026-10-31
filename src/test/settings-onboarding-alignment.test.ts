import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  branchContactPatch,
  companyInfoContactPatch,
  resolveTenantEffectiveSettings,
} from '@/lib/organization/tenant-effective-settings'
import { preservedSharedSetupFields } from '@/lib/onboarding/preserve-unasked'
import { deriveOnboardingChecklist } from '@/lib/onboarding/shared-setup'
import { localeForRegion, regionalSuggestion } from '@/lib/regional/country-labels'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const globalRow = {
  id: 'system',
  company_name: 'MiTiendaPy',
  company_email: 'plataforma@mitiendapy.test',
  company_phone: '021 000',
  company_ruc: '99999999-9',
  company_address: 'Oficina de la plataforma',
  city: 'Luque',
  currency: 'PYG',
  tax_rate: 10,
  low_stock_threshold: 5,
  session_timeout: 60,
  auto_backup: true,
  email_notifications: true,
  sms_notifications: false,
  maintenance_mode: false,
  allow_registration: true,
  require_email_verification: true,
  max_login_attempts: 5,
  password_min_length: 8,
  require_two_factor: false,
}

describe('datos del negocio en Configuración', () => {
  it('nunca muestra el email, RUC ni contacto de la plataforma como si fueran del comercio', () => {
    const effective = resolveTenantEffectiveSettings({
      globalRow,
      orgSettings: { display_name: 'Moda Uno', currency: 'PYG', timezone: 'America/Asuncion', modules: {} },
      organizationName: 'Moda Uno',
      defaultBranch: null,
    })
    expect(effective).toMatchObject({
      companyName: 'Moda Uno',
      companyEmail: '',
      companyPhone: '',
      companyRuc: '',
      companyAddress: '',
      city: '',
      // Los valores generales (IVA) sí siguen saliendo de la plataforma.
      taxRate: 10,
    })
  })

  it('usa lo propio del comercio y, si falta, la sucursal principal', () => {
    const effective = resolveTenantEffectiveSettings({
      globalRow,
      orgSettings: { display_name: null, modules: { admin_settings: { companyRuc: '80012345-6', taxRate: 5 } } },
      organizationName: 'Ferretería Sur',
      defaultBranch: { phone: '0981 111', address: 'Ruta 1', city: 'Encarnación', email: null },
    })
    expect(effective).toMatchObject({
      companyName: 'Ferretería Sur',
      companyRuc: '80012345-6',
      companyPhone: '0981 111',
      companyAddress: 'Ruta 1',
      city: 'Encarnación',
      companyEmail: '',
      taxRate: 5,
    })
  })

  it('carga y guardado arman la configuración con la misma función', () => {
    expect(read('src/app/api/settings/shared/route.ts')).toContain('resolveTenantEffectiveSettings(')
    expect(read('src/app/api/admin/system/settings/route.ts')).toContain('resolveTenantEffectiveSettings(')
  })

  it('el hook no inventa un email ni una ciudad de ejemplo', () => {
    const hook = read('src/hooks/use-shared-settings.ts')
    expect(hook).not.toContain("'info@empresa.com'")
    expect(hook).toContain('data.company_email ?? DEFAULT_SHARED_SETTINGS.companyEmail')
  })
})

describe('el contacto se mantiene igual en sucursal y tienda', () => {
  it('actualiza la sucursal cuando tenía el mismo dato o estaba vacía', () => {
    expect(branchContactPatch(
      { companyPhone: '0982 222', city: 'Asunción' },
      { companyPhone: '0981 111', city: '' },
      { phone: '0981 111', city: null, address: 'Ruta 1', email: null },
    )).toEqual({ phone: '0982 222', city: 'Asunción' })
  })

  it('no pisa un dato propio de la sucursal', () => {
    expect(branchContactPatch(
      { companyPhone: '0982 222' },
      { companyPhone: '0981 111' },
      { phone: '0971 555' },
    )).toEqual({})
  })

  it('lleva el RUC y el email a la ficha de la tienda', () => {
    expect(companyInfoContactPatch(
      { companyRuc: '80012345-6', companyEmail: 'hola@moda.test' },
      { companyRuc: '', companyEmail: '' },
      { ruc: '', name: 'Moda Uno' },
    )).toEqual({ ruc: '80012345-6', email: 'hola@moda.test' })
  })

  it('el RUC cargado en Configuración marca «Configurar facturación»', () => {
    const checklistServer = read('src/lib/onboarding/setup-checklist-server.ts')
    expect(checklistServer).toContain('getTenantAdminSettings(settings.data?.modules).companyRuc')
  })

  it('Sitio web también actualiza el contacto de Configuración', () => {
    const route = read('src/app/api/admin/website/sync-company/route.ts')
    expect(route).toContain('mergeTenantAdminSettings(currentOrgSettings?.modules')
  })
})

describe('terminar el onboarding no borra lo que no pregunta', () => {
  it('conserva email, RUC, logo, redes y la publicación de la tienda', () => {
    expect(preservedSharedSetupFields({
      adminSettings: { companyEmail: 'hola@moda.test', companyRuc: '' },
      companyInfo: {
        ruc: '80012345-6',
        logoUrl: 'https://cdn.example.test/logo.png',
        whatsapp: '0981 111',
        instagram: '@moda',
        brandColor: 'blue',
        hours: { saturday: '8 a 12' },
      },
      organizationLogoUrl: null,
      storefrontPublic: true,
    })).toMatchObject({
      email: 'hola@moda.test',
      ruc: '80012345-6',
      logoUrl: 'https://cdn.example.test/logo.png',
      whatsapp: '0981 111',
      instagram: '@moda',
      saturday: '8 a 12',
      storefrontPublic: true,
    })
  })

  it('descarta valores que el formulario rechazaría en vez de fallar', () => {
    expect(preservedSharedSetupFields({
      adminSettings: { companyEmail: 'no-es-un-email' },
      companyInfo: { logoUrl: 'ftp://logo' },
      organizationLogoUrl: null,
      storefrontPublic: false,
    })).toMatchObject({ email: '', logoUrl: '', storefrontPublic: false })
  })

  it('el endpoint del asistente compartido usa esos valores', () => {
    const route = read('src/app/api/onboarding/complete/route.ts')
    expect(route).toContain('preservedSharedSetupFields(')
    expect(route).toContain('...preserved,')
  })
})

describe('enlaces y región', () => {
  it('la lista de pendientes no apunta a páginas que no existen', () => {
    const checklist = deriveOnboardingChecklist({
      countryCode: null, businessName: 'Moda', branchExists: true, logoExists: false, productsCount: 0,
      memberCount: 1, paymentConfigured: false, billingConfigured: false, storefrontConfigured: false, marketplaceConfigured: false,
    })
    for (const item of checklist.items) expect(item.href).not.toContain('/admin/settings/company')
    expect(read('src/components/dashboard/onboarding/BusinessStartGuide.tsx')).not.toContain('/admin/settings/company')
  })

  it('arma el locale con el idioma de los formatos y el país', () => {
    expect(localeForRegion('es', 'PY')).toBe('es-PY')
    expect(localeForRegion('en', 'PY')).toBe('en-PY')
    expect(localeForRegion('es', null)).toBeNull()
    expect(regionalSuggestion('BR')).toEqual({ currency: 'BRL', timeZone: 'America/Sao_Paulo', language: 'pt' })
  })

  it('las direcciones viejas de Configuración siguen llevando a su pestaña', () => {
    const page = read('src/app/admin/settings/page.tsx')
    for (const hash of ['empresa: ', 'operacion: ', 'monedas: ', 'negocio: ', 'fiscal: ', 'rubro: ', 'apariencia: ']) {
      expect(page).toContain(hash)
    }
    expect(page).toContain('<AdminMfaPolicyCard />')
  })
})
