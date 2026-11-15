export interface LoyaltySettingsRow {
  organization_id: string
  enabled: boolean
  earning_mode?: 'amount' | 'visits' | 'both'
  points_per_visit?: number
  currency_per_point: number
  points_per_unit: number
  rounding: 'floor' | 'round'
  max_points_per_customer_per_day: number | null
  points_expiration_months: number | null
  /** Cuánto vale un punto al canjearlo por saldo a favor. null = canje apagado. */
  redemption_value?: number | null
  /** Desde cuántos puntos se puede canjear. */
  min_redemption_points?: number | null
}

export interface PointRuleRow {
  id: string
  name: string
  description: string | null
  starts_at: string
  ends_at: string
  kind: 'multiplier' | 'bonus_per_purchase' | 'visit_milestone'
  /** En «cada N visitas»: cada cuántas compras se regalan los puntos. */
  visit_interval?: number | null
  multiplier: number
  bonus_points: number
  max_bonus_points_per_customer: number | null
  max_bonus_points_total: number | null
  awarded_bonus_points: number
  min_purchase_amount: number | null
  is_active: boolean
}

export interface RaffleRow {
  id: string
  name: string
  description: string | null
  prizes: Array<{ position: number; title: string; details?: string }>
  requirements: string | null
  terms: string | null
  min_purchase_amount: number | null
  auto_entry_on_sale: boolean
  allow_point_purchase: boolean
  point_purchase_price: number | null
  starts_at: string
  ends_at: string
  points_per_ticket: number
  max_tickets_per_customer: number | null
  max_tickets_total: number
  status: 'draft' | 'published' | 'closed' | 'completed' | 'cancelled'
  min_age: number
  drawn_at: string | null
  draw_seed: string | null
  tickets?: Array<{ count: number }>
  winners?: Array<{ count: number }>
  participants_count?: number | null
}

export const DEFAULT_LOYALTY_SETTINGS: Omit<LoyaltySettingsRow, 'organization_id'> = {
  enabled: false,
  currency_per_point: 10_000,
  points_per_unit: 1,
  rounding: 'floor',
  max_points_per_customer_per_day: null,
  points_expiration_months: null,
  redemption_value: null,
  min_redemption_points: null,
}
