import { formatCurrency as formatCurrencyBase, getDisplayLocale } from '@/lib/currency'
import { formatDateOnlyDisplay } from '@/lib/date-only'
import { formatCreditId } from '@/lib/utils'
import { toPdfText } from '@/lib/credits/paper'
import type { CustomerStatement } from '@/lib/credits/customer-statement'

/**
 * Ficha completa de un cliente en A4: sus datos, su situación, todos sus
 * créditos con las cuotas y todos sus pagos.
 *
 * Antes el único PDF de la ficha decía «4G - PUNTO DE VENTA» en vez del nombre
 * del comercio y traía solo nombre, contacto y cuatro totales. Para entregarle a
 * un cliente (o archivar) lo que debe y lo que pagó había que juntar el estado
 * de cuenta de Créditos con capturas de pantalla.
 */

export type CustomerFilePayment = {
  createdAt: string
  amount: number
  method: string
  creditCode: string
  installmentNumber?: number | null
  notes?: string | null
}

export type CustomerFileInput = {
  company: { name: string; ruc?: string; phone?: string; address?: string }
  customer: {
    name: string
    code?: string
    ruc?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    status?: string
    segment?: string
    since?: string | null
  }
  situation: {
    creditLimit: number
    totalDebt: number
    overdueDebt: number
    availableCredit: number
    storeBalance?: number | null
    totalSpent?: number | null
    purchases?: number | null
    nextDue?: { date: string; amount: number } | null
  }
  /** Cuotas y reparaciones pendientes, como las muestra la ficha. */
  debts?: Array<{ title: string; detail?: string; dueDate?: string | null; overdue?: boolean; pending: number; total: number }>
  statement: CustomerStatement
  payments: CustomerFilePayment[]
  generatedAt?: Date
}

const money = (value: number) => toPdfText(formatCurrencyBase(value))
const dateOnly = (value?: string | null) =>
  value ? formatDateOnlyDisplay(value, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const STATUS: Record<string, string> = {
  active: 'Activo', completed: 'Pagado', defaulted: 'En mora', cancelled: 'Anulado',
  paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida', late: 'Atrasada', partial: 'Parcial',
}

const SEGMENT: Record<string, string> = { vip: 'VIP', wholesale: 'Mayorista', business: 'Empresa', regular: 'Regular' }

const ALTO_CABECERA = 24
const ALTO_PIE = 12

export async function createCustomerFilePdf(input: CustomerFileInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15
  const width = pageW - margin * 2
  const now = input.generatedAt ?? new Date()
  const tableMargin = { left: margin, right: margin, top: ALTO_CABECERA + 6, bottom: ALTO_PIE + 2 }
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  let y = ALTO_CABECERA + 10

  const title = (text: string) => {
    if (y + 20 > pageH - ALTO_PIE) {
      doc.addPage()
      y = ALTO_CABECERA + 10
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text(text.toUpperCase(), margin, y)
    doc.setDrawColor(0)
    doc.setLineWidth(0.4)
    doc.line(margin, y + 1.5, margin + width, y + 1.5)
    y += 5
  }

  const keyValues = (rows: Array<[string, string]>) => {
    // Dos pares por renglón: la ficha entra en una hoja.
    const body: string[][] = []
    for (let i = 0; i < rows.length; i += 2) {
      body.push([rows[i][0], rows[i][1], rows[i + 1]?.[0] ?? '', rows[i + 1]?.[1] ?? ''])
    }
    autoTable(doc, {
      startY: y,
      body,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.6, textColor: 0, font: 'helvetica' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: width * 0.18 },
        1: { cellWidth: width * 0.32 },
        2: { fontStyle: 'bold', cellWidth: width * 0.18 },
        3: { cellWidth: width * 0.32 },
      },
      margin: tableMargin,
    })
    y = lastY() + 7
  }

  // ─── Datos del cliente ─────────────────────────────────────────────────
  title('Datos del cliente')
  const c = input.customer
  keyValues([
    ['Nombre', c.name],
    ['Código', c.code || '—'],
    ['CI / RUC', c.ruc || '—'],
    ['Teléfono', c.phone || '—'],
    ['Email', c.email || '—'],
    ['Dirección', [c.address, c.city].filter(Boolean).join(', ') || '—'],
    ['Estado', c.status === 'inactive' ? 'Inactivo' : 'Activo'],
    ['Segmento', SEGMENT[c.segment ?? ''] ?? (c.segment || 'Regular')],
    ...(c.since ? [['Cliente desde', dateOnly(c.since)] as [string, string]] : []),
  ])

  // ─── Situación ─────────────────────────────────────────────────────────
  title('Situación')
  const s = input.situation
  keyValues([
    ['Deuda total', money(s.totalDebt)],
    ['Deuda vencida', money(s.overdueDebt)],
    ['Límite de crédito', s.creditLimit > 0 ? money(s.creditLimit) : 'Sin límite'],
    ['Cupo disponible', money(s.availableCredit)],
    ['Próximo vencimiento', s.nextDue ? `${dateOnly(s.nextDue.date)} · ${money(s.nextDue.amount)}` : 'Sin cuotas pendientes'],
    ['Total pagado en cuotas', money(input.statement.totalPaid)],
    ...(s.storeBalance != null ? [['Saldo a favor', money(s.storeBalance)] as [string, string]] : []),
    ...(s.totalSpent != null ? [['Total comprado', money(s.totalSpent)] as [string, string]] : []),
    ...(s.purchases != null ? [['Compras', String(s.purchases)] as [string, string]] : []),
  ])

  // ─── Deudas pendientes ─────────────────────────────────────────────────
  const debts = input.debts ?? []
  if (debts.length > 0) {
    title(`Deudas pendientes (${debts.length})`)
    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Vence', 'Total', 'Pendiente']],
      body: debts.map((debt) => [
        [debt.title, debt.detail].filter(Boolean).join(' · '),
        `${dateOnly(debt.dueDate)}${debt.overdue ? ' (vencida)' : ''}`,
        money(debt.total),
        money(debt.pending),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.15 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      margin: tableMargin,
    })
    y = lastY() + 7
  }

  // ─── Créditos ──────────────────────────────────────────────────────────
  title(`Créditos (${input.statement.credits.length})`)
  if (input.statement.credits.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('No tiene créditos en cuotas.', margin, y + 3)
    y += 10
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Crédito', 'Inicio', 'Estado', 'Total', 'Pagado', 'Saldo', 'Cuotas']],
      body: input.statement.credits.map((credit) => {
        const rows = credit.installments ?? []
        const paidCount = rows.filter((row) => row.status === 'paid').length
        const total = rows.length ? rows.reduce((sum, row) => sum + row.amount, 0) : credit.principal
        return [
          credit.creditCode || formatCreditId(credit.id),
          dateOnly(credit.startDate),
          STATUS[credit.status] ?? credit.status,
          money(total),
          money(credit.totalPaid ?? 0),
          money(credit.remainingBalance ?? 0),
          rows.length ? `${paidCount} de ${rows.length}` : '—',
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.15 },
      columnStyles: { 0: { fontStyle: 'bold' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }, 6: { halign: 'center' } },
      margin: tableMargin,
    })
    y = lastY() + 7

    // Las cuotas de cada crédito, para que la ficha diga qué vence y cuándo.
    for (const credit of input.statement.credits) {
      const rows = credit.installments ?? []
      if (rows.length === 0) continue
      if (y + 18 > pageH - ALTO_PIE) {
        doc.addPage()
        y = ALTO_CABECERA + 10
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`Cuotas · ${credit.creditCode || formatCreditId(credit.id)}`, margin, y)
      y += 2
      autoTable(doc, {
        startY: y,
        head: [['#', 'Vence', 'Monto', 'Pagado', 'Pendiente', 'Estado']],
        body: rows.map((row) => [
          String(row.number),
          dateOnly(row.dueDate),
          money(row.amount),
          money(row.amountPaid),
          money(Math.max(0, row.amount - row.amountPaid)),
          STATUS[row.status] ?? row.status,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [235, 235, 235], textColor: 0, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1.2 },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' }, 5: { halign: 'center' } },
        margin: { ...tableMargin, left: margin + 4, right: margin + 4 },
      })
      y = lastY() + 5
    }
    y += 2
  }

  // ─── Pagos ─────────────────────────────────────────────────────────────
  const totalPayments = input.payments.reduce((sum, payment) => sum + payment.amount, 0)
  title(`Pagos (${input.payments.length})${input.payments.length ? ` · Total ${money(totalPayments)}` : ''}`)
  if (input.payments.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Todavía no hay pagos de cuotas registrados.', margin, y + 3)
    y += 10
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Monto', 'Medio', 'Aplicado a', 'Notas']],
      body: input.payments.map((payment) => [
        toPdfText(new Date(payment.createdAt).toLocaleString(getDisplayLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
        money(payment.amount),
        payment.method,
        `${payment.creditCode}${payment.installmentNumber ? ` · Cuota ${payment.installmentNumber}` : ''}`,
        payment.notes || '',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.15 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 4: { cellWidth: width * 0.28 } },
      margin: tableMargin,
    })
  }

  // ─── Cabecera y pie en todas las páginas ───────────────────────────────
  const pages = doc.getNumberOfPages()
  const companyLine = [input.company.ruc ? `RUC ${input.company.ruc}` : '', input.company.phone ?? '', input.company.address ?? '']
    .filter(Boolean)
    .join('  ·  ')
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(input.company.name || 'Ficha del cliente', margin, 12, { maxWidth: width * 0.6 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (companyLine) doc.text(companyLine, margin, 17, { maxWidth: width * 0.6 })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('FICHA DEL CLIENTE', pageW - margin, 12, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(input.customer.name, pageW - margin, 17, { align: 'right', maxWidth: width * 0.38 })
    doc.setDrawColor(0)
    doc.setLineWidth(0.6)
    doc.line(margin, ALTO_CABECERA - 2, pageW - margin, ALTO_CABECERA - 2)

    doc.setFontSize(7.5)
    doc.text(toPdfText(`Emitido el ${now.toLocaleString(getDisplayLocale())}`), margin, pageH - 7)
    doc.text(`Página ${page} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' })
  }

  return doc
}
