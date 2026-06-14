import { z } from 'zod'

export const promoBenefitTypes = [
  'discount_percent',
  'discount_fixed',
  'activate_plan',
  'extend_trial',
  'extend_period',
] as const

export type PromoBenefitType = typeof promoBenefitTypes[number]

export type PromoBenefit = {
  benefit_type: PromoBenefitType
  discount_percent?: number | null
  discount_amount?: number | null
  target_plan?: string | null
  duration_days?: number | null
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

function addDaysFromLatest(now: Date, existing: string | null | undefined, days: number) {
  const existingDate = existing ? new Date(existing) : null
  const base = existingDate && !Number.isNaN(existingDate.getTime()) && existingDate > now ? existingDate : now
  return new Date(base.getTime() + days * 86_400_000).toISOString()
}

export function buildPromoApplication(promo: PromoBenefit, subscription: SubscriptionSnapshot, now = new Date()) {
  const durationDays = promo.duration_days ?? 0

  if (promo.benefit_type === 'discount_percent' || promo.benefit_type === 'discount_fixed') {
    return { subscriptionPatch: {}, requiresBillingAction: true }
  }

  if (promo.benefit_type === 'activate_plan') {
    return {
      subscriptionPatch: {
        plan: promo.target_plan?.toUpperCase(),
        status: 'active',
        current_period_starts_at: now.toISOString(),
        current_period_ends_at: addDaysFromLatest(now, subscription.current_period_ends_at, durationDays),
        cancel_at_period_end: false,
      },
      requiresBillingAction: false,
    }
  }

  if (promo.benefit_type === 'extend_trial') {
    return {
      subscriptionPatch: {
        status: 'trialing',
        trial_ends_at: addDaysFromLatest(now, subscription.trial_ends_at, durationDays),
        cancel_at_period_end: false,
      },
      requiresBillingAction: false,
    }
  }

  return {
    subscriptionPatch: {
      status: 'active',
      current_period_ends_at: addDaysFromLatest(now, subscription.current_period_ends_at, durationDays),
      cancel_at_period_end: false,
    },
    requiresBillingAction: false,
  }
}
