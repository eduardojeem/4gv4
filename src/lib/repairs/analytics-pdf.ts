import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function generateAnalyticsPDF(analyticsData: any, organizationName: string = 'Taller') {
  const doc = new jsPDF()
  
  // Encabezado
  doc.setFontSize(20)
  doc.setTextColor(40)
  doc.text('Reporte de Analytics de Reparaciones', 14, 22)
  
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Empresa: ${organizationName}`, 14, 30)
  doc.text(`Fecha de reporte: ${format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}`, 14, 35)

  // Métricas Principales
  doc.setFontSize(14)
  doc.setTextColor(40)
  doc.text('Resumen de Rendimiento', 14, 50)

  const metrics = analyticsData.metrics || {}
  
  const summaryBody = [
    ['Total Reparaciones', String(metrics.totalRepairs || 0)],
    ['Completadas', String(metrics.completedRepairs || 0)],
    ['En Proceso', String(metrics.inProgressRepairs || 0)],
    ['Tiempo Promedio (días)', String(Math.round(metrics.avgRepairTime || 0))],
    ['Tasa de Completado', `${Math.round(metrics.completionRate || 0)}%`],
    ['Entregas a Tiempo', `${Math.round(metrics.onTimeRate || 0)}%`],
    ['Reparaciones Urgentes', String(metrics.urgentRepairs || 0)],
    ['Ingresos Totales', `$${(metrics.totalRevenue || 0).toLocaleString()}`],
  ]

  autoTable(doc, {
    startY: 55,
    head: [['Métrica', 'Valor']],
    body: summaryBody,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  })

  // Distribución por Estado
  // @ts-ignore
  const finalY1 = doc.lastAutoTable.finalY || 55
  
  doc.setFontSize(14)
  doc.text('Distribución por Estado', 14, finalY1 + 15)
  
  const statusBody = (analyticsData.statusAnalysis || []).map((item: any) => [
    item.name, 
    String(item.count)
  ])

  autoTable(doc, {
    startY: finalY1 + 20,
    head: [['Estado', 'Cantidad']],
    body: statusBody,
    theme: 'grid',
    headStyles: { fillColor: [139, 92, 246] }
  })

  // Top Técnicos
  // @ts-ignore
  let finalY2 = doc.lastAutoTable.finalY || finalY1 + 20
  
  if (finalY2 > 230) {
    doc.addPage()
    finalY2 = 20
  } else {
    finalY2 += 15
  }

  doc.setFontSize(14)
  doc.text('Top Técnicos por Eficiencia', 14, finalY2)

  const techBody = (analyticsData.technicianAnalysis || []).map((tech: any, index: number) => [
    String(index + 1),
    tech.name,
    String(tech.completedRepairs),
    `${Math.round(tech.efficiency)}%`,
    `${Math.round(tech.avgTime)} días`
  ])

  autoTable(doc, {
    startY: finalY2 + 5,
    head: [['#', 'Técnico', 'Completadas', 'Eficiencia', 'Tiempo Prom.']],
    body: techBody,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] }
  })

  // Save the PDF
  doc.save(`analytics-reparaciones-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
