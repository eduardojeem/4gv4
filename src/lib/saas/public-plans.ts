import { unstable_cache } from 'next/cache'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const PUBLIC_PLANS_REVALIDATE_SECONDS = 300

async function getPublicSubscriptionPlansUncached() {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('subscription_plans')
    .select('id, tier, public_slug, name, price, price_note, description, is_popular, is_active, limits, highlights, features, color_config, trial_days')
    .eq('is_active', true)
    .order('price', { ascending: true })

  return data ?? []
}

/** Catálogo público compartido; no depende de cookies ni de la sesión. */
export const getPublicSubscriptionPlans = unstable_cache(
  getPublicSubscriptionPlansUncached,
  ['public-subscription-plans'],
  {
    revalidate: PUBLIC_PLANS_REVALIDATE_SECONDS,
    tags: ['subscription-plans:public'],
  },
)
