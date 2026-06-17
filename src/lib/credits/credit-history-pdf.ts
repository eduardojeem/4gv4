import { formatCurrency } from '@/lib/currency'

export interface CreditHistoryItem {
  id: string
  creditCode?: string
  principal: number
  interestRate: number
  termMonths: number
  startDate: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled' | string
  totalPaid?: number
  remainingBalance?: number
  installments?: Array<{
    number: number
    dueDate: string
    amount: number
    amountPaid: number
    status: string
  }>
}

export interface CreditHistoryPdfInput {
  customerName: string
  customerCode?: string
  customerPhone?: string
  companyName: string
  companyPhone?: string
  companyAddress?: string
  generatedAt?: Date
  credits: CreditHistoryItem[]
  totalDebt: number
  totalPaid: number
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  defaulted: 'En mora',
  cancelled: 'Cancelado',
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  partial: 'Parcial',
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status
}

export async function createCreditHistoryPdf(input: CreditHistoryPdfInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  const usableW = pageW - margin * 2
  const now = input.generatedAt || new Date()

  // ─── HEADER ───────────────────────────────────────────────────────────
  doc.setFillColor(30, 64, 175) // blue-800
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(input.companyName, margin, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (input.companyPhone) doc.text(input.companyPhone, margin, 18)
  if (input.companyAddress) doc.text(input.companyAddress, margin, 23)

  doc.setFontSize(10)
  doc.text('HISTORIAL DE CRÉDITO', pageW - margin, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.text(`Emitido: ${now.toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageW - margin, 18, { align: 'right' })

  // ─── CUSTOMER INFO ────────────────────────────────────────────────────
  doc.setTextColor(0)
  let y = 36

  doc.setFillColor(243, 244, 246) // gray-100
  doc.roundedRect(margin, y, usableW, 18, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Cliente: ${input.customerName}`, margin + 4, y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const metaItems = [
    input.customerCode ? `Código: ${input.customerCode}` : '',
    input.customerPhone ? `Tel: ${input.customerPhone}` : '',
  ].filter(Boolean)
  if (metaItems.length) {
    doc.text(metaItems.join('  |  '), margin + 4, y + 13)
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────
  y += 24

  doc.setFillColor(239, 246, 255) // blue-50
  doc.roundedRect(margin, y, usableW / 3 - 2, 14, 2, 2, 'F')
  doc.setFillColor(240, 253, 244) // green-50
  doc.roundedRect(margin + usableW / 3 + 1, y, usableW / 3 - 2, 14, 2, 2, 'F')
  doc.setFillColor(254, 242, 242) // red-50
  doc.roundedRect(margin + (usableW / 3) * 2 + 2, y, usableW / 3 - 2, 14, 2, 2, 'F')

  doc.setFontSize(7)
  doc.setTextColor(100)
  doc.text('CRÉDITOS ACTIVOS', margin + 4, y + 5)
  doc.text('TOTAL PAGADO', margin + usableW / 3 + 5, y + 5)
  doc.text('SALDO PENDIENTE', margin + (usableW / 3) * 2 + 6, y + 5)

  doc.setFontSize(11)
  doc.setTextColor(30, 64, 175)
  doc.setFont('helvetica', 'bold')
  doc.text(String(input.credits.filter(c => c.status === 'active').length), margin + 4, y + 11)
  doc.setTextColor(22, 163, 74)
  doc.text(formatCurrency(input.totalPaid), margin + usableW / 3 + 5, y + 11)
  doc.setTextColor(220, 38, 38)
  doc.text(formatCurrency(input.totalDebt), margin + (usableW / 3) * 2 + 6, y + 11)

  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  // ─── CREDITS TABLE ────────────────────────────────────────────────────
  y += 20

  const tableBody = input.credits.map(credit => [
    credit.creditCode || credit.id.slice(0, 8),
    formatCurrency(credit.principal),
    `${credit.interestRate}%`,
    `${credit.termMonths} meses`,
    new Date(credit.startDate).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    statusLabel(credit.status),
    formatCurrency(credit.remainingBalance ?? 0),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Capital', 'Interés', 'Plazo', 'Inicio', 'Estado', 'Saldo']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    styles: { overflow: 'linebreak' },
  })

  const afterTable = (doc as any).lastAutoTable.finalY

  // ─── INSTALLMENTS DETAIL (per credit) ─────────────────────────────────
  let currentY = afterTable + 8

  for (const credit of input.credits) {
    if (!credit.installments || credit.installments.length === 0) continue

    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage()
      currentY = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 64, 175)
    doc.text(`Cuotas — ${credit.creditCode || credit.id.slice(0, 8)} (${formatCurrency(credit.principal)})`, margin, currentY)
    doc.setTextColor(0)
    currentY += 4

    const installmentRows = credit.installments.map(inst => [
      `#${inst.number}`,
      new Date(inst.dueDate).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      formatCurrency(inst.amount),
      formatCurrency(inst.amountPaid),
      formatCurrency(Math.max(0, inst.amount - inst.amountPaid)),
      statusLabel(inst.status),
    ])

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Vencimiento', 'Monto', 'Pagado', 'Pendiente', 'Estado']],
      body: installmentRows,
      theme: 'grid',
      headStyles: {
        fillColor: [100, 116, 139], // slate-500
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
      },
      margin: { left: margin + 5, right: margin + 5 },
    })

    currentY = (doc as any).lastAutoTable.finalY + 6
  }

  // ─── FOOTER ───────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150)
  doc.text(
    `Documento generado el ${now.toLocaleString('es-PY')} — ${input.companyName}`,
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  )

  return doc
}
