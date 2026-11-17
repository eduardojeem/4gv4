import { describe, expect, it } from 'vitest'

import { planOrganizationUpdate } from '@/lib/superadmin/organization-update'
import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'
import { buildOrganizationPatch, organizationPatchPayload } from '@/lib/superadmin/organization-edit'

const now = new Date('2026-11-16T12:00:00Z')
const org = { id: 'org-1', name: 'Intercell', slug: 'intercell', plan: 'PRO' }
const suspended = { id: 'sub-1', status: 'suspended', trial_ends_at: null, current_period_ends_at: null }

describe('reactivar desde superadmin', () => {
  it('«Activa» sin fecha futura se rechaza: antes quedaba bloqueada igual', () => {
    const result = planOrganizationUpdate({ status: 'active' }, org, suspended, now)
    expect(result).toMatchObject({ ok: false, field: 'current_period_ends_at' })
  })

  it('«Activa» con fecha futura marca el pago al día y el comercio deja de estar bloqueado', () => {
    const result = planOrganizationUpdate({ status: 'active', current_period_ends_at: '2026-12-16T23:59:59Z' }, org, suspended, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.subscription).toMatchObject({ status: 'active', payment_status: 'paid', current_period_ends_at: '2026-12-16T23:59:59.000Z' })
    const after = evaluateSubscriptionStatus({ status: 'active', paymentStatus: 'paid', periodEndsAt: '2026-12-16T23:59:59Z' }, now)
    expect(after.isBlocked).toBe(false)
  })

  it('«En prueba» pide una fecha de prueba futura', () => {
    expect(planOrganizationUpdate({ status: 'trialing', trial_ends_at: '2026-11-01T00:00:00Z' }, org, suspended, now)).toMatchObject({ ok: false, field: 'trial_ends_at' })
    expect(planOrganizationUpdate({ status: 'trialing', trial_ends_at: '2026-11-30T00:00:00Z' }, org, suspended, now).ok).toBe(true)
  })

  it('un estado inventado no se guarda', () => {
    expect(planOrganizationUpdate({ status: 'pausada' }, org, suspended, now)).toMatchObject({ ok: false, field: 'status' })
  })
})

describe('dirección pública', () => {
  it('rechaza direcciones reservadas del sistema', () => {
    expect(planOrganizationUpdate({ slug: 'admin' }, org, null, now)).toMatchObject({ ok: false, field: 'slug' })
    expect(planOrganizationUpdate({ slug: 'dashboard' }, org, null, now)).toMatchObject({ ok: false, field: 'slug' })
  })

  it('rechaza formatos que el registro no acepta', () => {
    expect(planOrganizationUpdate({ slug: '-intercell-' }, org, null, now)).toMatchObject({ ok: false, field: 'slug' })
  })

  it('un cambio válido devuelve la dirección vieja para redirigirla', () => {
    const result = planOrganizationUpdate({ slug: 'intercell-py' }, org, null, now)
    expect(result).toMatchObject({ ok: true, plan: { slugChange: { from: 'intercell', to: 'intercell-py' } } })
  })

  it('la misma dirección no cuenta como cambio', () => {
    expect(planOrganizationUpdate({ slug: 'intercell' }, org, null, now)).toMatchObject({ ok: true, plan: { slugChange: null } })
  })
})

describe('validaciones', () => {
  it('acepta el rubro de belleza y rechaza uno inventado', () => {
    expect(planOrganizationUpdate({ business_vertical: 'beauty_services' }, org, null, now).ok).toBe(true)
    expect(planOrganizationUpdate({ business_vertical: 'zapateria' }, org, null, now)).toMatchObject({ ok: false, field: 'business_vertical' })
  })

  it('un plan desconocido ya no se guarda como FREE', () => {
    expect(planOrganizationUpdate({ plan: 'PREMIUM' }, org, null, now)).toMatchObject({ ok: false, field: 'plan' })
    expect(planOrganizationUpdate({ plan: 'pro' }, org, null, now)).toMatchObject({ ok: true, plan: { organization: { plan: 'PRO' } } })
  })

  it('funciones: valida la lista y acepta volver al plan (null)', () => {
    expect(planOrganizationUpdate({ enabled_modules: ['pos', 'magia'] }, org, null, now)).toMatchObject({ ok: false, field: 'enabled_modules' })
    expect(planOrganizationUpdate({ enabled_modules: null }, org, null, now)).toMatchObject({ ok: true, plan: { organization: { enabled_modules: null } } })
  })

  it('moneda y zona horaria tienen que existir', () => {
    expect(planOrganizationUpdate({ currency: 'guaranies' }, org, null, now)).toMatchObject({ ok: false, field: 'currency' })
    expect(planOrganizationUpdate({ timezone: 'America/Atlantida' }, org, null, now)).toMatchObject({ ok: false, field: 'timezone' })
    expect(planOrganizationUpdate({ currency: 'usd', timezone: 'America/Asuncion' }, org, null, now)).toMatchObject({ ok: true, plan: { settings: { currency: 'USD', timezone: 'America/Asuncion' } } })
  })
})

describe('el modal arma el pedido', () => {
  const original = { name: 'Intercell', slug: 'intercell', plan: 'PRO', subscription_status: 'active', enabled_modules: ['pos', 'inventory'] }
  const base = { name: 'Intercell', slug: 'intercell', plan: 'PRO', status: 'active', currency: 'PYG', timezone: 'America/Asuncion', business_vertical: 'general', operating_model: 'retail', enabled_modules: ['pos', 'inventory'], cancel_at_period_end: false, trial_ends_at: null, current_period_ends_at: null }

  it('volver a las funciones del plan manda null', () => {
    expect(buildOrganizationPatch(original, { ...base, enabled_modules: null })).toEqual({ enabled_modules: null })
  })

  it('la fecha del campo viaja como fin del día en ISO', () => {
    const patch = buildOrganizationPatch(original, { ...base, current_period_ends_at: '2026-12-16' })
    const payload = organizationPatchPayload(patch)
    expect(typeof payload.current_period_ends_at).toBe('string')
    expect(new Date(String(payload.current_period_ends_at)).getTime()).toBe(new Date('2026-12-16T23:59:59').getTime())
  })
})
