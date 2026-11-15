import { describe, expect, it } from 'vitest'
import { settingsFromRow, pointsPreviewText } from '@/app/dashboard/pos/hooks/useLoyaltyPreview'
import { calculateBasePoints } from './points'
import { explainEarning } from './explain'
const row = { enabled: true, currency_per_point: 1000, points_per_unit: 1, points_per_visit: 2 }
describe('mensajes del programa por turnos', () => {
  it('no promete puntos monetarios en modo por turnos', () => {
    const settings = settingsFromRow({ ...row, earning_mode: 'visits' })!
    expect(calculateBasePoints(45000, settings)).toBe(0)
    expect(
      pointsPreviewText({ settings, rules: [], pointsBase: 45000, onCredit: false })
    ).toContain('se confirman')
    expect(explainEarning({ ...row, earning_mode: 'visits' })).toContain(
      'turno atendido y pagado por completo'
    )
  })
  it('no promete una visita por una cuota o por un carrito sin turno', () => {
    const settings = settingsFromRow({ ...row, earning_mode: 'both' })!
    expect(pointsPreviewText({ settings, rules: [], pointsBase: 45000, onCredit: true })).toContain(
      'terminar de pagarse'
    )
  })
  it('mantiene la conversión anterior si no hay nuevo modo', () => {
    const settings = settingsFromRow(row)!
    expect(calculateBasePoints(45000, settings)).toBe(45)
    expect(pointsPreviewText({ settings, rules: [], pointsBase: 45000, onCredit: false })).toBe(
      'Esta compra suma 45 puntos'
    )
  })
})

it('vincula la cuota a su venta para confirmar el turno solo cuando se salda', async () => {
  const { awardCreditInstallmentLoyaltyPoints } = await import('./credit-points')
  const rpc = async (_name: string, args: Record<string, unknown>) => {
    expect(args.p_sale_id).toBe('sale-linked')
    return { data: { points: 2 }, error: null }
  }
  const client = {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              amount_paid: 5000,
              customer_credits: {
                organization_id: 'org-one',
                customer_id: 'customer-one',
                sale_id: 'sale-linked',
              },
            },
            error: null,
          }),
        }),
      }),
    }),
  }
  await expect(
    awardCreditInstallmentLoyaltyPoints(client, {
      organizationId: 'org-one',
      installmentId: 'installment',
      paidAmount: 5000,
    })
  ).resolves.toEqual({ points: 2, error: null })
})
