import { unstable_cache } from 'next/cache'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { mergePublicPlanCatalog } from './public-plan-catalog'

export const PUBLIC_PLANS_REVALIDATE_SECONDS = 300

async function getPublicSubscriptionPlansUncached() {
  const admin = createAdminSupabase()
  const [commercial, technical] = await Promise.all([
    admin.from('subscription_plans')
      .select('id, tier, public_slug, name, price, price_note, description, is_popular, is_active, limits, highlights, features, color_config, trial_days')
      .eq('is_active', true).order('price', { ascending: true }),
    admin.from('plans').select('code, limits, modules, is_active').eq('is_active', true),
  ])
  if (commercial.error || technical.error) {
    throw new Error('No se pudo cargar el catálogo operativo de planes')
  }
  return mergePublicPlanCatalog(commercial.data ?? [], technical.data ?? [])
}

/** Catálogo público compartido; no depende de cookies ni de la sesión. */
const getCachedPublicSubscriptionPlans = unstable_cache(
  getPublicSubscriptionPlansUncached,
  ['public-subscription-plans-operational-v2'],
  {
    revalidate: PUBLIC_PLANS_REVALIDATE_SECONDS,
    tags: ['subscription-plans:public'],
  },
)

export async function getPublicSubscriptionPlans() {
  try {
    return await getCachedPublicSubscriptionPlans()
  } catch {
    // No inventa precios ni guarda un catálogo vacío en la caché por un fallo temporal.
    console.warn('Catálogo público de planes no disponible')
    return []
  }
}
