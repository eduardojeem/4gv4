export interface PayrollExportEntry {
  id: string
  employee_id: string
  employee_display_name: string
  employee_role: string
  base_amount?: number
  commission_amount?: number
  adjustment_amount?: number
  net_amount: number
  paid_amount: number
  outstanding_amount: number
}
export interface PayrollExportRun {
  id: string
  status: 'draft' | 'approved' | 'voided'
  period_from: string
  period_to: string
}

export function payrollExportStatus(run: PayrollExportRun, entry: PayrollExportEntry) {
  if (run.status === 'draft') return 'Borrador - no aprobado'
  if (run.status === 'voided') return 'Anulada'
  if (entry.outstanding_amount <= 0) return 'Pagada'
  return entry.paid_amount > 0 ? 'Pago parcial' : 'Aprobada - pendiente de pago'
}

export function payrollCsvCell(value: string | number) {
  const text = String(value)
  const safe = /^\s*[=+\-@\t\r]/.test(text) ? "'" + text : text
  return '"' + safe.replace(/"/g, '""') + '"'
}

/** Exports stored payroll snapshots; never recalculates current compensation. */
export async function downloadPayrollEntryPdf(run: PayrollExportRun, entry: PayrollExportEntry) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Liquidacion individual de nomina', 14, 20)
  doc.setFontSize(10)
  const heading = doc.splitTextToSize(`${(entry.employee_display_name || entry.employee_id).slice(0, 200)} (${entry.employee_role.slice(0, 50)})`, 180)
  doc.text(heading, 14, 30)
  const y = 34 + heading.length * 5
  doc.text(`Periodo: ${run.period_from} a ${run.period_to}`, 14, y)
  doc.text(`Estado: ${payrollExportStatus(run, entry)}`, 14, y + 7)
  const { formatCurrency } = await import('@/lib/currency')
  const amount = (value: number | undefined) => value === undefined ? 'No disponible' : formatCurrency(Number(value))
  autoTable(doc, {
    startY: y + 14,
    head: [['Concepto', 'Importe']],
    body: [
      ['Sueldo base', amount(entry.base_amount)],
      ['Comisiones', amount(entry.commission_amount)],
      ['Ajustes (bonos, descuentos y anticipos)', amount(entry.adjustment_amount)],
      ['Total neto', amount(entry.net_amount)],
      ['Pagado', amount(entry.paid_amount)],
      ['Saldo pendiente', amount(entry.outstanding_amount)],
    ],
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { bottom: 45 },
  })
  doc.setFontSize(9)
  doc.text('Importes guardados en la liquidacion. Descargar no confirma un pago.', 14, 264)
  doc.text(`Nomina: ${run.id}`, 14, 272)
  doc.text(`Empleado: ${entry.employee_id}`, 14, 279)
  doc.save(`nomina-${run.period_from}-${entry.id}.pdf`)
}
