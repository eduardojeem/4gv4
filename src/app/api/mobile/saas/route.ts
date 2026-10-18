import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPublicSubscriptionPlansStrict } from '@/lib/saas/public-plans'
import { getPlatformBranding } from '@/lib/platform/branding'
import { PLAN_LIMIT_FIELDS } from '@/lib/saas/plan-limits'
import { buildPlanFeatureGroups, publicLimitText } from '@/components/saas/landing/saas-plan-presentation'

const publicHref = z.string().refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
})
const planSchema = z.object({
  id: z.string().min(1), tier: z.string().min(1), public_slug: z.string().nullish(),
  name: z.string().min(1), price: z.number().finite().nonnegative(),
  price_note: z.string().nullish(), description: z.string().nullish(),
  is_active: z.boolean(), is_popular: z.boolean().nullish().transform((value) => value ?? false),
  trial_days: z.number().int().nonnegative().nullish(),
  limits: z.record(z.string(), z.union([z.string(), z.number().finite(), z.null()])),
  modules: z.array(z.string()),
  features: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.boolean()]) })).nullish().transform((value) => value ?? []),
})
const brandingSchema = z.object({
  platformName: z.string(), logoUrl: z.string(), platformTagline: z.string(),
  primaryCtaLabel: z.string(), primaryCtaHref: publicHref,
  secondaryCtaLabel: z.string(), secondaryCtaHref: publicHref,
})

/** Source data uses the web's tagged 300-second framework caches. HTTP errors are never cached. */
export async function GET() {
  try {
    const [rawPlans, rawBranding] = await Promise.all([
      getPublicSubscriptionPlansStrict(), getPlatformBranding(),
    ])
    const plans = z.array(planSchema).parse(rawPlans).filter((plan) => plan.is_active)
    const branding = brandingSchema.parse(rawBranding)
    const featureRows = buildPlanFeatureGroups(plans.map((plan) => ({
      ...plan,
      features: plan.features.map((feature) => ({ label: feature.label, value: feature.value ?? false })),
    }))).flatMap((group) => group.rows)
    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan.id, tier: plan.tier, public_slug: plan.public_slug || plan.tier,
        name: plan.name, price: plan.price, price_note: plan.price_note ?? '',
        description: plan.description ?? '', is_popular: plan.is_popular ?? false,
        trial_days: plan.trial_days ?? 0,
        limits: PLAN_LIMIT_FIELDS.map(({ key, label }) => ({ key, label, value: publicLimitText(key, plan.limits[key]) })),
        features: featureRows.filter((row) => row.values[plan.id]).map(({ key, label }) => ({ key, label })),
        ctaHref: `/register?plan=${encodeURIComponent(plan.public_slug || plan.tier)}`,
      })),
      branding: {
        name: branding.platformName, logoUrl: branding.logoUrl, description: branding.platformTagline,
        primaryCtaLabel: branding.primaryCtaLabel, primaryCtaHref: branding.primaryCtaHref,
        secondaryCtaLabel: branding.secondaryCtaLabel, secondaryCtaHref: branding.secondaryCtaHref,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el catálogo vigente. Reintentá en unos momentos.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
