import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  billingCoverage,
  describeCreditOrigins,
  summarizeCredits,
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

/**
 * La cartera financiada no estaba en ninguna pantalla del superadmin: no habia
 * forma de saber si una organizacion vende a credito, cuanto presto, ni cuanto
 * de eso esta vencido.
 */
describe('los créditos y sus cuotas', () => {
  const AHORA = new Date('2026-09-09T12:00:00Z').getTime()
  const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString()
  const dentro = (dias: number) => new Date(AHORA + dias * 86_400_000).toISOString()

  it('cuenta los créditos por estado y suma el capital', () => {
    const r = summarizeCredits(
      [
        { id: 'c1', status: 'active', principal: 1_000_000, term_months: 6, start_date: hace(30) },
        { id: 'c2', status: 'completed', principal: 500_000, term_months: 3, start_date: hace(200) },
        { id: 'c3', status: 'defaulted', principal: 300_000, term_months: 12, start_date: hace(400) },
        { id: 'c4', status: 'cancelled', principal: 200_000, term_months: 6, start_date: hace(10) },
      ],
      [],
      AHORA
    )
    expect(r.total).toBe(4)
    expect(r.active).toBe(1)
    expect(r.completed).toBe(1)
    expect(r.defaulted).toBe(1)
    expect(r.cancelled).toBe(1)
    expect(r.principal).toBe(2_000_000)
    expect(r.averageTerm).toBe(7)
  })

  it('el saldo es lo que falta de cada cuota, no su importe entero', () => {
    // Es la misma regla que `sumInstallmentsOutstanding` usa para aprobar o
    // rechazar una venta a credito.
    const r = summarizeCredits(
      [{ id: 'c1', status: 'active', principal: 300_000 }],
      [
        { status: 'paid', amount: 100_000, amount_paid: 100_000, due_date: hace(60) },
        { status: 'pending', amount: 100_000, amount_paid: 40_000, due_date: dentro(30) },
        { status: 'pending', amount: 100_000, amount_paid: null, due_date: dentro(60) },
      ],
      AHORA
    )
    expect(r.outstanding).toBe(160_000)
  })

  it('una cuota impaga cuyo vencimiento ya pasó está vencida, esté marcada o no', () => {
    // Contar solo las `late` subestima la mora: depende de que alguien haya
    // corrido el proceso que las marca.
    const r = summarizeCredits(
      [{ id: 'c1', status: 'active', principal: 200_000 }],
      [
        { status: 'pending', amount: 100_000, amount_paid: 0, due_date: hace(5) },
        { status: 'pending', amount: 100_000, amount_paid: 0, due_date: dentro(25) },
      ],
      AHORA
    )
    expect(r.overdueInstallments).toBe(1)
    expect(r.overdueAmount).toBe(100_000)
    expect(r.outstanding).toBe(200_000)
  })

  it('una cuota marcada `late` cuenta aunque no tenga fecha legible', () => {
    const r = summarizeCredits(
      [{ id: 'c1', status: 'active', principal: 50_000 }],
      [{ status: 'late', amount: 50_000, amount_paid: 0, due_date: null }],
      AHORA
    )
    expect(r.overdueInstallments).toBe(1)
  })

  it('una cuota vencida ya saldada no suma a la mora', () => {
    const r = summarizeCredits(
      [{ id: 'c1', status: 'active', principal: 50_000 }],
      [{ status: 'paid', amount: 50_000, amount_paid: 50_000, due_date: hace(90) }],
      AHORA
    )
    expect(r.overdueInstallments).toBe(0)
    expect(r.outstanding).toBe(0)
  })

  it('un cobro de más no genera saldo negativo', () => {
    const r = summarizeCredits(
      [{ id: 'c1', status: 'active', principal: 50_000 }],
      [{ status: 'pending', amount: 50_000, amount_paid: 80_000, due_date: hace(1) }],
      AHORA
    )
    expect(r.outstanding).toBe(0)
    expect(r.overdueInstallments).toBe(0)
  })

  it('sin créditos no inventa un plazo promedio', () => {
    const r = summarizeCredits([], [], AHORA)
    expect(r.averageTerm).toBeNull()
    expect(r.lastCreditAt).toBeNull()
    expect(r.total).toBe(0)
  })

  it('si no se pudieron leer todas las cuotas, lo dice', () => {
    const r = summarizeCredits([{ id: 'c1', status: 'active', principal: 1 }], [], AHORA, true)
    expect(r.installmentsTruncated).toBe(true)
  })
})

describe('la página lee la cartera respetando los límites de PostgREST', () => {
  it('las cuotas se piden por tandas: `credit_installments` no tiene organization_id', () => {
    expect(PAGINA).toContain('const INSTALLMENT_CHUNK = 200')
    expect(PAGINA).toContain("creditIds.slice(i, i + INSTALLMENT_CHUNK)")
  })

  it('una tanda que falla marca el saldo como parcial, no lo achica en silencio', () => {
    expect(PAGINA).toContain('if (error) { installmentsFailed = true; break }')
    expect(VISTA).toContain('no se pudieron leer todas las cuotas')
  })
})

/**
 * HCA Celular tiene ₲750.000 de capital prestado y ₲50.000 facturado. Los dos
 * numeros son correctos y puestos uno al lado del otro parecen contradecirse:
 * un credito de taller o una linea manual no generan una venta en el mostrador.
 */
describe('de dónde nació cada crédito', () => {
  it('agrupa por origen', () => {
    const r = summarizeCredits(
      [
        { id: 'a', status: 'active', principal: 100, origin_type: 'sale' },
        { id: 'b', status: 'active', principal: 100, origin_type: 'sale' },
        { id: 'c', status: 'active', principal: 100, origin_type: 'repair' },
      ],
      []
    )
    expect(r.byOrigin).toEqual({ sale: 2, repair: 1 })
    expect(describeCreditOrigins(r.byOrigin)).toBe('2 de venta · 1 de taller')
  })

  it('una fila anterior a la migración que agregó la columna no se pierde', () => {
    const r = summarizeCredits([{ id: 'a', status: 'active', principal: 1 }], [])
    expect(r.byOrigin).toEqual({ sin_clasificar: 1 })
    expect(describeCreditOrigins(r.byOrigin)).toBe('1 de sin clasificar')
  })

  it('sin créditos no arma una frase vacía', () => {
    expect(describeCreditOrigins({})).toBeNull()
  })

  it('la vista explica por qué el capital puede superar lo facturado', () => {
    expect(VISTA).toContain('no nació de una venta')
    expect(VISTA).toContain("origen !== 'sale'")
  })
})
