import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'
import { normalizeTenantSlug, validateTenantSlug } from '@/lib/saas/reserved-slugs'
import { INTERNAL_PAYMENT_STATUS, INTERNAL_STATUS_OPTION } from '@/lib/saas/internal-subscription'

/**
 * Reglas del «Editar organización» del superadmin, sin base de datos para
 * poder probarlas. La ruta PATCH valida todo acá antes de escribir nada.
 */

export const ORGANIZATION_PLAN_CODES = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const
export const SUBSCRIPTION_STATUS_VALUES = ['active', 'trialing', 'past_due', 'suspended', 'cancelled', 'expired', 'unpaid'] as const
export const OPERATING_MODEL_VALUES = ['retail', 'wholesale', 'service', 'repair', 'mixed'] as const
/** Las mismas funciones que acepta la base (organizations_enabled_modules_check). */
export const ORGANIZATION_MODULE_KEYS = [
  'pos', 'inventory', 'crm', 'ecommerce', 'repairs', 'orders', 'credits', 'services',
  'delivery', 'analytics', 'web_analytics', 'promotions', 'inventory_admin', 'security', 'finances', 'reports',
] as const
/** Estados que dejan al comercio sin operar: el modal los marca como peligrosos. */
export const RESTRICTIVE_STATUSES = new Set(['past_due', 'suspended', 'cancelled', 'expired', 'unpaid'])

const PLAN_ALIASES: Record<string, string> = {
  free: 'FREE', basic: 'BASIC', starter: 'BASIC', pro: 'PRO', profesional: 'PRO', professional: 'PRO', enterprise: 'ENTERPRISE',
}

export type CurrentSubscription = {
  id: string
  status: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
  payment_status?: string | null
} | null

export type CurrentOrganization = { id: string; name: string; slug: string; plan: string | null }

export type OrganizationUpdatePlan = {
  organization: Record<string, unknown>
  subscription: Record<string, unknown> | null
  settings: Record<string, unknown> | null
  slugChange: { from: string; to: string } | null
  /** Lo que se pidió cambiar, completo, para el registro de auditoría. */
  requested: Record<string, unknown>
}

export type OrganizationUpdateResult =
  | { ok: true; plan: OrganizationUpdatePlan }
  | { ok: false; error: string; field?: string }

const fail = (error: string, field?: string): OrganizationUpdateResult => ({ ok: false, error, field })

function parseDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === '') return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? { ok: true, value: new Date(time).toISOString() } : { ok: false }
}

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function planCodeOf(value: string): string | null {
  const key = value.trim().toLowerCase()
  if (PLAN_ALIASES[key]) return PLAN_ALIASES[key]
  const upper = value.trim().toUpperCase()
  return (ORGANIZATION_PLAN_CODES as readonly string[]).includes(upper) ? upper : null
}

export function planOrganizationUpdate(
  body: Record<string, unknown>,
  current: CurrentOrganization,
  subscription: CurrentSubscription,
  now = new Date(),
): OrganizationUpdateResult {
  const organization: Record<string, unknown> = {}
  const subscriptionPatch: Record<string, unknown> = {}
  const settings: Record<string, unknown> = {}
  let slugChange: OrganizationUpdatePlan['slugChange'] = null

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 120) return fail('El nombre tiene que tener entre 2 y 120 caracteres.', 'name')
    organization.name = name
  }

  if (body.slug !== undefined) {
    const requested = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (requested !== current.slug) {
      // Las mismas reglas que el registro: nada de direcciones reservadas
      // (admin, api, dashboard…) que taparían una ruta del sistema.
      const slug = normalizeTenantSlug(requested)
      if (slug !== requested) return fail('La dirección solo puede tener letras minúsculas, números y guiones, sin guiones al principio ni al final.', 'slug')
      const check = validateTenantSlug(slug)
      if (check.ok === false) return fail(check.message, 'slug')
      organization.slug = slug
      slugChange = { from: current.slug, to: slug }
    }
  }

  if (body.plan !== undefined) {
    const code = typeof body.plan === 'string' ? planCodeOf(body.plan) : null
    // Antes un plan desconocido se guardaba como FREE sin avisar.
    if (!code) return fail('Ese plan no existe.', 'plan')
    organization.plan = code
    subscriptionPatch.plan = code
  }

  if (body.business_vertical !== undefined) {
    const vertical = typeof body.business_vertical === 'string' ? body.business_vertical.trim().toLowerCase() : ''
    if (!(BUSINESS_VERTICALS as readonly string[]).includes(vertical)) return fail('Ese rubro no existe.', 'business_vertical')
    organization.business_vertical = vertical
  }

  if (body.operating_model !== undefined) {
    const model = typeof body.operating_model === 'string' ? body.operating_model.trim().toLowerCase() : ''
    if (!(OPERATING_MODEL_VALUES as readonly string[]).includes(model)) return fail('Ese tipo de negocio no existe.', 'operating_model')
    organization.operating_model = model
  }

  if (body.enabled_modules !== undefined) {
    // null = volver a las funciones del plan.
    if (body.enabled_modules === null) {
      organization.enabled_modules = null
    } else if (Array.isArray(body.enabled_modules) && body.enabled_modules.every((key) => (ORGANIZATION_MODULE_KEYS as readonly string[]).includes(String(key)))) {
      organization.enabled_modules = Array.from(new Set(body.enabled_modules.map(String)))
    } else {
      return fail('Hay funciones que no existen en la lista.', 'enabled_modules')
    }
  }

  if (body.currency !== undefined) {
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : ''
    if (!/^[A-Z]{3}$/.test(currency)) return fail('La moneda tiene que ser un código de 3 letras (por ejemplo PYG).', 'currency')
    settings.currency = currency
  }

  if (body.timezone !== undefined) {
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : ''
    if (!timezone || !isValidTimezone(timezone)) return fail('Esa zona horaria no existe.', 'timezone')
    settings.timezone = timezone
  }

  for (const key of ['trial_ends_at', 'current_period_ends_at'] as const) {
    if (body[key] === undefined) continue
    const parsed = parseDate(body[key])
    if (!parsed.ok) return fail('La fecha no es válida.', key)
    subscriptionPatch[key] = parsed.value
  }

  if (body.cancel_at_period_end !== undefined) {
    if (typeof body.cancel_at_period_end !== 'boolean') return fail('Valor inválido para la cancelación programada.', 'cancel_at_period_end')
    subscriptionPatch.cancel_at_period_end = body.cancel_at_period_end
  }

  if (body.status !== undefined) {
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase().replace(/^canceled$/, 'cancelled') : ''
    // Cuenta interna: activa, sin vencimiento ni cobro. No pide renovación ni suma al MRR.
    if (status === INTERNAL_STATUS_OPTION) {
      Object.assign(subscriptionPatch, {
        status: 'active',
        payment_status: INTERNAL_PAYMENT_STATUS,
        current_period_ends_at: null,
        trial_ends_at: null,
        cancel_at_period_end: false,
      })
      return {
        ok: true,
        plan: { organization, subscription: subscriptionPatch, settings: Object.keys(settings).length ? settings : null, slugChange, requested: body },
      }
    }
    if (!(SUBSCRIPTION_STATUS_VALUES as readonly string[]).includes(status)) return fail('Ese estado de suscripción no existe.', 'status')
    subscriptionPatch.status = status
    // Al salir de cuenta interna, el pago deja de figurar como interno.
    if (subscription?.payment_status?.toLowerCase() === INTERNAL_PAYMENT_STATUS && status !== 'active') {
      subscriptionPatch.payment_status = null
    }
    const nowTime = now.getTime()
    // El sistema bloquea por fecha y por pago, no solo por el estado: «Activa»
    // con el pago impago o el período vencido seguía bloqueando el comercio.
    if (status === 'active') {
      const until = (subscriptionPatch.current_period_ends_at ?? subscription?.current_period_ends_at ?? null) as string | null
      if (!until || new Date(until).getTime() <= nowTime) {
        return fail('Para activarla, indicá hasta qué fecha queda activa (una fecha futura).', 'current_period_ends_at')
      }
      subscriptionPatch.payment_status = 'paid'
    }
    if (status === 'trialing') {
      const until = (subscriptionPatch.trial_ends_at ?? subscription?.trial_ends_at ?? null) as string | null
      if (!until || new Date(until).getTime() <= nowTime) {
        return fail('Para dejarla en prueba, indicá hasta qué fecha dura la prueba (una fecha futura).', 'trial_ends_at')
      }
    }
  }

  return {
    ok: true,
    plan: {
      organization,
      subscription: Object.keys(subscriptionPatch).length ? subscriptionPatch : null,
      settings: Object.keys(settings).length ? settings : null,
      slugChange,
      requested: body,
    },
  }
}
