import { describe, expect, it } from 'vitest'
import {
  buildCreditInfoRows,
  buildPaymentDetailRows,
  buildAccountStatusRows,
  buildInstallmentPlanRows,
  getCreditInstallmentProgress,
  projectPaidInstallments,
  createCreditPaymentReceiptPdf,
  getCreditPaymentReceiptHeight,
} from './payment-receipt'

const base = {
  paymentId: 'pago-1',
  paymentAmount: 500_000,
  customerName: 'Maria Gonzalez',
  creditId: 'cred-1',
}

describe('avance del plan de cuotas', () => {
  it('ubica la cuota dentro del plan', () => {
    const p = getCreditInstallmentProgress({
      installmentNumber: 3,
      totalInstallments: 12,
      paidInstallmentsCount: 3,
    })
    expect(p.current).toBe(3)
    expect(p.total).toBe(12)
    expect(p.pending).toBe(9)
    expect(p.ratio).toBeCloseTo(0.25)
  })

  it('deriva lo pendiente del total, no del otro contador', () => {
    // Son dos consultas distintas y pueden no sumar; el papel no puede decir
    // "3 pagadas y 20 pendientes" de un plan de 12.
    const p = getCreditInstallmentProgress({
      totalInstallments: 12,
      paidInstallmentsCount: 3,
      pendingInstallmentsCount: 20,
    })
    expect(p.pending).toBe(9)
  })

  it('no imprime "13 de 12" si el dato viene inconsistente', () => {
    const p = getCreditInstallmentProgress({ totalInstallments: 12, paidInstallmentsCount: 13 })
    expect(p.paid).toBe(12)
    expect(p.pending).toBe(0)
    expect(p.ratio).toBe(1)
  })

  it('funciona sin total conocido', () => {
    const p = getCreditInstallmentProgress({ paidInstallmentsCount: 4, pendingInstallmentsCount: 2 })
    expect(p.total).toBeNull()
    expect(p.paid).toBe(4)
    expect(p.pending).toBe(2)
    expect(p.ratio).toBeNull()
  })
})

describe('filas del plan en el comprobante', () => {
  it('escribe la cuota como "3 de 12" y el avance', () => {
    const filas = buildInstallmentPlanRows({
      ...base,
      installmentNumber: 3,
      totalInstallments: 12,
      paidInstallmentsCount: 3,
    })
    expect(filas).toEqual([
      ['CUOTA ABONADA', '3 de 12'],
      ['Cuotas pagadas', '3 de 12  (25%)'],
      ['Cuotas que faltan', '9 cuotas'],
    ])
  })

  it('usa singular cuando falta una sola', () => {
    const filas = buildInstallmentPlanRows({
      ...base, installmentNumber: 11, totalInstallments: 12, paidInstallmentsCount: 11,
    })
    expect(filas).toContainEqual(['Cuotas que faltan', '1 cuota'])
  })

  it('avisa cuando el plan quedo completo', () => {
    const filas = buildInstallmentPlanRows({
      ...base, installmentNumber: 12, totalInstallments: 12, paidInstallmentsCount: 12,
    })
    expect(filas).toContainEqual(['Cuotas que faltan', 'Ninguna, plan completado'])
  })

  it('no inventa una seccion cuando no hay datos de cuotas', () => {
    expect(buildInstallmentPlanRows(base)).toEqual([])
  })

  it('sirve para un pago del credito entero, sin cuota puntual', () => {
    // Al saldar todo no hay una cuota abonada, pero si hay avance que mostrar.
    const filas = buildInstallmentPlanRows({
      ...base, totalInstallments: 12, paidInstallmentsCount: 12,
    })
    expect(filas.some(([k]) => k === 'CUOTA ABONADA')).toBe(false)
    expect(filas).toContainEqual(['Cuotas pagadas', '12 de 12  (100%)'])
  })
})

describe('conteo que se imprime tras cobrar', () => {
  it('cuenta la cuota que se acaba de pagar', () => {
    // Sin esto el cliente paga la cuota 4 y el papel que recibe dice "3 de 12":
    // el comprobante no cuenta el pago que tiene en la mano.
    const r = projectPaidInstallments({
      paidBefore: 3,
      totalInstallments: 12,
      paymentAmount: 500_000,
      installmentOutstanding: 500_000,
    })
    expect(r).toEqual({ paid: 4, pending: 8 })
  })

  it('no la cuenta si el pago fue parcial', () => {
    const r = projectPaidInstallments({
      paidBefore: 3,
      totalInstallments: 12,
      paymentAmount: 200_000,
      installmentOutstanding: 500_000,
    })
    // La cuota sigue abierta: contarla seria decirle que ya la salvo.
    expect(r).toEqual({ paid: 3, pending: 9 })
  })

  it('cierra el plan entero cuando se salda toda la deuda', () => {
    const r = projectPaidInstallments({
      paidBefore: 3,
      totalInstallments: 12,
      paymentAmount: 4_500_000,
      remainingBefore: 4_500_000,
      paysWholeCredit: true,
    })
    expect(r).toEqual({ paid: 12, pending: 0 })
  })

  it('un pago parcial del credito entero no cierra nada', () => {
    const r = projectPaidInstallments({
      paidBefore: 3,
      totalInstallments: 12,
      paymentAmount: 1_000_000,
      remainingBefore: 4_500_000,
      installmentOutstanding: 4_500_000,
      paysWholeCredit: true,
    })
    expect(r.paid).toBe(3)
  })

  it('nunca pasa del total del plan', () => {
    const r = projectPaidInstallments({
      paidBefore: 12,
      totalInstallments: 12,
      paymentAmount: 500_000,
      installmentOutstanding: 500_000,
    })
    expect(r).toEqual({ paid: 12, pending: 0 })
  })

  it('se abstiene si no sabe cuantas habia pagadas', () => {
    expect(projectPaidInstallments({ paymentAmount: 500_000 })).toEqual({ paid: null, pending: null })
  })
})

describe('la seccion sale impresa', () => {
  const conPlan = {
    ...base,
    businessName: 'Comercial San Miguel',
    installmentNumber: 3,
    totalInstallments: 12,
    paidInstallmentsCount: 3,
    currentCreditBalance: 4_500_000,
  }

  it('aparece en los tres formatos de papel', async () => {
    for (const format of ['58mm', '80mm', 'A4'] as const) {
      const { doc } = await createCreditPaymentReceiptPdf(conPlan, { format })
      const texto = (doc as unknown as { internal: { pages: string[][] } }).internal.pages[1].join(' ')
      // El titulo se acorta en papel angosto, asi que lo que se verifica es el
      // dato, que es igual en los tres.
      expect(texto, `formato ${format}`).toContain('3 de 12')
      expect(texto, `formato ${format}`).toContain('CUOTAS')
    }
  })

  it('en 58 mm usa etiquetas que no se parten en dos lineas', async () => {
    const { doc } = await createCreditPaymentReceiptPdf(conPlan, { format: '58mm' })
    const texto = (doc as unknown as { internal: { pages: string[][] } }).internal.pages[1].join(' ')
    // Con las largas, autoTable quebraba "CUOTA ABONADA" dentro de su celda y la
    // seccion ocupaba el doble de alto.
    expect(texto).toContain('(CUOTA)')
    expect(texto).not.toContain('ABONADA')
  })

  it('el rollo reserva alto para la seccion nueva', () => {
    // Si el alto no la contempla, el ticket se corta justo donde el cliente
    // busca cuanto le falta. Se usa contenido largo porque por debajo de 220 mm
    // manda el alto minimo del comprobante y las dos medidas darian igual.
    const relleno = { notes: 'Observacion larga para superar el alto minimo del comprobante. '.repeat(45) }
    const sin = getCreditPaymentReceiptHeight({ ...base, ...relleno }, 80)
    const con = getCreditPaymentReceiptHeight({ ...conPlan, ...relleno }, 80)
    expect(sin).toBeGreaterThan(220)
    expect(con).toBeGreaterThan(sin)
  })

  it('no repite la cuota en dos secciones distintas', async () => {
    const { doc } = await createCreditPaymentReceiptPdf(conPlan, { format: '80mm' })
    const texto = (doc as unknown as { internal: { pages: string[][] } }).internal.pages[1].join(' ')
    // Antes decia "Cuota Pagada: Cuota #3 de 6" en el detalle del pago y las
    // pendientes en el estado de cuenta; ahora todo vive en una sola seccion.
    expect(texto).not.toContain('Cuota Pagada')
    expect(texto).not.toContain('Cuotas por Pagar')
  })
})

describe('fechas de vencimiento impresas', () => {
  // En America/Asuncion `new Date('2026-01-01')` cae el 31/12/2025 a las 21:00,
  // asi que todo vencimiento se imprimia un dia antes del real. En un
  // comprobante de credito eso es la fecha equivocada en el papel del cliente.
  const casos: Array<[string, string]> = [
    ['2026-01-01', '01/01/2026'],
    ['2026-09-15', '15/09/2026'],
    ['2026-12-31', '31/12/2026'],
  ]

  it.each(casos)('el vencimiento de la cuota %s se imprime %s', (fecha, esperado) => {
    const filas = buildPaymentDetailRows({
      paymentId: 'p', paymentAmount: 1, customerName: 'x', creditId: 'c',
      installmentDueDate: fecha,
    })
    expect(filas.find(([k]) => k.startsWith('Vence') || k.startsWith('Vencimiento'))?.[1]).toBe(esperado)
  })

  it.each(casos)('el proximo vencimiento %s se imprime %s', (fecha, esperado) => {
    const filas = buildAccountStatusRows({
      paymentId: 'p', paymentAmount: 1, customerName: 'x', creditId: 'c',
      nextDueDate: fecha,
    })
    expect(filas.find(([k]) => k.includes('venc') || k.includes('Venc'))?.[1]).toContain(esperado)
  })
})

describe('etiquetas en papel angosto', () => {
  it('acorta las que no entran en 58 mm', () => {
    const entrada = {
      paymentId: 'p', paymentAmount: 500_000, customerName: 'x', creditId: 'c',
      customerId: 'cli', customerCode: 'CLI-1',
      totalCreditAmount: 6_000_000, totalInstallments: 12,
      installmentAmount: 500_000, paymentMethod: 'cash',
    }
    const largas = [
      ...buildCreditInfoRows(entrada),
      ...buildPaymentDetailRows(entrada),
    ].map(([k]) => k)
    const cortas = [
      ...buildCreditInfoRows(entrada, { compacto: true }),
      ...buildPaymentDetailRows(entrada, { compacto: true }),
    ].map(([k]) => k)

    expect(largas).toContain('Total Financiado')
    expect(cortas).toContain('Financiado')
    expect(largas).toContain('MONTO ABONADO')
    expect(cortas).toContain('ABONADO')
    // Ninguna etiqueta corta debe pasar de lo que entra en una linea de 58 mm.
    for (const etiqueta of cortas) {
      expect(etiqueta.length, etiqueta).toBeLessThanOrEqual(12)
    }
  })
})
