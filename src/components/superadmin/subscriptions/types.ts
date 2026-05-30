export type SuperAdminSubscription = {
  id: string
  organization_id: string
  organization_name: string
  organization_slug: string | null
  organization_plan: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  plan: string
  plan_details: {
    code: string
    name: string
    limits: Record<string, unknown>
    modules: string[]
    is_active: boolean
  } | null
  status: string
  provider: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
  trial_ends_at: string | null
  current_period_starts_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
  created_at: string | null
  updated_at: string | null
}

export type TabValue = 'all' | 'attention' | 'renewals' | 'trials' | 'canceling'

export type SortValue = 'attention' | 'renewal' | 'trial' | 'plan' | 'name'

export type EditForm = {
  plan: string
  status: string
  trial_ends_at: string
  current_period_starts_at: string
  current_period_ends_at: string
  cancel_at_period_end: boolean
}
