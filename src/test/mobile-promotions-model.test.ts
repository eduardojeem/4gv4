import { describe, expect, it } from 'vitest'
import {
  buildPromotion,
  buildLoyaltySettings,
  buildPointRule,
  buildRaffle,
  localDateToIso,
  promotionStatus,
  raffleActions,
} from '../../mobile/src/lib/promotions-model'
const promo = {
  name: 'Corte martes',
  code: ' martes ',
  description: '',
  type: 'percentage' as const,
  value: '15',
  min_purchase: '',
  max_discount: '',
  usage_limit: '',
  start_date: '2026-11-15 09:00',
  end_date: '2026-12-15 18:00',
  is_active: true,
  public_mode: 'coupon' as const,
  applicable_products: ['service-one'],
  applicable_categories: [],
}
describe('promociones nativas', () => {
  it('valida porcentaje y normaliza el código sin alterar los servicios seleccionados', () => {
    expect(buildPromotion(promo)).toMatchObject({
      code: 'MARTES',
      value: 15,
      applicable_products: ['service-one'],
      public_mode: 'coupon',
    })
    expect(() => buildPromotion({ ...promo, value: '101' })).toThrow('100')
  })
  it('no publica una oferta automática general ni por monto', () => {
    expect(() =>
      buildPromotion({ ...promo, public_mode: 'automatic', applicable_products: [] }),
    ).toThrow('producto o servicio')
    expect(() => buildPromotion({ ...promo, public_mode: 'automatic', type: 'fixed' })).toThrow(
      'porcentual',
    )
  })
  it('no confunde pausada, vencida, programada y agotada', () => {
    const base = { ...buildPromotion(promo), id: 'one', usage_count: 0 }
    expect(promotionStatus({ ...base, is_active: false })).toBe('Pausada')
    expect(promotionStatus({ ...base, end_date: '2020-01-01' })).toBe('Vencida')
    expect(promotionStatus({ ...base, start_date: '2099-01-01' })).toBe('Programada')
    expect(
      promotionStatus({ ...base, usage_limit: 1, usage_count: 1 }, new Date('2026-11-20')),
    ).toBe('Agotada')
  })
  it('rechaza fechas imposibles y preserva la hora local al convertir a ISO', () => {
    expect(() => localDateToIso('2026-02-31 12:00')).toThrow('fecha')
    const value = localDateToIso('2026-11-15 09:30')!
    expect(new Date(value).getHours()).toBe(9)
    expect(new Date(value).getMinutes()).toBe(30)
    expect(() => buildPromotion({ ...promo, end_date: promo.start_date })).toThrow('posterior')
  })
  it('no envía columnas de visitas si el servidor no soporta la migración', () => {
    const settings = buildLoyaltySettings(
      {
        enabled: true,
        earning_mode: 'amount',
        points_per_visit: 1,
        currency_per_point: 10000,
        points_per_unit: 1,
        rounding: 'floor',
        max_points_per_customer_per_day: null,
        points_expiration_months: null,
      },
      false,
    )
    expect(settings).not.toHaveProperty('earning_mode')
    expect(() => buildLoyaltySettings({ ...settings, earning_mode: 'visits' }, false)).toThrow(
      'migración',
    )
  })
  it('requiere puntos e intervalo positivos en campañas por turnos', () => {
    const rule = {
      name: 'Cada cinco turnos',
      description: '',
      kind: 'visit_milestone' as const,
      starts_at: promo.start_date,
      ends_at: promo.end_date,
      multiplier: '2',
      bonus_points: '10',
      visit_interval: '5',
      min_purchase_amount: '',
      max_bonus_points_per_customer: '',
      max_bonus_points_total: '',
      is_active: true,
    }
    expect(buildPointRule(rule)).toMatchObject({ visit_interval: 5, bonus_points: 10 })
    expect(() => buildPointRule({ ...rule, visit_interval: '1' })).toThrow()
  })
  it('crea sorteos como borrador y exige premios, fechas y un costo por número', () => {
    const raffle = {
      name: 'Aniversario',
      description: '',
      starts_at: promo.start_date,
      ends_at: promo.end_date,
      prizes: 'Corte y barba\nLavado',
      points_per_ticket: '10',
      max_tickets_total: '100',
      max_tickets_per_customer: '',
      min_age: '18',
      terms: 'Condiciones',
      requirements: '',
      min_purchase_amount: '',
      auto_entry_on_sale: false,
      allow_point_purchase: false,
      point_purchase_price: '',
    }
    expect(buildRaffle(raffle)).toMatchObject({
      status: 'draft',
      prizes: [
        { position: 1, title: 'Corte y barba' },
        { position: 2, title: 'Lavado' },
      ],
    })
    expect(() => buildRaffle({ ...raffle, prizes: '' })).toThrow('premio')
    expect(() => buildRaffle({ ...raffle, allow_point_purchase: true })).toThrow('precio')
  })
  it('no ofrece volver a sortear ni reabrir estados terminales', () => {
    expect(raffleActions('draft')).toEqual(['publish', 'cancel'])
    expect(raffleActions('published')).toEqual(['close', 'cancel'])
    expect(raffleActions('closed')).toEqual(['draw'])
    expect(raffleActions('completed')).toEqual([])
    expect(raffleActions('cancelled')).toEqual([])
  })
})
