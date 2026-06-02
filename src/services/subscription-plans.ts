import { createClient } from '@/lib/supabase/client'

export type SubscriptionPlan = {
  id: string
  tier: 'free' | 'basic' | 'pro' | 'enterprise'
  name: string
  price: number
  price_note: string | null
  description: string | null
  is_popular: boolean
  is_active: boolean
  trial_days?: number | null
  limits: Record<string, unknown>
  highlights: string[]
  features: Array<{ label?: string; iconName?: string; value?: boolean | string }>
  color_config: Record<string, string>
  created_at: string
  updated_at: string
}

export async function getSubscriptionPlans() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true })

  if (error) {
    console.error('Error fetching subscription plans:', error)
    return []
  }

  // Si no hay tabla o datos aún, retornamos vacío para que el componente lo maneje
  return data as SubscriptionPlan[]
}

export async function updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>) {
  const response = await fetch(`/api/superadmin/subscription-plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const payload = await response.json().catch(() => null) as { plan?: SubscriptionPlan; error?: string } | null

  if (!response.ok || !payload?.plan) {
    const message = payload?.error || 'No se pudo actualizar el plan'
    console.error('Error updating plan:', message)
    throw new Error(message)
  }

  return payload.plan
}

export type SubscriptionPlanStats = {
  orgsByPlan: Record<string, number>
  activeByPlan: Record<string, number>
  mrr: number
  activeSubs: number
  trialingSubs: number
  totalOrgs: number
  mostUsedPlan: string | null
  mostUsedPercent: number
}

export async function getSubscriptionPlanStats(): Promise<SubscriptionPlanStats | null> {
  try {
    const res = await fetch('/api/superadmin/subscription-plans')
    if (!res.ok) return null
    return await res.json() as SubscriptionPlanStats
  } catch {
    return null
  }
}

export async function createSubscriptionPlan(payload: Partial<SubscriptionPlan> & { tier: string; name: string; price: number }) {
  const response = await fetch('/api/superadmin/subscription-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => null) as { plan?: SubscriptionPlan; error?: string } | null
  if (!response.ok || !data?.plan) {
    throw new Error(data?.error || 'No se pudo crear el plan')
  }
  return data.plan
}
