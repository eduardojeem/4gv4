import { formatCurrency, getDisplayLocale } from '@/lib/currency'

/**
 * Credit History Ticket — 80mm thermal printer format
 * Same style as POS receipts
 */

export interface CreditHistoryTicketInput {
  customerName: string
  customerCode?: string
  customerPhone?: string
  companyName: string
  companyPhone?: string
  companyAddress?: string
  credits: Array<{
    creditCode?: string
    id: string
    principal: number
    remainingBalance?: number
    status: string
    startDate: string
    termMonths: number
    installments?: Array<{
      number: number
      dueDate: string
      amount: number
      amountPaid: number
      status: string
    }>
  }>
  totalDebt: number
  totalPaid: number
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Pagado',
  defaulted: 'Mora',
  cancelled: 'Cancelado',
  paid: 'Pagado',
  pending: 'Pend.',
  overdue: 'Vencido',
  late: 'Atrasado',
  partial: 'Parcial',
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] || s
}

export const TICKET_WIDTH_MM = 80
const MARGIN = 4
const USABLE_W = TICKET_WIDTH_MM - MARGIN * 2

export async function createCreditHistoryTicket(input: CreditHistoryTicketInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  // Estimate height — be generous to avoid cutoff
  let estimatedH = 80 // header + customer + summary + footer
  for (const credit of input.credits) {
    estimatedH += 16 // credit header + info line + separator
    if (credit.installments?.length) {
      estimatedH += 8 + credit.installments.length * 5 // table header + rows
    }
  }
  estimatedH = Math.max(150, Math.min(2000, estimatedH))

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [TICKET_WIDTH_MM, estimatedH],
  })

  const now = new Date()
  let y = MARGIN

  // ─── HEADER ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(input.companyName, TICKET_WIDTH_MM / 2, y + 4, { align: 'center' })
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  if (input.companyPhone) {
    doc.text(input.companyPhone, TICKET_WIDTH_MM / 2, y + 3, { align: 'center' })
    y += 3.5
  }
  if (input.companyAddress) {
    doc.text(input.companyAddress, TICKET_WIDTH_MM / 2, y + 3, { align: 'center', maxWidth: USABLE_W })
    y += 3.5
  }

  // Separator
  y += 2
  doc.setDrawColor(0)
  doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(MARGIN, y, TICKET_WIDTH_MM - MARGIN, y)
  doc.setLineDashPattern([], 0)
  y += 3

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('HISTORIAL DE CREDITO', TICKET_WIDTH_MM / 2, y + 3, { align: 'center' })
  y += 6

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Fecha: ${now.toLocaleDateString(getDisplayLocale())} ${now.toLocaleTimeString(getDisplayLocale(), { hour: '2-digit', minute: '2-digit' })}`, MARGIN, y + 3)
  y += 5

  // ─── CUSTOMER ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(`Cliente: ${input.customerName}`, MARGIN, y + 3)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  if (input.customerCode) {
    doc.text(`Cod: ${input.customerCode}`, MARGIN, y + 3)
    y += 3.5
  }
  if (input.customerPhone) {
    doc.text(`Tel: ${input.customerPhone}`, MARGIN, y + 3)
    y += 3.5
  }

  // Separator
  y += 2
  doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(MARGIN, y, TICKET_WIDTH_MM - MARGIN, y)
  doc.setLineDashPattern([], 0)
  y += 3

  // ─── SUMMARY ────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('RESUMEN', MARGIN, y + 3)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Creditos activos: ${input.credits.filter(c => c.status === 'active').length}`, MARGIN, y + 2.5)
  doc.text(`Total pagado: ${formatCurrency(input.totalPaid)}`, MARGIN + USABLE_W / 2, y + 2.5)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text(`SALDO PENDIENTE: ${formatCurrency(input.totalDebt)}`, MARGIN, y + 3)
  doc.setFont('helvetica', 'normal')
  y += 5

  // Separator
  doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(MARGIN, y, TICKET_WIDTH_MM - MARGIN, y)
  doc.setLineDashPattern([], 0)
  y += 3

  // ─── CREDITS + INSTALLMENTS ─────────────────────────────────────────
  for (const credit of input.credits) {
    const code = credit.creditCode || credit.id.slice(0, 8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(`Credito: ${code}`, MARGIN, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(`${statusLabel(credit.status)}`, TICKET_WIDTH_MM - MARGIN, y + 3, { align: 'right' })
    y += 4

    doc.text(`Capital: ${formatCurrency(credit.principal)}  |  Plazo: ${credit.termMonths}m  |  Saldo: ${formatCurrency(credit.remainingBalance ?? 0)}`, MARGIN, y + 2.5)
    y += 4

    if (credit.installments && credit.installments.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Venc.', 'Monto', 'Pagado', 'Estado']],
        body: credit.installments.map(inst => [
          String(inst.number),
          new Date(inst.dueDate).toLocaleDateString(getDisplayLocale(), { day: '2-digit', month: '2-digit' }),
          formatCurrency(inst.amount),
          formatCurrency(inst.amountPaid),
          statusLabel(inst.status),
        ]),
        theme: 'plain',
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 6,
          halign: 'center',
          cellPadding: 1,
        },
        bodyStyles: { fontSize: 6, cellPadding: 1 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          1: { halign: 'center', cellWidth: 14 },
          2: { halign: 'right', cellWidth: 18 },
          3: { halign: 'right', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 15 },
        },
        margin: { left: MARGIN, right: MARGIN },
        tableWidth: USABLE_W,
      })

      y = (doc as any).lastAutoTable.finalY + 3
    }

    // Small separator between credits
    doc.setLineDashPattern([0.3, 0.8], 0)
    doc.line(MARGIN + 10, y, TICKET_WIDTH_MM - MARGIN - 10, y)
    doc.setLineDashPattern([], 0)
    y += 3
  }

  // ─── FOOTER ─────────────────────────────────────────────────────────
  y += 2
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100)
  doc.text('Este documento es informativo.', TICKET_WIDTH_MM / 2, y + 2, { align: 'center' })
  doc.text('Conserve como referencia de su estado de cuenta.', TICKET_WIDTH_MM / 2, y + 5, { align: 'center' })

  return doc
}
