import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  billingCoverage,
  summarizeOnlineOrders,
  summarizeRepairs,
  summarizeSubscriptionPayments,
} from '@/lib/superadmin/organization-volume'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PAGINA = leer('src/app/superadmin/organizations/[id]/page.tsx')
const VISTA = leer('src/components/superadmin/organizations/OrganizationDetailView.tsx')

/**
 * `sales` y `customer_orders` son tablas distintas: el mostrador y la web no se
 * mezclan. La pantalla solo mostraba el mostrador, asi que una empresa que
 * vende todo por la tienda online se veia como una que no vende.
 */
describe('la tienda online se cuenta aparte del mostrador', () => {
  it('solo factura lo que se pagó', () => {
    const r = summarizeOnlineOrders([
      { status: 'DELIVERED', payment_status: 'PAID', total: 120_000, created_at: '2026-08-01' },
      { status: 'CANCELLED', payment_status: 'PENDING', total: 900_000, created_at: '2026-08-02' },
    ])
    expect(r.revenue).toBe(120_000)
    expect(r.paid).toBe(1)
    expect(r.total).toBe(2)
    expect(r.cancelled).toBe(1)
  })

  it('un cobro parcial no suma su total entero', () => {
    // Sumarlo completo inflaria la facturacion online con plata que no entro.
    const r = summarizeOnlineOrders([
      { status: 'READY', payment_status: 'PARTIAL', total: 500_000, created_at: '2026-08-03' },
    ])
    expect(r.revenue).toBe(0)
    expect(r.partial).toBe(1)
  })

  it('separa los pedidos que siguen abiertos', () => {
    const r = summarizeOnlineOrders([
      { status: 'PREPARING', payment_status: 'PAID', total: 10_000 },
      { status: 'SHIPPED', payment_status: 'PAID', total: 10_000 },
      { status: 'DELIVERED', payment_status: 'PAID', total: 10_000 },
      { status: 'CANCELLED', payment_status: 'FAILED', total: 10_000 },
    ])
    expect(r.open).toBe(2)
    expect(r.cancelled).toBe(1)
    expect(r.revenue).toBe(30_000)
  })

  it('sin pedidos no inventa una fecha', () => {
    expect(summarizeOnlineOrders([]).lastOrderAt).toBeNull()
  })
})

describe('el taller dice cuántos equipos tiene y cuánto falta cobrar', () => {
  it('reusa el normalizador de estados del módulo', () => {
    // La columna guarda los estados en castellano y en ingles segun la epoca:
    // un mapeo propio se desincronizaria del resto del sistema.
    const r = summarizeRepairs([
      { status: 'entregado', final_cost: 100_000, paid_amount: 100_000 },
      { status: 'delivered', final_cost: 50_000, paid_amount: 50_000 },
      { status: 'diagnostico' },
      { status: 'cancelado' },
    ])
    expect(r.completed).toBe(2)
    expect(r.open).toBe(1)
    expect(r.cancelled).toBe(1)
    expect(r.collected).toBe(150_000)
  })

  it('el trabajo terminado sin cobrar se calcula sobre el precio cerrado', () => {
    const r = summarizeRepairs([
      { status: 'entregado', final_cost: 200_000, paid_amount: 50_000 },
    ])
    expect(r.pendingBalance).toBe(150_000)
  })

  it('sin precio cerrado usa el presupuesto', () => {
    const r = summarizeRepairs([
      { status: 'entregado', final_cost: null, estimated_cost: 80_000, paid_amount: 0 },
    ])
    expect(r.pendingBalance).toBe(80_000)
  })

  it('un cobro de más no genera un saldo negativo', () => {
    const r = summarizeRepairs([
      { status: 'entregado', final_cost: 50_000, paid_amount: 90_000 },
    ])
    expect(r.pendingBalance).toBe(0)
  })

  it('lo que sigue en el taller no cuenta como deuda', () => {
    // Todavia no se termino: no hay nada que cobrar.
    const r = summarizeRepairs([{ status: 'reparacion', final_cost: 300_000, paid_amount: 0 }])
    expect(r.pendingBalance).toBe(0)
    expect(r.open).toBe(1)
  })

  it('la vista avisa que lo cobrado ya está contado en el mostrador', () => {
    // `charge_repair_balance_due` inserta una venta: sumar las dos cifras
    // contaria el mismo dinero dos veces.
    expect(VISTA).toContain('ya está contado en Punto de venta')
  })
})

/**
 * `subscription_payments` existe desde junio y no llegaba a ninguna pantalla:
 * una organizacion con plan PRO y cero cobros era invisible.
 */
describe('lo que la organización pagó por el servicio', () => {
  it('suma solo los cobrados', () => {
    const r = summarizeSubscriptionPayments([
      { amount: 250_000, status: 'paid', paid_at: '2026-08-01' },
      { amount: 250_000, status: 'pending' },
      { amount: 250_000, status: 'failed' },
      { amount: 250_000, status: 'refunded' },
    ])
    expect(r.paidTotal).toBe(250_000)
    expect(r.paidCount).toBe(1)
    expect(r.pendingCount).toBe(1)
    expect(r.failedCount).toBe(1)
    expect(r.refundedCount).toBe(1)
  })

  it('el último pago es el más reciente de los cobrados', () => {
    const r = summarizeSubscriptionPayments([
      { amount: 100_000, status: 'paid', paid_at: '2026-01-01', payment_method: 'transferencia' },
      { amount: 300_000, status: 'paid', paid_at: '2026-08-01', payment_method: 'tarjeta' },
      { amount: 999_000, status: 'pending', paid_at: '2026-09-01' },
    ])
    expect(r.lastPaidAt).toBe('2026-08-01')
    expect(r.lastPaidAmount).toBe(300_000)
    expect(r.lastPaidMethod).toBe('tarjeta')
  })

  it('un pago viejo sin `paid_at` no se descarta', () => {
    const r = summarizeSubscriptionPayments([
      { amount: 100_000, status: 'paid', paid_at: null, created_at: '2026-03-05' },
    ])
    expect(r.lastPaidAt).toBe('2026-03-05')
  })

  it('avisa cuando hay pagos en más de una moneda', () => {
    const r = summarizeSubscriptionPayments([
      { amount: 250_000, status: 'paid', currency: 'PYG' },
      { amount: 35, status: 'paid', currency: 'USD' },
    ])
    expect(r.mixedCurrency).toBe(true)
  })

  it('sin pagos no elige una moneda', () => {
    expect(summarizeSubscriptionPayments([]).currency).toBeNull()
  })
})

describe('la cobertura del plan', () => {
  it('compara meses pagados contra meses de cuenta abierta', () => {
    expect(billingCoverage(250_000, 750_000, 200)).toEqual({
      expectedMonths: 6,
      paidMonths: 3,
      behind: true,
    })
  })

  it('al día no se marca como atrasado', () => {
    expect(billingCoverage(100_000, 300_000, 90).behind).toBe(false)
  })

  it('sin precio mensual no inventa una comparación', () => {
    // Un plan gratuito «atrasado» no significa nada.
    expect(billingCoverage(0, 0, 400)).toEqual({ expectedMonths: null, paidMonths: null, behind: false })
    expect(billingCoverage(null, 0, 400).paidMonths).toBeNull()
    expect(billingCoverage(250_000, 0, null).paidMonths).toBeNull()
  })
})

describe('la página trae los tres canales', () => {
  it('pedidos, reparaciones con importes, y pagos del servicio', () => {
    expect(PAGINA).toContain(".from('customer_orders')")
    expect(PAGINA).toContain(".from('subscription_payments')")
    expect(PAGINA).toContain("select('status, final_cost, estimated_cost, paid_amount, created_at, delivered_at')")
  })

  it('un módulo que no responde no se muestra como cero', () => {
    expect(PAGINA).toContain('const onlineSummary = ordersError ? null : summarizeOnlineOrders')
    expect(PAGINA).toContain('const billingSummary = paymentsError ? null : summarizeSubscriptionPayments')
  })
})
