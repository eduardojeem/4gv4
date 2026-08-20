import { describe, expect, it } from 'vitest'

import {
  buildFinanceSummaryFromRecords,
  buildUnpaidObligationUpdate,
  toFinanceApiError,
  type FinanceSummaryRecords,
} from './server'

describe('buildUnpaidObligationUpdate', () => {
  const current = {
    category_id: 'category-id',
    concept: 'Alquiler',
    amount: 100,
    vendor: 'Proveedor',
    accounting_date: '2026-08-01',
    due_date: '2026-08-10',
    notes: 'Original',
  }

  it('derives overdue and pending from the effective due date', () => {
    expect(
      buildUnpaidObligationUpdate(current, { branchId: 'branch-id' }, '2026-08-11'),
    ).toMatchObject({ status: 'overdue' })

    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: '2026-08-12' },
        '2026-08-11',
      ),
    ).toMatchObject({ due_date: '2026-08-12', status: 'pending' })
  })

  it('clears nullable fields only when explicit null is supplied', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: null, vendor: null, notes: null },
        '2026-08-11',
      ),
    ).toMatchObject({
      due_date: null,
      vendor: null,
      notes: null,
      status: 'pending',
    })

    const omitted = buildUnpaidObligationUpdate(
      current,
      { branchId: 'branch-id' },
      '2026-08-11',
    )
    expect(omitted).not.toHaveProperty('due_date')
    expect(omitted).not.toHaveProperty('vendor')
    expect(omitted).not.toHaveProperty('notes')
  })

  it('does not reuse the old due date when it is cleared with an accounting-date change', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        {
          branchId: 'branch-id',
          accountingDate: '2026-08-20',
          dueDate: null,
        },
        '2026-08-11',
      ),
    ).toMatchObject({
      accounting_date: '2026-08-20',
      due_date: null,
      status: 'pending',
    })
  })
})

describe('toFinanceApiError', () => {
  it('maps recurring idempotency payload reuse to a sanitized conflict', () => {
    const error = toFinanceApiError({
      message:
        'FINANCE_RECURRING_IDEMPOTENCY_KEY_REUSED internal payload details',
    })

    expect(error.status).toBe(409)
    expect(error.code).toBe('FINANCE_CONFLICT')
    expect(error.message).toBe(
      'El pago entra en conflicto con el estado actual de la obligacion.',
    )
    expect(error.message).not.toContain('internal payload details')
  })
})

describe('devoluciones de posventa en el resumen', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const baseRecords: FinanceSummaryRecords = {
    sales: [{
      id: 'sale-1', code: 'VTA-1', branchId: 'branch-1', createdAt: '2026-08-05T10:00:00.000Z',
      status: 'completed', totalAmount: 1_000_000, paidAmount: 0, employeeId: null,
    }],
    saleItems: [{
      id: 'item-1', saleId: 'sale-1', productId: 'product-1', productName: 'Cargador',
      quantity: 1, unitCost: 600_000, revenueAmount: 1_000_000,
    }],
    salePayments: [{
      saleId: 'sale-1', branchId: 'branch-1', paymentDate: '2026-08-05',
      amount: 1_000_000, paymentMethod: 'cash', status: 'completed',
    }],
    salePaymentTimingAvailable: true,
    creditPayments: [],
    creditPaymentTimingAvailable: true,
    repairs: [],
    repairParts: [],
    obligations: [],
    payrollEntries: [],
    financePayments: [],
    payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const withRefund = (refund: Partial<{ amount: number; recoveredCost: number; cashAmount: number }>) =>
    buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-1',
        branchId: 'branch-1',
        resolvedAt: '2026-08-20T12:00:00.000Z',
        amount: 200_000,
        recoveredCost: 0,
        cashAmount: 0,
        ...refund,
      }],
    }, filters)

  it('sin devoluciones el resumen no cambia', () => {
    const summary = buildFinanceSummaryFromRecords(baseRecords, filters)
    expect(summary.accrued.revenue).toBe(1_000_000)
    expect(summary.accrued.directCosts).toBe(600_000)
  })

  // El bug: la venta seguia contando entera y el reintegro no aparecia, asi que
  // la utilidad quedaba inflada por cada devolucion del periodo.
  it('descuenta del ingreso la devolucion cerrada en el periodo', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 200_000 })
    expect(summary.accrued.revenue).toBe(800_000)
  })

  it('recupera el costo solo si la mercaderia volvio vendible', () => {
    expect(withRefund({ amount: 200_000, recoveredCost: 120_000 }).accrued.directCosts).toBe(480_000)
    expect(withRefund({ amount: 200_000, recoveredCost: 0 }).accrued.directCosts).toBe(600_000)
  })

  it('cuenta el reintegro por caja como salida de efectivo', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 200_000 })
    expect(summary.cash.paid).toBe(200_000)
    expect(summary.cash.netCashFlow).toBe(800_000)
  })

  it('deja el saldo a favor fuera del flujo de caja', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 0 })
    expect(summary.accrued.revenue).toBe(800_000)
    expect(summary.cash.paid).toBe(0)
  })

  it('ignora una devolucion cerrada fuera del periodo', () => {
    const summary = buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-old', branchId: 'branch-1', resolvedAt: '2026-07-10T12:00:00.000Z',
        amount: 200_000, recoveredCost: 0, cashAmount: 200_000,
      }],
    }, filters)
    expect(summary.accrued.revenue).toBe(1_000_000)
  })

  it('respeta el filtro por sucursal', () => {
    const summary = buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-other', branchId: 'branch-2', resolvedAt: '2026-08-20T12:00:00.000Z',
        amount: 200_000, recoveredCost: 0, cashAmount: 200_000,
      }],
    }, { ...filters, branchId: 'branch-1' })
    expect(summary.accrued.revenue).toBe(1_000_000)
  })
})

describe('pedidos de la tienda web en el resumen', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const emptyRecords = {
    sales: [], saleItems: [], salePayments: [], salePaymentTimingAvailable: true,
    creditPayments: [], creditPaymentTimingAvailable: true,
    repairs: [], repairParts: [], obligations: [], payrollEntries: [],
    financePayments: [], payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const orderRecord = {
    id: 'order-1',
    code: 'PED-1',
    branchId: 'branch-1',
    createdAt: '2026-08-06T10:00:00.000Z',
    status: 'DELIVERED',
    paymentStatus: 'PAID',
    totalAmount: 300_000,
    paidAmount: 300_000,
  }

  // El bug: pagar un pedido no genera una fila en `sales`, y el resumen solo
  // leia ventas y reparaciones. Toda la facturacion web quedaba en cero.
  it('cuenta el pedido como ingreso', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [orderRecord] },
      filters
    )
    expect(summary.accrued.revenue).toBe(300_000)
  })

  it('suma al cobrado solo el pedido pagado', () => {
    const paid = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [orderRecord] },
      filters
    )
    expect(paid.cash.collected).toBe(300_000)

    const pending = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [{ ...orderRecord, paymentStatus: 'PENDING' }] },
      filters
    )
    expect(pending.accrued.revenue).toBe(300_000)
    expect(pending.cash.collected).toBe(0)
  })

  it('ignora el pedido cancelado', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [{ ...orderRecord, status: 'CANCELLED' }] },
      filters
    )
    expect(summary.accrued.revenue).toBe(0)
  })

  it('respeta el periodo y la sucursal', () => {
    const outside = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [{ ...orderRecord, createdAt: '2026-07-06T10:00:00.000Z' }] },
      filters
    )
    expect(outside.accrued.revenue).toBe(0)

    const otherBranch = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [{ ...orderRecord, branchId: 'branch-2' }] },
      { ...filters, branchId: 'branch-1' }
    )
    expect(otherBranch.accrued.revenue).toBe(0)
  })

  // Los items del pedido no guardan el costo con el que se vendio, asi que no se
  // puede calcular margen: se declara sin cobertura en lugar de inventarlo.
  it('marca el resultado como incompleto porque el pedido no tiene costo', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [orderRecord] },
      filters
    )
    expect(summary.complete).toBe(false)
    expect(summary.accrued.grossProfit).toBeNull()
  })

  it('sin pedidos el resumen no cambia', () => {
    const summary = buildFinanceSummaryFromRecords(emptyRecords, filters)
    expect(summary.accrued.revenue).toBe(0)
    expect(summary.cash.collected).toBe(0)
  })
})

describe('pagos a tecnicos en el resumen', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const emptyRecords = {
    sales: [], saleItems: [], salePayments: [], salePaymentTimingAvailable: true,
    creditPayments: [], creditPaymentTimingAvailable: true,
    repairs: [], repairParts: [], obligations: [], payrollEntries: [],
    financePayments: [], payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const payment = {
    id: 'tech-1',
    paidAt: '2026-08-09T10:00:00.000Z',
    amount: 400_000,
    method: 'efectivo',
    status: 'pagado',
  }

  // El bug: el pago al tecnico salia de la caja y el resumen solo miraba
  // `payroll_entries`, asi que ese costo de mano de obra no llegaba a la utilidad.
  it('cuenta el pago como costo de mano de obra', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, technicianPayments: [payment] },
      filters
    )
    expect(summary.accrued.payrollCost).toBe(400_000)
  })

  it('lo cuenta como plata que salio de la caja', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, technicianPayments: [payment] },
      filters
    )
    expect(summary.cash.paid).toBe(400_000)
    expect(summary.cash.netCashFlow).toBe(-400_000)
  })

  it('ignora los anulados y los pendientes', () => {
    for (const status of ['anulado', 'pendiente']) {
      const summary = buildFinanceSummaryFromRecords(
        { ...emptyRecords, technicianPayments: [{ ...payment, status }] },
        filters
      )
      expect(summary.accrued.payrollCost).toBe(0)
      expect(summary.cash.paid).toBe(0)
    }
  })

  it('ignora los pagos de otro periodo', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, technicianPayments: [{ ...payment, paidAt: '2026-07-09T10:00:00.000Z' }] },
      filters
    )
    expect(summary.accrued.payrollCost).toBe(0)
  })

  it('se suma a la nomina administrativa sin reemplazarla', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...emptyRecords,
        payrollEntries: [{
          id: 'entry-1', branchId: null, employeeId: 'emp-1',
          netAmount: 1_000_000, status: 'approved', approvedAt: '2026-08-05',
        }],
        technicianPayments: [payment],
      } as unknown as FinanceSummaryRecords,
      filters
    )
    expect(summary.accrued.payrollCost).toBe(1_400_000)
  })

  it('sin pagos el resumen no cambia', () => {
    const summary = buildFinanceSummaryFromRecords(emptyRecords, filters)
    expect(summary.accrued.payrollCost).toBe(0)
    expect(summary.cash.paid).toBe(0)
  })
})

describe('costo de los pedidos web', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const emptyRecords = {
    sales: [], saleItems: [], salePayments: [], salePaymentTimingAvailable: true,
    creditPayments: [], creditPaymentTimingAvailable: true,
    repairs: [], repairParts: [], obligations: [], payrollEntries: [],
    financePayments: [], payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const order = {
    id: 'order-1', code: 'PED-1', branchId: null,
    createdAt: '2026-08-06T10:00:00.000Z',
    status: 'DELIVERED', paymentStatus: 'PAID',
    totalAmount: 300_000, paidAmount: 300_000,
  }

  it('calcula margen real cuando el pedido tiene costo capturado', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...emptyRecords,
        orders: [order],
        orderItems: [{ orderId: 'order-1', productId: 'p1', quantity: 2, unitCost: 80_000 }],
      },
      filters
    )

    expect(summary.accrued.revenue).toBe(300_000)
    expect(summary.accrued.directCosts).toBe(160_000)
    expect(summary.accrued.grossProfit).toBe(140_000)
    expect(summary.complete).toBe(true)
  })

  // Un pedido anterior a la migracion de snapshots no tiene costo: se declara
  // incompleto en vez de estimarlo con la lista de precios de hoy.
  it('queda sin cobertura si el pedido no tiene snapshot', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...emptyRecords, orders: [order] },
      filters
    )
    expect(summary.complete).toBe(false)
    expect(summary.accrued.grossProfit).toBeNull()
  })

  it('queda sin cobertura si algun item del pedido no tiene costo', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...emptyRecords,
        orders: [order],
        orderItems: [
          { orderId: 'order-1', productId: 'p1', quantity: 1, unitCost: 80_000 },
          { orderId: 'order-1', productId: 'p2', quantity: 1, unitCost: null },
        ],
      },
      filters
    )
    expect(summary.complete).toBe(false)
    // El costo conocido igual se cuenta: no se descarta lo que si se sabe.
    expect(summary.accrued.directCosts).toBe(80_000)
  })
})

describe('cobros fechados de reparaciones', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const base = {
    sales: [], saleItems: [], salePayments: [], salePaymentTimingAvailable: true,
    creditPayments: [], creditPaymentTimingAvailable: true,
    repairParts: [], obligations: [], payrollEntries: [],
    financePayments: [], payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const repair = {
    id: 'rep-1', ticketNumber: 'REP-77', branchId: null,
    createdAt: '2026-08-04T10:00:00.000Z', status: 'delivered',
    revenueAmount: 200_000, paidAmount: 200_000,
  }

  const payment = {
    repairId: 'rep-1', branchId: null,
    paymentDate: '2026-08-05T12:00:00.000Z',
    paymentMethod: 'cash', amount: 200_000,
  }

  it('no avisa si el acumulado esta respaldado por el libro de cobros', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [repair],
        repairPayments: [payment],
        repairPaymentsBySelectedRepair: [payment],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.coverageWarnings).toHaveLength(0)
    expect(summary.complete).toBe(true)
  })

  // El motivo del cambio: antes esto sumaba cero y la plata cobrada por
  // reparaciones no aparecia en ningun lado de la vista de caja.
  it('cuenta el cobro de la reparacion en la caja del periodo', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [repair],
        repairPayments: [payment],
        repairPaymentsBySelectedRepair: [payment],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.cash.collected).toBe(200_000)
  })

  it('excluye del efectivo lo financiado: esa parte se cobra como cuota', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [repair],
        repairPayments: [{ ...payment, paymentMethod: 'credit' }],
        repairPaymentsBySelectedRepair: [{ ...payment, paymentMethod: 'credit' }],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.cash.collected).toBe(0)
    // Pero si respalda el acumulado: es un cobro con fecha.
    expect(summary.coverageWarnings).toHaveLength(0)
  })

  it('avisa nombrando el ticket si el acumulado supera lo registrado', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [repair],
        repairPayments: [{ ...payment, amount: 50_000 }],
        repairPaymentsBySelectedRepair: [{ ...payment, amount: 50_000 }],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.coverageWarnings).toHaveLength(1)
    expect(summary.coverageWarnings[0].code).toBe('MISSING_CASH_TIMING')
    expect(summary.coverageWarnings[0].sourceLabel).toBe('Reparación REP-77')
  })

  // Un cobro posterior al periodo respalda igual el acumulado: acotar la
  // cobertura por fecha daria un aviso falso al mirar un mes cerrado.
  it('acepta un cobro posterior al periodo como respaldo', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [repair],
        repairPayments: [],
        repairPaymentsBySelectedRepair: [
          { ...payment, paymentDate: '2026-09-03T12:00:00.000Z' },
        ],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.coverageWarnings).toHaveLength(0)
    expect(summary.cash.collected).toBe(0)
  })

  it('sigue avisando si el despliegue no tiene la tabla de cobros', () => {
    const summary = buildFinanceSummaryFromRecords(
      { ...base, repairs: [repair], repairPaymentTimingAvailable: false },
      filters
    )
    expect(summary.coverageWarnings[0]?.code).toBe('MISSING_CASH_TIMING')
  })

  it('no avisa por una reparacion sin cobrar', () => {
    const summary = buildFinanceSummaryFromRecords(
      {
        ...base,
        repairs: [{ ...repair, paidAmount: 0 }],
        repairPayments: [],
        repairPaymentsBySelectedRepair: [],
        repairPaymentTimingAvailable: true,
      },
      filters
    )
    expect(summary.coverageWarnings).toHaveLength(0)
  })
})
