import { describe, expect, it } from 'vitest'
import {
  aggregateCustomerSpend,
  isCountableOrder,
  isCountableRepair,
} from './customer-spend'

const row = (customer_id: string, amount: number, date: string, status?: string) =>
  ({ customer_id, amount, date, status })

describe('aggregateCustomerSpend', () => {
  it('suma las tres fuentes para el mismo cliente', () => {
    // Es el bug reportado: antes solo se contaban las ventas del POS.
    const result = aggregateCustomerSpend({
      sales: [row('c1', 100, '2026-01-01')],
      orders: [row('c1', 50, '2026-02-01', 'DELIVERED')],
      repairs: [row('c1', 30, '2026-03-01', 'entregado')],
    })

    expect(result.c1.total).toBe(180)
    expect(result.c1.count).toBe(3)
  })

  it('cuenta al cliente que solo compro por la tienda publica', () => {
    const result = aggregateCustomerSpend({
      sales: [],
      orders: [row('c1', 250, '2026-02-01', 'DELIVERED')],
    })

    expect(result.c1.total).toBe(250)
  })

  it('cuenta al cliente que solo tuvo reparaciones', () => {
    const result = aggregateCustomerSpend({
      repairs: [row('c1', 90, '2026-02-01', 'entregado')],
    })

    expect(result.c1.total).toBe(90)
  })

  it('no suma pedidos cancelados', () => {
    const result = aggregateCustomerSpend({
      orders: [
        row('c1', 100, '2026-01-01', 'DELIVERED'),
        row('c1', 999, '2026-02-01', 'CANCELLED'),
      ],
    })

    expect(result.c1.total).toBe(100)
    expect(result.c1.count).toBe(1)
  })

  it('no suma reparaciones sin terminar', () => {
    const result = aggregateCustomerSpend({
      repairs: [
        row('c1', 100, '2026-01-01', 'entregado'),
        row('c1', 999, '2026-02-01', 'reparacion'),
        row('c1', 888, '2026-02-02', 'cancelado'),
      ],
    })

    expect(result.c1.total).toBe(100)
  })

  it('separa compras de reparaciones para no contarlas dos veces', () => {
    // La tarjeta muestra "N compras / M reparaciones": si las reparaciones
    // entran tambien en el conteo de compras, aparecen duplicadas.
    const result = aggregateCustomerSpend({
      sales: [row('c1', 100, '2026-01-01')],
      orders: [row('c1', 50, '2026-02-01', 'DELIVERED')],
      repairs: [row('c1', 30, '2026-03-01', 'entregado')],
    })

    expect(result.c1.purchaseCount).toBe(2)
    expect(result.c1.repairCount).toBe(1)
    expect(result.c1.count).toBe(3)
  })

  it('no cuenta como compra lo que no se sumó', () => {
    const result = aggregateCustomerSpend({
      orders: [row('c1', 100, '2026-01-01', 'CANCELLED')],
      repairs: [row('c1', 50, '2026-02-01', 'reparacion')],
      sales: [row('c1', 10, '2026-01-05')],
    })

    expect(result.c1.purchaseCount).toBe(1)
    expect(result.c1.repairCount).toBe(0)
  })

  it('separa los totales por cliente', () => {
    const result = aggregateCustomerSpend({
      sales: [row('c1', 100, '2026-01-01'), row('c2', 200, '2026-01-02')],
    })

    expect(result.c1.total).toBe(100)
    expect(result.c2.total).toBe(200)
  })

  it('toma la operación más reciente sin importar de qué fuente venga', () => {
    // Las tres consultas llegan por separado: no se puede confiar en el orden.
    const result = aggregateCustomerSpend({
      sales: [row('c1', 100, '2026-01-01')],
      repairs: [row('c1', 30, '2026-09-01', 'entregado')],
      orders: [row('c1', 50, '2026-05-01', 'DELIVERED')],
    })

    expect(result.c1.lastDate).toBe('2026-09-01')
    expect(result.c1.lastAmount).toBe(30)
  })

  it('ignora filas sin cliente', () => {
    const result = aggregateCustomerSpend({
      sales: [row('', 100, '2026-01-01'), { customer_id: null, amount: 50, date: null }],
    })

    expect(Object.keys(result)).toHaveLength(0)
  })

  it('trata importes nulos o no numéricos como cero, sin romper', () => {
    const result = aggregateCustomerSpend({
      sales: [
        { customer_id: 'c1', amount: null, date: '2026-01-01' },
        { customer_id: 'c1', amount: 'abc', date: '2026-01-02' },
        { customer_id: 'c1', amount: '150', date: '2026-01-03' },
      ],
    })

    expect(result.c1.total).toBe(150)
    expect(result.c1.count).toBe(3)
  })

  it('devuelve un objeto vacío sin datos', () => {
    expect(aggregateCustomerSpend({})).toEqual({})
    expect(aggregateCustomerSpend({ sales: null, orders: null, repairs: null })).toEqual({})
  })
})

describe('isCountableOrder', () => {
  it('cuenta todo salvo cancelado', () => {
    expect(isCountableOrder('DELIVERED')).toBe(true)
    expect(isCountableOrder('PENDING')).toBe(true)
    expect(isCountableOrder(null)).toBe(true)
    expect(isCountableOrder('CANCELLED')).toBe(false)
    expect(isCountableOrder('cancelled')).toBe(false)
    expect(isCountableOrder('cancelado')).toBe(false)
  })
})

describe('isCountableRepair', () => {
  // La columna guarda los estados en espanol: filtrar solo por los ingleses
  // haria que no se sume ninguna reparacion, que es justo el bug a evitar.
  it('cuenta las terminadas en español, que es lo que guarda la base', () => {
    expect(isCountableRepair('listo')).toBe(true)
    expect(isCountableRepair('entregado')).toBe(true)
    expect(isCountableRepair('Entregado')).toBe(true)
  })

  it('acepta también los equivalentes en inglés de la capa de mapeo', () => {
    expect(isCountableRepair('completed')).toBe(true)
    expect(isCountableRepair('delivered')).toBe(true)
  })

  it('no cuenta las que siguen en curso ni las canceladas', () => {
    expect(isCountableRepair('recibido')).toBe(false)
    expect(isCountableRepair('diagnostico')).toBe(false)
    expect(isCountableRepair('reparacion')).toBe(false)
    expect(isCountableRepair('pausado')).toBe(false)
    expect(isCountableRepair('cancelado')).toBe(false)
    expect(isCountableRepair('cancelled')).toBe(false)
    expect(isCountableRepair(null)).toBe(false)
  })
})
