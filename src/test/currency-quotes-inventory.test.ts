import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  convertCost,
  convertWithRounding,
  exchangeRateErrorMessage,
  foreignPriceColumns,
  foreignPriceErrorMessage,
} from '@/lib/products/foreign-price'
import {
  buildQuoteWhatsAppMessage,
  computeTotals,
  discountToHonorQuote,
  isQuoteExpired,
  posUnitPrice,
  quoteCode,
  whatsappNumber,
} from '@/lib/quotes/quote-math'
import {
  countDifference,
  countToCsv,
  getInventoryCountDetailGuidance,
  getInventoryCountListGuidance,
  findByCode,
  parseScan,
  summarizeCount,
  type CountItem,
} from '@/lib/inventory/inventory-count'

describe('precios en otra moneda', () => {
  it('convierte con el redondeo de la empresa', () => {
    expect(convertWithRounding(100, 7450, 1)).toBe(745000)
    expect(convertWithRounding(19.99, 7450, 100)).toBe(148900)
    expect(convertWithRounding(19.99, 7450, 1000)).toBe(149000)
    expect(convertWithRounding(10, 0, 100)).toBe(0)
  })

  it('el costo no se redondea a la góndola', () => {
    expect(convertCost(12.5, 7451.3)).toBe(93141.25)
  })

  it('al quitar la moneda se limpian los precios extranjeros', () => {
    expect(foreignPriceColumns({ price_currency: null })).toEqual({
      price_currency: null, foreign_sale_price: null, foreign_wholesale_price: null, foreign_purchase_price: null,
    })
    expect(foreignPriceColumns({ price_currency: 'usd', foreign_sale_price: 120 })).toMatchObject({ price_currency: 'USD', foreign_sale_price: 120 })
  })

  it('una edición solo escribe lo que llegó: quien no ve el costo no lo borra', () => {
    const sent = new Set(['price_currency', 'foreign_sale_price'])
    expect(foreignPriceColumns({ price_currency: 'USD', foreign_sale_price: 50 }, (key) => sent.has(key))).toEqual({ price_currency: 'USD', foreign_sale_price: 50 })
    expect(foreignPriceColumns({ name: 'x' } as never, () => false)).toEqual({})
  })

  it('traduce los errores de la base', () => {
    expect(foreignPriceErrorMessage({ message: 'EXCHANGE_RATE_MISSING|USD' })).toContain('USD')
    expect(foreignPriceErrorMessage({ message: 'otra cosa' })).toBeNull()
    expect(exchangeRateErrorMessage({ message: 'EXCHANGE_RATE_IN_USE' })).toContain('productos')
  })
})

describe('presupuestos', () => {
  it('calcula líneas y totales en guaraníes sin decimales', () => {
    const totals = computeTotals([
      { description: 'Funda', quantity: 3, unit_price: 25000, discount_rate: 10 },
      { description: 'Instalación', quantity: 1, unit_price: 50000 },
    ], 'PYG')
    expect(totals.lines[0].line_total).toBe(67500)
    expect(totals.subtotal).toBe(125000)
    expect(totals.total).toBe(117500)
    expect(totals.discount_total).toBe(7500)
  })

  it('el POS respeta el precio presupuestado con un descuento, nunca cobra de más', () => {
    // Subió de 100.000 a 125.000: se descuenta hasta lo acordado.
    expect(discountToHonorQuote(125000, 100000)).toBe(20)
    // Bajó: se cobra el precio nuevo.
    expect(discountToHonorQuote(90000, 100000)).toBe(0)
    expect(discountToHonorQuote(100000, 100000)).toBe(0)
    // El cálculo cierra con el precio acordado.
    const rate = discountToHonorQuote(130000, 99000)
    expect(Math.round(130000 * (1 - rate / 100))).toBe(99000)
  })

  it('el precio mayorista es el mismo que usa el POS', () => {
    expect(posUnitPrice({ sale_price: 100000, wholesale_price: 80000 }, 'wholesale')).toBe(80000)
    expect(posUnitPrice({ sale_price: 100000, wholesale_price: null }, 'wholesale')).toBe(90000)
    expect(posUnitPrice({ sale_price: 100000, wholesale_price: 80000 }, 'retail')).toBe(100000)
  })

  it('arma el número de WhatsApp en formato internacional', () => {
    expect(whatsappNumber('0981 123 456')).toBe('595981123456')
    expect(whatsappNumber('+595 0981 123456')).toBe('595981123456')
    expect(whatsappNumber('12')).toBeNull()
  })

  it('el mensaje de WhatsApp resume y lleva el enlace', () => {
    const message = buildQuoteWhatsAppMessage({
      storeName: 'HCA Celular',
      customerName: 'Ana',
      number: 12,
      lines: Array.from({ length: 10 }, (_, index) => ({ description: `Item ${index}`, quantity: 1, line_total: 1000 })),
      total: 10000,
      currency: 'PYG',
      validUntil: '2026-10-15',
      url: 'https://www.mitiendapy.com/presupuesto/abc',
    })
    expect(message).toContain('P-00012')
    expect(message).toContain('… y 2 ítems más')
    expect(message).toContain('15/10/2026')
    expect(message).toContain('https://www.mitiendapy.com/presupuesto/abc')
    expect(quoteCode(7)).toBe('P-00007')
  })

  it('vence al día siguiente de la fecha de validez', () => {
    const now = new Date('2026-10-10T15:00:00')
    expect(isQuoteExpired('2026-10-10', now)).toBe(false)
    expect(isQuoteExpired('2026-10-09', now)).toBe(true)
    expect(isQuoteExpired(null, now)).toBe(false)
  })
})

const item = (over: Partial<CountItem>): CountItem => ({
  id: 'i1', product_id: 'p1', variant_id: null, name: 'Cargador', sku: 'CG-1', barcode: '7790001', category_name: 'Cargadores',
  unit_cost: 10000, system_qty: 10, counted_qty: null, system_qty_at_count: null, counted_at: null, applied_delta: null,
  ...over,
})

describe('toma de inventario', () => {
  it('el asistente recomienda abrir, continuar o revisar según el estado real', () => {
    expect(getInventoryCountListGuidance({ available: true, canAdjust: true, counts: [], progress: {} }).kind).toBe('start')
    expect(getInventoryCountListGuidance({
      available: true,
      canAdjust: true,
      counts: [{ id: 'c1', number: 4, status: 'counting' }],
      progress: { c1: { total: 10, counted: 3 } },
    })).toMatchObject({ kind: 'continue', countId: 'c1', pending: 7 })
    expect(getInventoryCountListGuidance({
      available: true,
      canAdjust: true,
      counts: [{ id: 'c1', number: 4, status: 'counting' }],
      progress: { c1: { total: 10, counted: 10 } },
    }).kind).toBe('review')
  })

  it('el asistente del detalle nunca invita a aplicar una toma incompleta', () => {
    expect(getInventoryCountDetailGuidance({ status: 'counting', canAdjust: true, counted: 0, notCounted: 8, withDifference: 0 }).kind).toBe('count')
    expect(getInventoryCountDetailGuidance({ status: 'counting', canAdjust: true, counted: 5, notCounted: 3, withDifference: 2 }).kind).toBe('continue')
    expect(getInventoryCountDetailGuidance({ status: 'counting', canAdjust: true, counted: 8, notCounted: 0, withDifference: 2 }).kind).toBe('review')
    expect(getInventoryCountDetailGuidance({ status: 'applied', canAdjust: true, counted: 8, notCounted: 0, withDifference: 2 }).kind).toBe('closed')
  })

  it('la diferencia se mide contra el stock al momento de contar', () => {
    // Se abrió con 10, se vendieron 2 antes de contar: contar 8 no es faltante.
    expect(countDifference(item({ counted_qty: 8, system_qty_at_count: 8 }))).toBe(0)
    expect(countDifference(item({ counted_qty: 7, system_qty_at_count: 8 }))).toBe(-1)
    expect(countDifference(item({}))).toBeNull()
  })

  it('resume avance, unidades y valor al costo', () => {
    const summary = summarizeCount([
      item({ id: 'a', counted_qty: 12, system_qty_at_count: 10 }),
      item({ id: 'b', counted_qty: 7, system_qty_at_count: 10, unit_cost: 5000 }),
      item({ id: 'c' }),
    ])
    expect(summary).toMatchObject({ total: 3, counted: 2, notCounted: 1, withDifference: 2, unitsIn: 2, unitsOut: 3, valueDifference: 5000, progress: 67 })
  })

  it('el escáner busca por código de barras y después por SKU', () => {
    const items = [item({ id: 'a', barcode: '111', sku: 'X' }), item({ id: 'b', barcode: '222', sku: '111' })]
    expect(findByCode(items, '111')?.id).toBe('a')
    expect(findByCode(items, ' x ')?.id).toBe('a')
    expect(findByCode(items, 'nada')).toBeNull()
  })

  it('«3*código» suma tres unidades', () => {
    expect(parseScan('3*7790001')).toEqual({ code: '7790001', quantity: 3 })
    expect(parseScan('12 x ABC-1')).toEqual({ code: 'ABC-1', quantity: 12 })
    expect(parseScan('7790001')).toEqual({ code: '7790001', quantity: 1 })
  })

  it('exporta con separador de planilla y comillas', () => {
    const csv = countToCsv([item({ name: 'Funda "Pro"; negra', counted_qty: 9, system_qty_at_count: 10 })])
    expect(csv.split('\n')[1]).toContain('"Funda ""Pro""; negra"')
    expect(csv.split('\n')[1]).toContain(';-1;10000;-10000')
  })
})

describe('migración', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261008120000_currency_quotes_inventory_counts.sql'), 'utf8')

  it('todas las tablas nuevas tienen RLS', () => {
    for (const table of ['exchange_rates', 'exchange_rate_history', 'quotes', 'quote_items', 'inventory_counts', 'inventory_count_items']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('el tipo de cambio y el ajuste de stock verifican permisos dentro de la función', () => {
    expect(sql).toMatch(/set_exchange_rate[\s\S]*has_org_permission\(p_organization_id, 'settings\.manage'\)/)
    expect(sql).toMatch(/apply_inventory_count[\s\S]*has_org_permission\(v_count\.organization_id, 'inventory\.stock\.manage'\)[\s\S]*user_has_branch_access/)
    expect(sql).not.toMatch(/grant execute on function public\.(set_exchange_rate|apply_inventory_count)[^;]*to anon/)
  })

  it('una toma aplicada ya no se puede editar', () => {
    expect(sql).toMatch(/inventory_counts_update[\s\S]*using \(status = 'counting'/)
  })
})
