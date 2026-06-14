import { createAdminSupabase } from '@/lib/supabase/admin'
import { buildPromoApplication, normalizePromoCode, type PromoBenefit, type SubscriptionSnapshot } from '@/lib/superadmin/promo-codes'

type RedeemPromoInput = {
  organizationId: string
  actorId: string
  promoId?: string
  code?: string
}

export type RedeemPromoResult =
  | { success: true; redemption: { id: string; redeemed_at: string }; subscription: Record<string, unknown>; requiresBillingAction: boolean; promoCode: string }
  | { success: false; error: string; status: number }

export async function redeemSubscriptionPromo(input: RedeemPromoInput): Promise<RedeemPromoResult> {
  const admin = createAdminSupabase()
  const now = new Date()
  let promoQuery = admin.from('subscription_promo_codes').select('*')

  if (input.promoId) promoQuery = promoQuery.eq('id', input.promoId)
  else promoQuery = promoQuery.eq('code', normalizePromoCode(input.code ?? ''))

  const { data: promo, error: promoError } = await promoQuery.maybeSingle()
  if (promoError) return { success: false, error: promoError.message, status: 500 }
  if (!promo) return { success: false, error: 'Código promocional no encontrado.', status: 404 }
  if (!promo.is_active) return { success: false, error: 'El código promocional está inactivo.', status: 409 }
  if (promo.starts_at && new Date(promo.starts_at) > now) return { success: false, error: 'El código todavía no está vigente.', status: 409 }
  if (promo.expires_at && new Date(promo.expires_at) < now) return { success: false, error: 'El código promocional está vencido.', status: 409 }

  const [{ count: totalRedemptions }, { data: previousRedemption }, { data: organization }, { data: subscription, error: subscriptionError }] = await Promise.all([
    admin.from('subscription_promo_redemptions').select('id', { count: 'exact', head: true }).eq('promo_code_id', promo.id),
    admin.from('subscription_promo_redemptions').select('id').eq('promo_code_id', promo.id).eq('organization_id', input.organizationId).maybeSingle(),
    admin.from('organizations').select('id, name, plan').eq('id', input.organizationId).maybeSingle(),
    admin.from('subscriptions').select('id, organization_id, plan, status, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end').eq('organization_id', input.organizationId).maybeSingle(),
  ])

  if (!organization) return { success: false, error: 'Organización no encontrada.', status: 404 }
  if (previousRedemption) return { success: false, error: 'Esta organización ya utilizó el código.', status: 409 }
  if (promo.max_redemptions && (totalRedemptions ?? 0) >= promo.max_redemptions) {
    return { success: false, error: 'El código alcanzó el máximo de usos.', status: 409 }
  }
  if (subscriptionError) return { success: false, error: subscriptionError.message, status: 500 }
  if (!subscription) return { success: false, error: 'La organización no tiene una suscripción.', status: 409 }

  const application = buildPromoApplication(promo as PromoBenefit, subscription as SubscriptionSnapshot, now)
  let resultingSubscription = subscription
  const benefitSnapshot = {
    code: promo.code,
    benefit_type: promo.benefit_type,
    discount_percent: promo.discount_percent,
    discount_amount: promo.discount_amount,
    target_plan: promo.target_plan,
    duration_days: promo.duration_days,
    requires_billing_action: application.requiresBillingAction,
  }

  const { data: redemption, error: redemptionError } = await admin
    .from('subscription_promo_redemptions')
    .insert({
      promo_code_id: promo.id,
      organization_id: organization.id,
      subscription_id: subscription.id,
      redeemed_by: input.actorId,
      benefit_snapshot: benefitSnapshot,
      previous_subscription: subscription,
      resulting_subscription: subscription,
    })
    .select('id, redeemed_at')
    .single()

  if (redemptionError) {
    return {
      success: false,
      error: redemptionError.code === '23505' ? 'Esta organización ya utilizó el código.' : redemptionError.message,
      status: redemptionError.code === '23505' ? 409 : 500,
    }
  }

  if (Object.keys(application.subscriptionPatch).length > 0) {
    const { data: updated, error } = await admin
      .from('subscriptions')
      .update({ ...application.subscriptionPatch, updated_at: now.toISOString() })
      .eq('id', subscription.id)
      .select('id, organization_id, plan, status, trial_ends_at, current_period_starts_at, current_period_ends_at, cancel_at_period_end')
      .single()

    if (error) {
      await admin.from('subscription_promo_redemptions').delete().eq('id', redemption.id)
      return { success: false, error: `No se pudo actualizar la suscripción: ${error.message}`, status: 500 }
    }
    resultingSubscription = updated

    if (application.subscriptionPatch.plan) {
      const { error: orgError } = await admin.from('organizations').update({ plan: application.subscriptionPatch.plan, updated_at: now.toISOString() }).eq('id', organization.id)
      if (orgError) {
        await Promise.all([
          admin.from('subscriptions').update({
            plan: subscription.plan,
            status: subscription.status,
            trial_ends_at: subscription.trial_ends_at,
            current_period_starts_at: subscription.current_period_starts_at,
            current_period_ends_at: subscription.current_period_ends_at,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: now.toISOString(),
          }).eq('id', subscription.id),
          admin.from('subscription_promo_redemptions').delete().eq('id', redemption.id),
        ])
        return { success: false, error: 'No se pudo sincronizar el plan de la organización.', status: 500 }
      }
    }
  }

  const { error: traceError } = await admin.from('subscription_promo_redemptions').update({ resulting_subscription: resultingSubscription }).eq('id', redemption.id)
  if (traceError) return { success: false, error: 'La promoción fue aplicada, pero no se pudo completar su trazabilidad.', status: 500 }

  return {
    success: true,
    redemption,
    subscription: resultingSubscription as Record<string, unknown>,
    requiresBillingAction: application.requiresBillingAction,
    promoCode: promo.code,
  }
}
