import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  accountAge,
  averageTicket,
  configuredOr,
  countMissingContact,
  resolveOnboardingState,
  resolveOrganizationContact,
} from '@/lib/superadmin/organization-profile'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/app/superadmin/organizations/[id]/page.tsx')
const VISTA = leer('src/components/superadmin/organizations/OrganizationDetailView.tsx')

const AHORA = new Date('2026-09-09T12:00:00Z').getTime()
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString()

/**
 * La ficha abria con dos tarjetas que repetian el encabezado: nombre, slug,
 * moneda, UUID. El telefono del negocio, su direccion y su RUC existen en la
 * base y no llegaban a ninguna pantalla del superadmin.
 */
describe('el contacto se arma con las cuatro fuentes que ya existen', () => {
  it('prefiere lo que el admin cargó sobre lo que quedó en la sucursal', () => {
    const c = resolveOrganizationContact({
      adminSettings: { companyPhone: '021-555' },
      defaultBranch: { phone: '0981-000' },
    })
    expect(c.phone.value).toBe('021-555')
    expect(c.phone.source).toBe('admin')
  })

  it('cae a la sucursal cuando el admin no cargó nada', () => {
    const c = resolveOrganizationContact({ defaultBranch: { phone: '0981-000', city: 'Encarnación' } })
    expect(c.phone).toEqual({ value: '0981-000', source: 'branch' })
    expect(c.city).toEqual({ value: 'Encarnación', source: 'branch' })
  })

  it('un string vacío no cuenta como cargado', () => {
    // `companyPhone: ''` es lo que deja el formulario cuando se borra el campo.
    const c = resolveOrganizationContact({
      adminSettings: { companyPhone: '   ' },
      defaultBranch: { phone: '0981-000' },
    })
    expect(c.phone).toEqual({ value: '0981-000', source: 'branch' })
  })

  it('el RUC sale de facturación cuando el admin no lo cargó', () => {
    const c = resolveOrganizationContact({ billing: { ruc: '80012345-6' } })
    expect(c.ruc).toEqual({ value: '80012345-6', source: 'billing' })
  })

  it('sin ninguna fuente devuelve null, no una cadena vacía', () => {
    const c = resolveOrganizationContact({})
    expect(c.phone).toEqual({ value: null, source: null })
    expect(countMissingContact(c)).toBe(5)
  })

  it('cuenta cuántos datos faltan para poder avisarlo', () => {
    const c = resolveOrganizationContact({
      adminSettings: { companyPhone: '021', companyAddress: 'Mcal. López 100', city: 'Asunción' },
      billing: { ruc: '80012345-6' },
    })
    expect(countMissingContact(c)).toBe(1)
  })

  it('el correo del propietario no cuenta como correo del negocio', () => {
    // Es su cuenta personal. Contarlo como cargado haria que la ficha dijera
    // que no falta nada cuando el negocio no tiene correo publico.
    const c = resolveOrganizationContact({ owner: { email: 'dueno@gmail.com' } })
    expect(c.email.value).toBeNull()
    // Para facturar si sirve, y se dice de donde salio.
    expect(c.billingEmail).toEqual({ value: 'dueno@gmail.com', source: 'owner' })
  })

  it('la procedencia se muestra: un teléfono heredado no es uno elegido', () => {
    expect(VISTA).toContain('SOURCE_LABELS[source]')
  })
})

describe('el ticket promedio', () => {
  it('divide lo cobrado entre las ventas cobradas', () => {
    expect(averageTicket(300_000, 4)).toBe(75_000)
  })

  it('sin ventas no devuelve cero', () => {
    // Un promedio de ₲0 se leería como «vende barato», no como «no vendió».
    expect(averageTicket(0, 0)).toBeNull()
    expect(averageTicket(100, 0)).toBeNull()
  })

  it('la vista dice «Sin dato», no ₲0', () => {
    expect(VISTA).toContain("ticket === null ? 'Sin dato'")
  })
})

describe('la antigüedad se dice en palabras', () => {
  it('días, meses y años según corresponda', () => {
    expect(accountAge(hace(1), AHORA)?.label).toBe('1 día')
    expect(accountAge(hace(12), AHORA)?.label).toBe('12 días')
    expect(accountAge(hace(60), AHORA)?.label).toBe('1 mes')
    expect(accountAge(hace(240), AHORA)?.label).toBe('7 meses')
    expect(accountAge(hace(400), AHORA)?.label).toBe('1 a. 1 m.')
    expect(accountAge('2024-09-09T12:00:00Z', AHORA)?.label).toBe('2 años')
  })

  it('cuenta meses de calendario, no promedios', () => {
    // Con `días / 30.44`, una cuenta abierta hace exactamente dos años se
    // mostraba como «1 a. 11 m.»: 730 / 30.44 = 23,98 meses.
    expect(accountAge('2024-09-10T12:00:00Z', AHORA)?.label).toBe('1 a. 11 m.')
    expect(accountAge('2023-09-09T12:00:00Z', AHORA)?.label).toBe('3 años')
  })

  it('sin fecha no inventa una antigüedad', () => {
    expect(accountAge(null, AHORA)).toBeNull()
    expect(accountAge('no es una fecha', AHORA)).toBeNull()
  })
})

/**
 * `settings?.currency || 'PYG'` no distingue «guaranies porque asi lo pidieron»
 * de «guaranies porque es el default»: el superadmin veia un valor configurado
 * donde no habia ninguno.
 */
describe('un valor por defecto se distingue de uno elegido', () => {
  it('marca cuál es cuál', () => {
    expect(configuredOr('USD', 'PYG')).toEqual({ value: 'USD', isDefault: false })
    expect(configuredOr(null, 'PYG')).toEqual({ value: 'PYG', isDefault: true })
    expect(configuredOr('', 'PYG')).toEqual({ value: 'PYG', isDefault: true })
  })

  it('y la vista lo dice', () => {
    expect(VISTA).toContain('la organización nunca la eligió')
  })
})

describe('la configuración inicial de la cuenta', () => {
  it('lee la misma marca que /api/onboarding/status', () => {
    expect(resolveOnboardingState({ onboarding: { status: 'completed', completed_at: '2026-01-02' } })).toEqual({
      completed: true,
      completedAt: '2026-01-02',
    })
    expect(resolveOnboardingState({ onboarding: { status: 'pending' } })).toEqual({
      completed: false,
      completedAt: null,
    })
    expect(resolveOnboardingState(null)).toEqual({ completed: false, completedAt: null })
  })

  it('una cuenta que nunca terminó de configurarse se señala', () => {
    expect(VISTA).toContain('Nunca terminó de configurar la cuenta')
    expect(VISTA).toContain('warn={!onboarding.completed}')
  })
})

describe('la ficha deja de repetir el encabezado', () => {
  it('las tarjetas de metadatos duplicados ya no están', () => {
    // «Nombre de la Empresa» y «Subdominio Público» repetian, palabra por
    // palabra, lo que el encabezado ya mostraba arriba de la pestaña.
    expect(VISTA).not.toContain('Nombre de la Empresa')
    expect(VISTA).not.toContain('Subdominio Público')
    expect(VISTA).not.toContain('Propietario & Ajustes Regionales')
  })

  it('y en su lugar hay datos que no estaban en ninguna pantalla', () => {
    expect(VISTA).toContain('Cómo contactar al negocio')
    expect(VISTA).toContain('Datos para facturarle')
  })

  it('el teléfono se puede marcar y la dirección abre el mapa', () => {
    expect(VISTA).toContain('`tel:${')
    expect(VISTA).toContain('google.com/maps/search/')
  })
})

describe('la página carga las fuentes nuevas', () => {
  it('trae el perfil de facturación y el contacto público', () => {
    expect(PAGINA).toContain(".from('billing_profiles')")
    expect(PAGINA).toContain(".eq('key', 'company_info')")
  })

  it('y los ajustes del admin salen del helper compartido, no de un parseo propio', () => {
    expect(PAGINA).toContain('getTenantAdminSettings(settings?.modules)')
  })
})
