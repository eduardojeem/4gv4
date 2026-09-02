import { describe, expect, it } from 'vitest'
import { buildCreditDueDate, buildCreditInstallmentPlan } from './installments'
import { buildPosCreditSummary } from './pos-credit-summary'

describe('buildCreditInstallmentPlan', () => {
  it('splits the financed total including interest into installments', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 100000,
      interestRate: 10,
      installmentCount: 4,
      frequency: 'monthly',
      now: new Date('2026-06-15T00:00:00.000Z'),
    })

    expect(plan.financedTotal).toBe(110000)
    expect(plan.interestAmount).toBe(10000)
    expect(plan.installments).toHaveLength(4)
    expect(plan.installments.map(installment => installment.amount)).toEqual([27500, 27500, 27500, 27500])
    expect(plan.installments.reduce((sum, installment) => sum + installment.amount, 0)).toBe(110000)
  })

  it('calculates five monthly installments with ten percent interest', () => {
    const plan = buildCreditInstallmentPlan({
      firstInstallmentTiming: 'next_cycle',
      principalAmount: 100000,
      interestRate: 10,
      installmentCount: 5,
      frequency: 'monthly',
      now: new Date('2026-06-15T00:00:00.000Z'),
    })

    expect(plan.interestAmount).toBe(10000)
    expect(plan.financedTotal).toBe(110000)
    expect(plan.installments.map(installment => installment.amount)).toEqual([22000, 22000, 22000, 22000, 22000])
    expect(plan.installments[0].dueDate.toISOString()).toBe('2026-07-15T00:00:00.000Z')
  })

  it('builds the POS credit total used by summary and receipt', () => {
    const summary = buildPosCreditSummary(100000, {
      firstInstallmentTiming: 'next_cycle',
      count: 5,
      frequency: 'monthly',
      interestRate: 10,
    }, { now: new Date(2026, 5, 15) })

    expect(summary.baseTotal).toBe(100000)
    expect(summary.interestAmount).toBe(10000)
    expect(summary.financedTotal).toBe(110000)
    expect(summary.installmentAmount).toBe(22000)
    expect(summary.firstDueDate).toBe('2026-07-15')
  })

  it.each([
    ['weekly', '2026-06-22'],
    ['biweekly', '2026-06-30'],
    ['monthly', '2026-07-15'],
  ] as const)('exposes the first %s due date for the checkout and receipt', (frequency, expectedDate) => {
    const summary = buildPosCreditSummary(100000, {
      firstInstallmentTiming: 'next_cycle',
      count: 3,
      frequency,
      interestRate: 0,
    }, { now: new Date(2026, 5, 15) })

    expect(summary.firstDueDate).toBe(expectedDate)
  })

  it('keeps rounding remainders in the last installment', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 100,
      interestRate: 10,
      installmentCount: 3,
      frequency: 'weekly',
      now: new Date('2026-06-15T00:00:00.000Z'),
      // Este caso comprueba el sobrante con matematica de centavos. La moneda
      // era implicita y quedaba atada a la configurada por defecto; ahora se
      // declara, porque en guaranies el reparto es en enteros.
      fractionDigits: 2,
    })

    expect(plan.installments.map(installment => installment.amount)).toEqual([36.66, 36.66, 36.68])
    expect(plan.installments.reduce((sum, installment) => Number((sum + installment.amount).toFixed(2)), 0)).toBe(110)
  })

  it('starts on the provided due date when one is selected', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 900,
      installmentCount: 2,
      frequency: 'biweekly',
      firstDueDate: new Date('2026-07-01T00:00:00.000Z'),
      startInstallmentNumber: 5,
    })

    expect(plan.installments[0].installmentNumber).toBe(5)
    expect(plan.installments[0].dueDate.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(plan.installments[1].dueDate.toISOString()).toBe('2026-07-16T00:00:00.000Z')
  })
})

describe('vencimientos mensuales a fin de mes', () => {
  const dias = (inicio: string, cantidad: number) => {
    const base = new Date(`${inicio}T12:00:00.000Z`)
    return Array.from({ length: cantidad }, (_, index) =>
      buildCreditDueDate(base, index, 'monthly', true).toISOString().slice(0, 10),
    )
  }

  it('no saltea febrero en un credito firmado el 31', () => {
    // Con setMonth() sobre la fecha completa esto daba 3 de marzo en la segunda
    // cuota, porque el 31 de febrero no existe y JavaScript lo pasa de largo.
    expect(dias('2026-01-31', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('recupera el dia pactado apenas el mes lo permite', () => {
    // La cuota de febrero se recorta al 28, pero marzo vuelve al 31: el recorte
    // se calcula contra cada mes y no se arrastra.
    const fechas = dias('2026-01-31', 6)
    expect(fechas[1]).toBe('2026-02-28')
    expect(fechas[2]).toBe('2026-03-31')
    expect(fechas[4]).toBe('2026-05-31')
  })

  it('usa el 29 de febrero en un anio bisiesto', () => {
    expect(dias('2028-01-31', 2)).toEqual(['2028-01-31', '2028-02-29'])
  })

  it('mantiene el dia 30 en los meses que lo tienen', () => {
    expect(dias('2026-01-30', 4)).toEqual([
      '2026-01-30',
      '2026-02-28',
      '2026-03-30',
      '2026-04-30',
    ])
  })

  it('deja intacto un dia que existe en todos los meses', () => {
    expect(dias('2026-01-15', 3)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('no altera las frecuencias semanal ni quincenal', () => {
    // Esas avanzan por dias y nunca sufrieron el desborde; el arreglo no debe
    // haberlas tocado.
    const base = new Date('2026-01-31T12:00:00.000Z')
    expect(buildCreditDueDate(base, 1, 'weekly', true).toISOString().slice(0, 10)).toBe('2026-02-07')
    expect(buildCreditDueDate(base, 1, 'biweekly', true).toISOString().slice(0, 10)).toBe('2026-02-15')
  })

  it('el plan completo respeta el dia pactado', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 900000,
      installmentCount: 3,
      frequency: 'monthly',
      firstDueDate: new Date('2026-01-31T12:00:00.000Z'),
    })

    expect(plan.installments.map((cuota) => cuota.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })
})

describe('reparto segun los decimales de la moneda', () => {
  const montos = (total: number, cuotas: number, fractionDigits: number) =>
    buildCreditInstallmentPlan({
      principalAmount: total,
      installmentCount: cuotas,
      fractionDigits,
    }).installments.map((cuota) => cuota.amount)

  it('en guaranies reparte en enteros y la suma cierra', () => {
    // Con dos decimales fijos daba 33.333,33 tres veces: en pantalla se veian
    // tres cuotas de 33.333 y el cliente sumaba 99.999, no 100.000.
    const cuotas = montos(100_000, 3, 0)

    expect(cuotas).toEqual([33_333, 33_333, 33_334])
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(100_000)
    expect(cuotas.every(Number.isInteger)).toBe(true)
  })

  it('el sobrante entero queda en la ultima cuota', () => {
    const cuotas = montos(500_000, 6, 0)

    expect(cuotas.slice(0, 5)).toEqual(Array(5).fill(83_333))
    expect(cuotas[5]).toBe(83_335)
    expect(cuotas.reduce((a, b) => a + b, 0)).toBe(500_000)
  })

  it('en monedas con centavos sigue repartiendo con dos decimales', () => {
    // El sistema admite USD, BRL y otras con centavos: forzar enteros ahi
    // habria roto el reparto.
    const cuotas = montos(100, 3, 2)

    expect(cuotas).toEqual([33.33, 33.33, 33.34])
    expect(Number(cuotas.reduce((a, b) => a + b, 0).toFixed(2))).toBe(100)
  })

  it('reparte tambien el interes sin perder importe', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 1_000_000,
      interestRate: 10,
      installmentCount: 3,
      fractionDigits: 0,
    })

    expect(plan.financedTotal).toBe(1_100_000)
    expect(plan.installments.reduce((total, cuota) => total + cuota.amount, 0)).toBe(1_100_000)
  })

  it('una sola cuota se lleva el total exacto', () => {
    expect(montos(99_999, 1, 0)).toEqual([99_999])
  })
})
