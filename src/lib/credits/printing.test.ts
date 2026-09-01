import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatCurrency } from '@/lib/currency'
import { createCreditHistoryTicket, findNextDueInstallment } from './credit-history-ticket'
import { createCreditHistoryPdf, type CreditHistoryItem } from './credit-history-pdf'
import { createCreditPaymentReceiptPdf, buildAccountStatusRows, getCreditPaymentReceiptTarget } from './payment-receipt'
import { getCreditPaperMetrics, CREDIT_PAPER_WIDTH_MM } from './paper'

const EMISOR = {
  companyName: 'Comercial San Miguel S.R.L.',
  companyRuc: '80012345-6',
  companyPhone: '021 555 000',
  companyAddress: 'Avda. Mcal. Lopez 1234 c/ Boqueron, Asuncion',
}

const credito = (n: number, cuotas: number) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  creditCode: `CR-${n}`,
  principal: 5_000_000,
  interestRate: 12,
  termMonths: cuotas,
  startDate: '2025-01-15',
  status: 'active',
  totalPaid: 1_000_000,
  remainingBalance: 4_000_000,
  installments: Array.from({ length: cuotas }, (_, i) => ({
    number: i + 1,
    dueDate: `2026-0${(i % 9) + 1}-15`,
    amount: 500_000,
    amountPaid: i < 2 ? 500_000 : 0,
    status: i < 2 ? 'paid' : 'pending',
  })),
})

const entrada = (nc: number, ni: number) => ({
  customerName: 'Maria Gonzalez de Benitez',
  customerCode: 'CLI-00123',
  customerPhone: '0981 123456',
  ...EMISOR,
  credits: Array.from({ length: nc }, (_, i) => credito(i + 1, ni)),
  totalDebt: 4_000_000 * nc,
  totalPaid: 1_000_000 * nc,
})

/** El texto de un PDF de jsPDF vive en el flujo de cada pagina. */
function textoDePagina(doc: unknown, pagina: number): string {
  return (doc as { internal: { pages: string[][] } }).internal.pages[pagina]?.join(' ') ?? ''
}

describe('estado de cuenta en rollo', () => {
  it('respeta el ancho de papel elegido', async () => {
    for (const format of ['58mm', '80mm'] as const) {
      const doc = await createCreditHistoryTicket(entrada(2, 6), { format })
      expect(doc.internal.pageSize.getWidth()).toBe(CREDIT_PAPER_WIDTH_MM[format])
    }
  })

  it('no recorta el contenido de un cliente con muchos creditos', async () => {
    // El generador anterior estimaba la altura y la limitaba a 2000 mm: pasado
    // ese punto el contenido desaparecia sin aviso. Este caso lo superaba.
    const doc = await createCreditHistoryTicket(entrada(15, 36), { format: '80mm' })
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(2000)
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('ajusta la altura al contenido en vez de usar una fija', async () => {
    const corto = await createCreditHistoryTicket(entrada(1, 3), { format: '80mm' })
    const largo = await createCreditHistoryTicket(entrada(4, 12), { format: '80mm' })
    expect(largo.internal.pageSize.getHeight()).toBeGreaterThan(corto.internal.pageSize.getHeight())
    // Y no desperdicia medio metro de rollo en un documento corto.
    expect(corto.internal.pageSize.getHeight()).toBeLessThan(200)
  })

  it('identifica al emisor', async () => {
    const doc = await createCreditHistoryTicket(entrada(1, 3), { format: '80mm' })
    const texto = textoDePagina(doc, 1)
    expect(texto).toContain('Comercial San Miguel')
    expect(texto).toContain('80012345-6')
  })
})

describe('estado de cuenta en A4', () => {
  it('identifica al emisor y numera TODAS las paginas', async () => {
    const doc = await createCreditHistoryPdf(entrada(6, 24) as unknown as Parameters<typeof createCreditHistoryPdf>[0])
    const total = doc.getNumberOfPages()
    expect(total).toBeGreaterThan(1)

    for (let p = 1; p <= total; p++) {
      const texto = textoDePagina(doc, p)
      // Antes solo la primera hoja tenia el nombre del comercio y solo la
      // ultima tenia pie: las del medio salian sin identificar y sin numero, y
      // sueltas sobre un mostrador no se sabia de quien eran ni si faltaba una.
      expect(texto, `pagina ${p} sin emisor`).toContain('San Miguel')
      expect(texto, `pagina ${p} sin numeracion`).toContain(`de ${total}`)
      expect(texto, `pagina ${p} sin pie`).toContain('Emitido el')
    }
  })

  it('muestra el proximo vencimiento en el resumen', async () => {
    const doc = await createCreditHistoryPdf(entrada(1, 6) as unknown as Parameters<typeof createCreditHistoryPdf>[0])
    expect(textoDePagina(doc, 1)).toContain('VENCIMIENTO')
  })
})

describe('proximo vencimiento', () => {
  const base = { id: 'c', principal: 0, remainingBalance: 0, startDate: '2026-01-01', termMonths: 3 }

  it('elige la cuota impaga mas cercana entre todos los creditos', () => {
    const r = findNextDueInstallment([
      { ...base, id: 'a', status: 'active', installments: [
        { number: 1, dueDate: '2026-06-10', amount: 100, amountPaid: 0, status: 'pending' },
      ] },
      { ...base, id: 'b', status: 'active', installments: [
        { number: 1, dueDate: '2026-03-10', amount: 200, amountPaid: 0, status: 'pending' },
      ] },
    ])
    expect(r?.dueDate).toBe('2026-03-10')
    expect(r?.amount).toBe(200)
  })

  it('ignora los creditos anulados y las cuotas ya pagadas', () => {
    const r = findNextDueInstallment([
      { ...base, id: 'anulado', status: 'cancelled', installments: [
        { number: 1, dueDate: '2026-01-10', amount: 999, amountPaid: 0, status: 'pending' },
      ] },
      { ...base, id: 'vivo', status: 'active', installments: [
        { number: 1, dueDate: '2026-02-10', amount: 100, amountPaid: 100, status: 'paid' },
        { number: 2, dueDate: '2026-05-10', amount: 300, amountPaid: 0, status: 'pending' },
      ] },
    ])
    expect(r?.dueDate).toBe('2026-05-10')
  })

  it('informa el saldo de una cuota pagada a medias, no su valor total', () => {
    const r = findNextDueInstallment([
      { ...base, status: 'active', installments: [
        { number: 1, dueDate: '2026-04-10', amount: 500, amountPaid: 200, status: 'pending' },
      ] },
    ])
    // Pedirle los 500 completos a quien ya pago 200 es cobrarle dos veces.
    expect(r?.amount).toBe(300)
  })

  it('devuelve null cuando no queda nada por pagar', () => {
    expect(findNextDueInstallment([{ ...base, status: 'completed', installments: [] }])).toBeNull()
  })
})

describe('comprobante de pago', () => {
  const pago = {
    paymentId: 'pago-0001',
    paymentAmount: 500_000,
    paymentMethod: 'cash',
    customerName: 'Maria Gonzalez',
    customerId: 'cli-1',
    creditId: 'cred-1',
    currentCreditBalance: 3_500_000,
    businessName: EMISOR.companyName,
    businessRuc: EMISOR.companyRuc,
    businessPhone: EMISOR.companyPhone,
    businessAddress: EMISOR.companyAddress,
  }

  it('nombra al comercio que lo emite', async () => {
    // `businessName` llegaba en la entrada y se descartaba: el comprobante salia
    // sin decir de que negocio era, que es lo primero que se le pide a un recibo
    // cuando hay que reclamar un pago.
    for (const format of ['58mm', '80mm', 'A4'] as const) {
      const { doc } = await createCreditPaymentReceiptPdf(pago, { format })
      const texto = textoDePagina(doc, 1)
      expect(texto, `formato ${format}`).toContain('San Miguel')
      expect(texto, `formato ${format}`).toContain('80012345-6')
    }
  })

  it('sale en el tamaño de papel pedido', async () => {
    const anchos: Record<string, number> = {}
    for (const format of ['58mm', '80mm', 'A4'] as const) {
      const { doc } = await createCreditPaymentReceiptPdf(pago, { format })
      anchos[format] = Math.round(doc.internal.pageSize.getWidth())
    }
    expect(anchos).toEqual({ '58mm': 58, '80mm': 80, 'A4': 210 })
  })

  it('en A4 no estira las columnas a lo ancho de la hoja', () => {
    const t = getCreditPaymentReceiptTarget('A4')
    // Una tabla de etiqueta y valor a 180 mm deja la etiqueta contra un borde y
    // el valor contra el otro. La columna centrada es lo que lo hace legible.
    expect(t.contentWidthMm).toBeLessThan(t.pageWidthMm * 0.7)
    expect(t.contentLeftMm).toBeGreaterThan(0)
    expect(t.labelColumnWidth + t.valueColumnWidth).toBeCloseTo(t.contentWidthMm, 5)
  })

  it('usa la moneda configurada al informar saldo cero', () => {
    const filas = buildAccountStatusRows({
      paymentId: 'p', paymentAmount: 0, customerName: 'x', creditId: 'c',
      currentCreditBalance: 0,
    })
    const saldada = filas.find(([etiqueta]) => etiqueta.includes('SALDO'))?.[1] ?? ''
    // El texto estaba escrito a mano como 'Gs. 0', asi que una tienda que
    // factura en reales o en dolares veia guaranies en su propio comprobante.
    // En una instalacion en guaranies el resultado se ve igual; lo que cambia es
    // que ahora sale del mismo helper que el resto de los montos.
    expect(saldada).toBe(`${formatCurrency(0)} (TOTALMENTE SALDADO)`)

    const fuente = readFileSync(resolve(process.cwd(), 'src/lib/credits/payment-receipt.ts'), 'utf8')
    expect(fuente).not.toMatch(/'Gs\. 0/)
  })
})

describe('metricas de papel', () => {
  it('achica la tipografia en el rollo angosto y la agranda en la hoja', () => {
    const a58 = getCreditPaperMetrics('58mm')
    const a80 = getCreditPaperMetrics('80mm')
    const a4 = getCreditPaperMetrics('A4')
    expect(a58.tableBodySize).toBeLessThan(a80.tableBodySize)
    expect(a4.bodySize).toBeGreaterThan(a80.bodySize)
  })

  it('deja el contenido dentro del papel en los tres formatos', () => {
    for (const format of ['58mm', '80mm', 'A4'] as const) {
      const m = getCreditPaperMetrics(format)
      expect(m.contentWidthMm + m.marginMm * 2).toBeLessThanOrEqual(m.pageWidthMm)
      expect(m.contentWidthMm).toBeGreaterThan(0)
    }
  })
})
