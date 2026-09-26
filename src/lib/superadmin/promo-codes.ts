import { z } from 'zod'

export const promoBenefitTypes = [
  'discount_percent',
  'discount_fixed',
  'activate_plan',
  'extend_trial',
  'extend_period',
] as const

export type PromoBenefitType = typeof promoBenefitTypes[number]

export type DurationUnit = 'days' | 'months'

export type PromoBenefit = {
  benefit_type: PromoBenefitType
  discount_percent?: number | null
  discount_amount?: number | null
  target_plan?: string | null
  duration_days?: number | null
  duration_unit?: DurationUnit | null
}

export type SubscriptionSnapshot = {
  plan?: string | null
  status?: string | null
  trial_ends_at?: string | null
  current_period_starts_at?: string | null
  current_period_ends_at?: string | null
  cancel_at_period_end?: boolean | null
}

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const optionalPositiveNumber = z.coerce.number().positive().nullable().optional()
const optionalPositiveInteger = z.coerce.number().int().positive().nullable().optional()

export const promoCodeCreateSchema = z.object({
  code: z.string().min(3).max(40).transform(normalizePromoCode),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  benefitType: z.enum(promoBenefitTypes),
  discountPercent: optionalPositiveNumber,
  discountAmount: optionalPositiveNumber,
  targetPlan: z.string().trim().min(1).max(30).nullable().optional(),
  durationDays: optionalPositiveInteger,
  durationUnit: z.enum(['days', 'months']).optional().default('days'),
  maxRedemptions: optionalPositiveInteger,
  startsAt: z.iso.datetime().nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  isActive: z.boolean().optional().default(true),
}).superRefine((value, context) => {
  if (value.benefitType === 'discount_percent' && (!value.discountPercent || value.discountPercent > 100)) {
    context.addIssue({ code: 'custom', path: ['discountPercent'], message: 'El porcentaje debe estar entre 1 y 100.' })
  }
  if (value.benefitType === 'discount_fixed' && !value.discountAmount) {
    context.addIssue({ code: 'custom', path: ['discountAmount'], message: 'El monto de descuento es obligatorio.' })
  }
  if (value.benefitType === 'activate_plan' && !value.targetPlan) {
    context.addIssue({ code: 'custom', path: ['targetPlan'], message: 'El plan de destino es obligatorio.' })
  }
  if (['activate_plan', 'extend_trial', 'extend_period'].includes(value.benefitType) && !value.durationDays) {
    context.addIssue({ code: 'custom', path: ['durationDays'], message: 'La duración es obligatoria.' })
  }
  if (value.startsAt && value.expiresAt && new Date(value.startsAt) >= new Date(value.expiresAt)) {
    context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'La expiración debe ser posterior al inicio.' })
  }
})

export const promoCodeUpdateSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  maxRedemptions: optionalPositiveInteger,
  expiresAt: z.iso.datetime().nullable().optional(),
  isActive: z.boolean().optional(),
})

// Suma meses calendario manteniendo el día (con clamp para meses más cortos:
// 31 ene + 1 mes → 28/29 feb, no se desborda a marzo).
function addMonths(base: Date, months: number): Date {
  const result = new Date(base)
  const day = result.getDate()
  result.setMonth(result.getMonth() + months)
  if (result.getDate() < day) result.setDate(0)
  return result
}

// Calcula la nueva fecha sumando la duración al período vigente si está en el futuro
// (renovación que acumula) o a "ahora" si ya venció. Soporta días o meses.
function addDurationFromLatest(
  now: Date,
  existing: string | null | undefined,
  value: number,
  unit: DurationUnit
) {
  const existingDate = existing ? new Date(existing) : null
  const base = existingDate && !Number.isNaN(existingDate.getTime()) && existingDate > now ? existingDate : now
  const result = unit === 'months'
    ? addMonths(base, value)
    : new Date(base.getTime() + value * 86_400_000)
  return result.toISOString()
}

export function buildPromoApplication(promo: PromoBenefit, subscription: SubscriptionSnapshot, now = new Date()) {
  const durationValue = promo.duration_days ?? 0
  const durationUnit: DurationUnit = promo.duration_unit === 'months' ? 'months' : 'days'

  if (promo.benefit_type === 'discount_percent' || promo.benefit_type === 'discount_fixed') {
    return { subscriptionPatch: {}, requiresBillingAction: true }
  }

  if (promo.benefit_type === 'activate_plan') {
    return {
      subscriptionPatch: {
        plan: promo.target_plan?.toUpperCase(),
        status: 'active',
        current_period_starts_at: now.toISOString(),
        current_period_ends_at: addDurationFromLatest(now, subscription.current_period_ends_at, durationValue, durationUnit),
        cancel_at_period_end: false,
        payment_status: 'paid',
      },
      requiresBillingAction: false,
    }
  }

  if (promo.benefit_type === 'extend_trial') {
    return {
      subscriptionPatch: {
        status: 'trialing',
        trial_ends_at: addDurationFromLatest(now, subscription.trial_ends_at, durationValue, durationUnit),
        cancel_at_period_end: false,
        payment_status: 'paid',
      },
      requiresBillingAction: false,
    }
  }

  return {
    subscriptionPatch: {
      status: 'active',
      current_period_ends_at: addDurationFromLatest(now, subscription.current_period_ends_at, durationValue, durationUnit),
      cancel_at_period_end: false,
      payment_status: 'paid',
    },
    requiresBillingAction: false,
  }
}

export type PromoCodeStatusMeta = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  tone: 'active' | 'inactive' | 'expired' | 'exhausted' | 'scheduled'
}

export function codeStatus(code: {
  is_active: boolean
  expires_at?: string | null
  starts_at?: string | null
  max_redemptions?: number | null
  redemption_count: number
}): PromoCodeStatusMeta {
  const now = Date.now()
  if (!code.is_active) return { label: 'Inactivo', variant: 'secondary', tone: 'inactive' }
  if (code.expires_at && new Date(code.expires_at).getTime() < now) {
    return { label: 'Vencido', variant: 'destructive', tone: 'expired' }
  }
  if (code.max_redemptions && code.redemption_count >= code.max_redemptions) {
    return { label: 'Agotado', variant: 'destructive', tone: 'exhausted' }
  }
  if (code.starts_at && new Date(code.starts_at).getTime() > now) {
    return { label: 'Programado', variant: 'outline', tone: 'scheduled' }
  }
  return { label: 'Vigente', variant: 'default', tone: 'active' }
}

export function benefitSummary(code: {
  benefit_type: string
  discount_percent?: number | null
  discount_amount?: number | null
  target_plan?: string | null
  duration_days?: number | null
  duration_unit?: string | null
}): string {
  if (code.benefit_type === 'discount_percent') return `${code.discount_percent ?? 0}% de descuento`
  if (code.benefit_type === 'discount_fixed') {
    return `${Number(code.discount_amount ?? 0).toLocaleString('es-PY')} Gs. de descuento`
  }
  const unit = code.duration_unit === 'months' ? 'mes(es)' : 'días'
  if (code.benefit_type === 'activate_plan') {
    return `Plan ${code.target_plan ?? 'PRO'} por ${code.duration_days ?? 30} ${unit}`
  }
  if (code.benefit_type === 'extend_trial') {
    return `Prueba extendida por ${code.duration_days ?? 15} ${unit}`
  }
  return `${code.duration_days ?? 30} ${unit} adicionales`
}

export type ExpirationNotice = {
  isExpired: boolean
  isExpiringSoon: boolean
  label: string
  sublabel?: string
  daysDiff: number | null
}

export function getExpirationNotice(expiresAt: string | null | undefined): ExpirationNotice {
  if (!expiresAt) {
    return { isExpired: false, isExpiringSoon: false, label: 'Sin vencimiento', daysDiff: null }
  }
  const exp = new Date(expiresAt).getTime()
  const now = Date.now()
  const diffMs = exp - now
  const diffDays = Math.ceil(diffMs / 86_400_000)

  if (diffMs < 0) {
    const overdue = Math.abs(diffDays)
    return {
      isExpired: true,
      isExpiringSoon: false,
      label: overdue === 0 ? 'Venció hoy' : `Venció hace ${overdue} día${overdue === 1 ? '' : 's'}`,
      sublabel: new Date(expiresAt).toLocaleDateString('es-PY'),
      daysDiff: diffDays,
    }
  }

  if (diffDays <= 7) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      label: diffDays === 0 ? 'Vence hoy' : `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}`,
      sublabel: new Date(expiresAt).toLocaleDateString('es-PY'),
      daysDiff: diffDays,
    }
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    label: new Date(expiresAt).toLocaleDateString('es-PY'),
    sublabel: `Quedan ${diffDays} días`,
    daysDiff: diffDays,
  }
}
