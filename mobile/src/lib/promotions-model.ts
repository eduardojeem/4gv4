import type { Promotion } from '../../../src/types/promotion'
import type { LoyaltySettingsRow, PointRuleRow } from '../../../src/lib/loyalty/contracts'
import {
  canTransitionRaffleStatus,
  type RaffleLifecycleStatus,
} from '../../../src/lib/raffles/lifecycle'
export type { Promotion, RaffleLifecycleStatus }
export type NumberInput = number | string | null | undefined
export function numberField(
  value: NumberInput,
  label: string,
  min = 0,
  max = 9999999999,
  integer = false,
): number {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new Error(label + ': ingresá un número válido, sin separadores de miles.')
  const number = Number(text)
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  )
    throw new Error(
      label + ': debe estar entre ' + min + ' y ' + max + (integer ? ', sin decimales.' : '.'),
    )
  return number
}
const optional = (value: NumberInput, label: string, min = 0, max = 9999999999, integer = false) =>
  value == null || String(value).trim() === '' ? null : numberField(value, label, min, max, integer)
export function localDateToIso(value: string, required = false): string | null {
  if (!value.trim()) {
    if (required) throw new Error('Falta la fecha y hora.')
    return null
  }
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/)
  if (!m) throw new Error('Usá la fecha AAAA-MM-DD y la hora HH:mm.')
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  if (
    year < 2000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    throw new Error('La fecha u hora no es válida.')
  return date.toISOString()
}
export function localDate(value: string | Date | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  )
}
export function dates(start: string, end: string, required = false) {
  const starts = localDateToIso(start, required),
    ends = localDateToIso(end, required)
  if (starts && ends && ends <= starts)
    throw new Error('La fecha de cierre debe ser posterior al inicio.')
  return { starts, ends }
}
export type PromotionDraft = {
  name: string
  code: string
  description: string
  type: 'percentage' | 'fixed'
  value: string
  min_purchase: string
  max_discount: string
  usage_limit: string
  start_date: string
  end_date: string
  is_active: boolean
  public_mode: 'disabled' | 'coupon' | 'automatic'
  applicable_products: string[]
  applicable_categories: string[]
}
export function promotionDraft(row?: Promotion): PromotionDraft {
  return {
    name: row?.name ?? '',
    code: row?.code ?? '',
    description: row?.description ?? '',
    type: row?.type ?? 'percentage',
    value: row ? String(row.value) : '10',
    min_purchase: row?.min_purchase == null ? '' : String(row.min_purchase),
    max_discount: row?.max_discount == null ? '' : String(row.max_discount),
    usage_limit: row?.usage_limit == null ? '' : String(row.usage_limit),
    start_date: localDate(row?.start_date),
    end_date: localDate(row?.end_date),
    is_active: row?.is_active ?? true,
    public_mode: row?.public_mode ?? 'disabled',
    applicable_products: row?.applicable_products ?? [],
    applicable_categories: row?.applicable_categories ?? [],
  }
}
export function buildPromotion(d: PromotionDraft) {
  if (d.name.trim().length < 2 || !d.code.trim()) throw new Error('Completá el nombre y el código.')
  const range = dates(d.start_date, d.end_date)
  if (d.public_mode === 'automatic' && d.type !== 'percentage')
    throw new Error('La oferta automática debe usar descuento porcentual.')
  if (d.public_mode === 'automatic' && !d.applicable_products.length)
    throw new Error('Seleccioná al menos un producto o servicio para la oferta automática.')
  return {
    ...d,
    name: d.name.trim(),
    code: d.code.trim().toUpperCase(),
    value: numberField(d.value, 'Descuento', 0.01, d.type === 'percentage' ? 100 : 9999999999),
    min_purchase: optional(d.min_purchase, 'Compra mínima'),
    max_discount: optional(d.max_discount, 'Descuento máximo', 0.01),
    usage_limit: optional(d.usage_limit, 'Límite de usos', 1, 1000000, true),
    start_date: range.starts,
    end_date: range.ends,
  }
}
export function promotionStatus(
  row: Pick<Promotion, 'is_active' | 'start_date' | 'end_date' | 'usage_limit' | 'usage_count'>,
  now = new Date(),
) {
  if (!row.is_active) return 'Pausada'
  if (row.end_date && new Date(row.end_date) < now) return 'Vencida'
  if (row.start_date && new Date(row.start_date) > now) return 'Programada'
  if (row.usage_limit != null && Number(row.usage_count) >= row.usage_limit) return 'Agotada'
  return 'Vigente'
}
export function buildLoyaltySettings(
  d: Omit<LoyaltySettingsRow, 'organization_id'>,
  ready: boolean,
) {
  const mode = d.earning_mode ?? 'amount'
  if (!ready && mode !== 'amount')
    throw new Error('Falta habilitar la migración de fidelización por turnos.')
  return {
    enabled: d.enabled,
    currency_per_point: numberField(d.currency_per_point, 'Monto por tramo', 0.01),
    points_per_unit: numberField(d.points_per_unit, 'Puntos por tramo', 1, 100000, true),
    rounding: d.rounding,
    max_points_per_customer_per_day: optional(
      d.max_points_per_customer_per_day,
      'Tope diario',
      1,
      1000000000,
      true,
    ),
    points_expiration_months: optional(d.points_expiration_months, 'Vencimiento', 1, 1200, true),
    redemption_value: optional(d.redemption_value, 'Valor por punto', 0.01),
    min_redemption_points: optional(
      d.min_redemption_points,
      'Mínimo de canje',
      1,
      1000000000,
      true,
    ),
    ...(ready
      ? {
          earning_mode: mode,
          points_per_visit: numberField(
            d.points_per_visit ?? 1,
            'Puntos por turno',
            1,
            100000,
            true,
          ),
        }
      : {}),
  }
}
export type RuleDraft = {
  name: string
  description: string
  kind: PointRuleRow['kind']
  starts_at: string
  ends_at: string
  multiplier: string
  bonus_points: string
  visit_interval: string
  min_purchase_amount: string
  max_bonus_points_per_customer: string
  max_bonus_points_total: string
  is_active: boolean
}
export function pointRuleDraft(row?: PointRuleRow): RuleDraft {
  return {
    name: row?.name ?? '',
    description: row?.description ?? '',
    kind: row?.kind ?? 'multiplier',
    starts_at: localDate(row?.starts_at ?? new Date()),
    ends_at: localDate(row?.ends_at ?? new Date(Date.now() + 7 * 86400000)),
    multiplier: String(row?.multiplier ?? 2),
    bonus_points: String(row?.bonus_points ?? 10),
    visit_interval: String(row?.visit_interval ?? 5),
    min_purchase_amount: row?.min_purchase_amount == null ? '' : String(row.min_purchase_amount),
    max_bonus_points_per_customer:
      row?.max_bonus_points_per_customer == null ? '' : String(row.max_bonus_points_per_customer),
    max_bonus_points_total:
      row?.max_bonus_points_total == null ? '' : String(row.max_bonus_points_total),
    is_active: row?.is_active ?? true,
  }
}
export function buildPointRule(d: RuleDraft) {
  if (d.name.trim().length < 2) throw new Error('Poné un nombre para la campaña.')
  const range = dates(d.starts_at, d.ends_at, true)
  return {
    ...d,
    name: d.name.trim(),
    description: d.description || null,
    starts_at: range.starts!,
    ends_at: range.ends!,
    multiplier: d.kind === 'multiplier' ? numberField(d.multiplier, 'Multiplicador', 1, 100) : 1,
    bonus_points:
      d.kind === 'multiplier'
        ? 0
        : numberField(d.bonus_points, 'Puntos extra', 1, 1000000000, true),
    visit_interval:
      d.kind === 'visit_milestone'
        ? numberField(d.visit_interval, 'Frecuencia', 2, 100, true)
        : null,
    min_purchase_amount: optional(d.min_purchase_amount, 'Pago mínimo'),
    max_bonus_points_per_customer: optional(
      d.max_bonus_points_per_customer,
      'Tope por cliente',
      1,
      1000000000,
      true,
    ),
    max_bonus_points_total: optional(
      d.max_bonus_points_total,
      'Tope de campaña',
      1,
      1000000000,
      true,
    ),
  }
}
export type RaffleDraft = {
  name: string
  description: string
  starts_at: string
  ends_at: string
  prizes: string
  points_per_ticket: string
  max_tickets_total: string
  max_tickets_per_customer: string
  min_age: string
  terms: string
  requirements: string
  min_purchase_amount: string
  auto_entry_on_sale: boolean
  allow_point_purchase: boolean
  point_purchase_price: string
}
export function raffleDraft(): RaffleDraft {
  return {
    name: '',
    description: '',
    starts_at: localDate(new Date()),
    ends_at: localDate(new Date(Date.now() + 30 * 86400000)),
    prizes: '',
    points_per_ticket: '10',
    max_tickets_total: '1000',
    max_tickets_per_customer: '',
    min_age: '18',
    terms: '',
    requirements: '',
    min_purchase_amount: '',
    auto_entry_on_sale: false,
    allow_point_purchase: false,
    point_purchase_price: '',
  }
}
export function buildRaffle(d: RaffleDraft) {
  if (d.name.trim().length < 3)
    throw new Error('El nombre del sorteo debe tener al menos 3 caracteres.')
  const range = dates(d.starts_at, d.ends_at, true)
  const prizes = d.prizes
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((title, index) => ({ position: index + 1, title }))
  if (!prizes.length || prizes.some((p) => p.title.length < 2))
    throw new Error('Agregá al menos un premio con nombre.')
  if (d.allow_point_purchase && !d.point_purchase_price.trim())
    throw new Error('Indicá el precio por punto para habilitar su venta.')
  return {
    name: d.name.trim(),
    description: d.description || null,
    starts_at: range.starts!,
    ends_at: range.ends!,
    prizes,
    points_per_ticket: numberField(d.points_per_ticket, 'Puntos por número', 1, 1000000000, true),
    max_tickets_total: numberField(d.max_tickets_total, 'Números disponibles', 1, 1000000, true),
    max_tickets_per_customer: optional(
      d.max_tickets_per_customer,
      'Números por cliente',
      1,
      1000000,
      true,
    ),
    min_age: numberField(d.min_age, 'Edad mínima', 0, 99, true),
    terms: d.terms || null,
    requirements: d.requirements || null,
    min_purchase_amount: optional(d.min_purchase_amount, 'Pago mínimo'),
    auto_entry_on_sale: d.auto_entry_on_sale,
    allow_point_purchase: d.allow_point_purchase,
    point_purchase_price: d.allow_point_purchase
      ? numberField(d.point_purchase_price, 'Precio por punto', 0.01)
      : null,
    status: 'draft' as const,
  }
}
export const raffleStatusLabel: Record<RaffleLifecycleStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  closed: 'Cerrado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
}
export function raffleActions(
  status: RaffleLifecycleStatus,
): ('publish' | 'close' | 'cancel' | 'draw')[] {
  if (status === 'closed') return ['draw']
  return (['publish', 'close', 'cancel'] as const).filter(
    (action) =>
      canTransitionRaffleStatus(
        status,
        { publish: 'published', close: 'closed', cancel: 'cancelled' }[
          action
        ] as RaffleLifecycleStatus,
      ) && { publish: 'published', close: 'closed', cancel: 'cancelled' }[action] !== status,
  )
}
