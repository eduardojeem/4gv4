import { apiFetch, ApiError } from './api'
import type { Promotion } from '../../../src/types/promotion'
import type {
  LoyaltySettingsRow,
  PointRuleRow,
  RaffleRow,
} from '../../../src/lib/loyalty/contracts'
import type {
  buildPromotion,
  buildPointRule,
  buildRaffle,
  buildLoyaltySettings,
} from './promotions-model'
export type { Promotion, LoyaltySettingsRow, PointRuleRow, RaffleRow }
export type SettingsResponse = {
  moduleInstalled: boolean
  message?: string
  settings: LoyaltySettingsRow | null
  capabilities?: { serviceVisits: boolean }
}
export type ProgramData = {
  customers: {
    id: string
    name: string
    balance: number
    visits: number
    last_visit: string | null
  }[]
  total: number
  summary: { customers: number; visits: number; returningCustomers: number; redemptions: number }
}
export type RaffleDetail = {
  ticketsPagination: { page: number; limit: number; total: number; pages: number }
  raffle: RaffleRow
  tickets: {
    id: string
    ticket_number: number
    customer: { id: string; name: string } | null
  }[]
  winners: {
    id: string
    prize_position: number
    prize_title: string
    customer: { id: string; name: string } | null
    ticket: { ticket_number: number } | null
  }[]
}
export const fetchPromotions = (page = 1, query = '') =>
  apiFetch<{ promotions: Promotion[]; pagination: { page: number; pages: number; total: number } }>(
    '/api/promotions?limit=25&page=' + page + '&q=' + encodeURIComponent(query.trim()),
  )
export const savePromotion = (payload: ReturnType<typeof buildPromotion>, id?: string) =>
  apiFetch<Promotion>('/api/promotions' + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  })
export const togglePromotion = (id: string, is_active: boolean) =>
  apiFetch<Promotion>('/api/promotions/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify({ is_active }),
  })
export const deletePromotion = (id: string) =>
  apiFetch('/api/promotions/' + encodeURIComponent(id), { method: 'DELETE' })
export const fetchLoyaltySettings = () => apiFetch<SettingsResponse>('/api/loyalty/settings')
export const saveLoyaltySettings = (values: ReturnType<typeof buildLoyaltySettings>) =>
  apiFetch<{ settings: LoyaltySettingsRow }>('/api/loyalty/settings', {
    method: 'PUT',
    body: JSON.stringify(values),
  })
export const fetchPointRules = () =>
  apiFetch<{ moduleInstalled: boolean; message?: string; rules: PointRuleRow[] }>(
    '/api/loyalty/rules',
  )
export const savePointRule = (values: ReturnType<typeof buildPointRule>, id?: string) => {
  const { kind, ...patch } = values
  return apiFetch<{ rule: PointRuleRow }>(
    '/api/loyalty/rules' + (id ? '/' + encodeURIComponent(id) : ''),
    { method: id ? 'PATCH' : 'POST', body: JSON.stringify(id ? patch : { kind, ...patch }) },
  )
}
export const togglePointRule = (id: string, is_active: boolean) =>
  apiFetch('/api/loyalty/rules/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  })
export const deletePointRule = (id: string) =>
  apiFetch('/api/loyalty/rules/' + encodeURIComponent(id), { method: 'DELETE' })
export const fetchLoyaltyCustomers = (query = '', offset = 0) =>
  apiFetch<ProgramData>(
    '/api/loyalty/program?q=' + encodeURIComponent(query.trim()) + '&offset=' + offset,
  )
export const fetchRaffles = () =>
  apiFetch<{ moduleInstalled: boolean; message?: string; raffles: RaffleRow[] }>('/api/raffles')
export const createRaffle = (values: ReturnType<typeof buildRaffle>) =>
  apiFetch<{ raffle: RaffleRow }>('/api/raffles', { method: 'POST', body: JSON.stringify(values) })
export const updateRaffle = (
  id: string,
  values: Partial<
    Pick<
      RaffleRow,
      | 'name'
      | 'description'
      | 'requirements'
      | 'terms'
      | 'ends_at'
      | 'status'
      | 'min_purchase_amount'
      | 'auto_entry_on_sale'
      | 'allow_point_purchase'
      | 'point_purchase_price'
    >
  >,
) =>
  apiFetch('/api/raffles/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
export const fetchRaffleDetail = (id: string, page = 1) =>
  apiFetch<RaffleDetail>('/api/raffles/' + encodeURIComponent(id) + '?page=' + page + '&limit=25')
export const redeemLoyalty = (customerId: string, points: number, idempotencyKey: string) =>
  apiFetch('/api/loyalty/customers/' + encodeURIComponent(customerId) + '/redeem', {
    method: 'POST',
    body: JSON.stringify({ points, idempotencyKey }),
  })
export const drawRaffle = (id: string) =>
  apiFetch<{ winners: unknown[] }>('/api/raffles/' + encodeURIComponent(id) + '/draw', {
    method: 'POST',
    body: '{}',
  })
export function promotionsError(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.body?.code
    if (code === 'MODULE_NOT_ENTITLED')
      return 'Tu plan no incluye Promociones. Revisá los planes desde Suscripciones.'
    if (code === 'MODULE_DISABLED')
      return 'Promociones está desactivado para este negocio. Podés habilitarlo en Rubro y herramientas.'
    const details = error.body?.details as { message?: string }[] | undefined
    return details?.[0]?.message || error.message
  }
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación. Intentá de nuevo.'
}

export type CustomerLoyaltyHistory = {
  moduleInstalled: boolean
  message?: string
  account: { balance: number; earned_total: number; redeemed_total: number } | null
  ledger: { id: string; points: number; description: string; created_at: string }[]
  tickets: { id: string; ticket_number: number; raffle: { name: string } | null }[]
  winners: { id: string; prize_title: string; raffle: { name: string } | null }[]
}
export const fetchCustomerLoyaltyHistory = (id: string) =>
  apiFetch<CustomerLoyaltyHistory>('/api/loyalty/customers/' + encodeURIComponent(id))
