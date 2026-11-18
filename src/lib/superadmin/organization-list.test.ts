import { describe, expect, it } from 'vitest'
import {
  buildOrganizationsCsv,
  countQuickFilters,
  describeDue,
  formatPlatformDate,
  getOrganizationAttention,
  hasBillingProblem,
  matchesQuickFilter,
  sortOrganizations,
  toEditableOrganization,
  type SuperAdminOrganization,
} from './organization-list'
import { applyQuickAction } from './organization-quick-actions'

const AHORA = new Date('2026-11-18T15:00:00.000Z').getTime()
const en = (dias: number) => new Date(AHORA + dias * 86_400_000).toISOString()

const org = (over: Partial<SuperAdminOrganization>): SuperAdminOrganization => ({
  id: 'org-1', name: 'HCA Celular', slug: 'hca-celular', plan: 'PRO', logo_url: null,
  owner_id: 'owner-1', owner_name: 'Hugo', owner_email: 'dueno@hca.com.py',
  created_at: '2025-02-14T10:00:00Z', updated_at: null,
  subscription_status: 'active', payment_status: 'paid', subscription_provider: null,
  trial_ends_at: null, current_period_ends_at: en(40), cancel_at_period_end: false,
  members_total: 3, members_active: 3, members_invited: 0, members_suspended: 0,
  staff_total: 3, staff_active: 3, staff_invited: 0, staff_suspended: 0, customers_total: 0,
  business_vertical: 'electronics', operating_model: 'retail', enabled_modules: null,
  last_access_known: true, last_access_at: en(-1), last_sale_at: en(0), products_total: 10,
  currency: 'USD', timezone: 'America/Asuncion', storefront_public: true, erased_at: null,
  ...over,
})

describe('modal de edición desde el listado', () => {
  /** La tarjeta abría el modal sin vencimiento: «Extender 30 días» contaba desde hoy. */
  it('lleva vencimiento, pago, moneda y zona horaria', () => {
    const editable = toEditableOrganization(org({ current_period_ends_at: en(20), payment_status: 'pending' }))
    expect(editable).toMatchObject({ current_period_ends_at: en(20), payment_status: 'pending', currency: 'USD', timezone: 'America/Asuncion' })
    const extended = applyQuickAction('extend_30', {
      status: editable.subscription_status ?? null,
      current_period_ends_at: editable.current_period_ends_at,
      trial_ends_at: editable.trial_ends_at,
    }, new Date(AHORA))
    // 20 días que le quedaban + 30, no hoy + 30.
    expect(extended.current_period_ends_at).toBe(formatPlatformDate(en(50), 'iso'))
  })
})

describe('qué requiere atención', () => {
  it('un pago fallido con la suscripción activa es problema de cobro', () => {
    expect(hasBillingProblem({ subscription_status: 'active', payment_status: 'failed' })).toBe(true)
    expect(hasBillingProblem({ subscription_status: 'active', payment_status: 'pending' })).toBe(false)
    expect(hasBillingProblem({ subscription_status: 'past_due', payment_status: 'paid' })).toBe(true)
  })

  it('ordena cobro, vencimiento, inactividad y sin suscripción', () => {
    const rows = [
      org({ id: 'ok', name: 'Al día' }),
      org({ id: 'nosub', name: 'Sin sub', subscription_status: null, current_period_ends_at: null }),
      org({ id: 'idle', name: 'Inactiva', last_access_at: en(-60) }),
      org({ id: 'due', name: 'Vence', current_period_ends_at: en(3) }),
      org({ id: 'bill', name: 'Cobro', subscription_status: 'past_due' }),
    ]
    expect(sortOrganizations(rows, 'attention', 'asc', AHORA).map((o) => o.id)).toEqual(['bill', 'due', 'idle', 'nosub', 'ok'])
  })

  it('sin el dato de acceso no la marca como inactiva', () => {
    expect(getOrganizationAttention(org({ last_access_known: false, last_access_at: null }), AHORA).inactive).toBe(false)
  })

  /** Las dadas de baja figuraban como empresas normales. */
  it('las dadas de baja solo aparecen en su filtro y no piden atención', () => {
    const baja = org({ id: 'baja', name: 'Empresa dada de baja', erased_at: en(-5), subscription_status: null })
    expect(matchesQuickFilter(baja, 'all', AHORA)).toBe(false)
    expect(matchesQuickFilter(baja, 'erased', AHORA)).toBe(true)
    expect(getOrganizationAttention(baja, AHORA).rank).toBe(4)
    expect(countQuickFilters([baja, org({})], AHORA)).toMatchObject({ all: 1, erased: 1, attention: 0 })
  })
})

describe('orden', () => {
  it('el plan sigue el nivel, no el abecedario', () => {
    const rows = ['PRO', 'FREE', 'ENTERPRISE', 'BASIC'].map((plan) => org({ id: plan, plan }))
    expect(sortOrganizations(rows, 'plan', 'asc', AHORA).map((o) => o.plan)).toEqual(['FREE', 'BASIC', 'PRO', 'ENTERPRISE'])
  })

  it('el estado va del más grave al mejor y sin suscripción al final', () => {
    const rows = ['active', null, 'unpaid', 'trialing', 'cancelled'].map((status, index) => org({ id: String(index), subscription_status: status }))
    expect(sortOrganizations(rows, 'status', 'asc', AHORA).map((o) => o.subscription_status)).toEqual(['unpaid', 'trialing', 'active', 'cancelled', null])
  })

  it('las fechas que faltan quedan al final en cualquier sentido', () => {
    const rows = [org({ id: 'sin', subscription_status: null, current_period_ends_at: null }), org({ id: 'pronto', current_period_ends_at: en(2) }), org({ id: 'tarde', current_period_ends_at: en(30) })]
    expect(sortOrganizations(rows, 'due', 'asc', AHORA).map((o) => o.id)).toEqual(['pronto', 'tarde', 'sin'])
    expect(sortOrganizations(rows, 'due', 'desc', AHORA).map((o) => o.id)).toEqual(['tarde', 'pronto', 'sin'])
  })
})

describe('fechas en hora de Paraguay', () => {
  /** A las 22:00 de Paraguay ya es el día siguiente en UTC. */
  it('el alta de la noche no se corre al día siguiente', () => {
    expect(formatPlatformDate('2026-11-19T01:30:00.000Z', 'iso')).toBe('2026-11-18')
  })

  it('describe el vencimiento con fecha y días', () => {
    expect(describeDue(org({ current_period_ends_at: en(24) }), AHORA)?.label).toMatch(/^Vence .+ · en 24 d$/)
    expect(describeDue(org({ subscription_status: 'trialing', trial_ends_at: en(2) }), AHORA)).toMatchObject({ urgent: true })
    expect(describeDue(org({ current_period_ends_at: en(-3) }), AHORA)?.label).toBe('Venció hace 3 días')
  })
})

describe('CSV', () => {
  it('no cae al id cuando falta el nombre del dueño y no inventa ventas sin el dato', () => {
    const csv = buildOrganizationsCsv([org({ owner_name: null, activity_known: false })], AHORA)
    const [header, row] = csv.split('\n')
    expect(header).toContain('"Vence"')
    expect(row).not.toContain('owner-1')
    expect(row).toContain('"Sin dato"')
  })
})
