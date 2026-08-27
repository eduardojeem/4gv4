/**
 * Utilidad profesional para exportación de reportes en PDF para POS y Caja
 * Utiliza jsPDF y jsPDF-AutoTable con soporte multi-sección y diferenciación de Turnos Abiertos y Cerrados
 */

export interface PdfSection {
  title?: string
  description?: string
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
  columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number | 'auto' | 'wrap' }>
}

export interface PdfExportOptions {
  filename: string
  title: string
  subtitle?: string
  generatedBy?: string
  orientation?: 'portrait' | 'landscape'
  summaryStats?: Array<{ label: string; value: string | number }>
  sections?: PdfSection[]
  headers?: string[]
  rows?: Array<Array<string | number | null | undefined>>
  columnStyles?: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number | 'auto' | 'wrap' }>
}

export async function downloadPdfReport({
  filename,
  title,
  subtitle,
  generatedBy,
  orientation = 'landscape',
  summaryStats = [],
  sections,
  headers,
  rows,
  columnStyles = {}
}: PdfExportOptions) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 28

  // 1. BANNER INSTITUCIONAL SUPERIOR
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageWidth, 60, 'F')

  // Título Institucional
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title.toUpperCase(), margin, 25)

  // Subtítulo y Emisión
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225) // Slate 300
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const subText = subtitle ? `${subtitle}   |   ` : ''
  doc.text(`${subText}Emitido: ${dateStr} ${timeStr}   |   Por: ${generatedBy || 'Operador Autorizado'}`, margin, 45)

  let currentY = 74

  // 2. RESUMEN EJECUTIVO DE KPIS (SI EXISTE)
  if (summaryStats.length > 0) {
    const cardWidth = (pageWidth - (margin * 2) - ((summaryStats.length - 1) * 8)) / summaryStats.length
    const cardHeight = 36

    summaryStats.forEach((stat, idx) => {
      const cardX = margin + idx * (cardWidth + 8)
      
      // Fondo Card
      doc.setFillColor(248, 250, 252) // Slate 50
      doc.setDrawColor(226, 232, 240) // Slate 200
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 4, 4, 'FD')

      // Label
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(100, 116, 139) // Slate 500
      doc.text(stat.label.toUpperCase(), cardX + 7, currentY + 13)

      // Value
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(15, 23, 42) // Slate 900
      doc.text(String(stat.value), cardX + 7, currentY + 28)
    })

    currentY += cardHeight + 14
  }

  // 3. SECCIONES O TABLA ÚNICA
  const tableSections: PdfSection[] = sections && sections.length > 0
    ? sections
    : (headers && rows ? [{ headers, rows, columnStyles }] : [])

  tableSections.forEach((sec, idx) => {
    // Si la sección tiene título
    if (sec.title) {
      if (currentY > pageHeight - 90) {
        doc.addPage()
        currentY = 40
      }

      // Título de Sección
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text(sec.title.toUpperCase(), margin, currentY + 4)
      currentY += 12

      if (sec.description) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text(sec.description, margin, currentY + 2)
        currentY += 12
      }
    }

    autoTable(doc, {
      startY: currentY,
      head: [sec.headers],
      body: sec.rows.map(r => r.map(c => (c === null || c === undefined ? '—' : String(c)))),
      theme: 'grid',
      margin: { left: margin, right: margin, bottom: 35 },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
        textColor: [30, 41, 59],
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.2,
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: sec.columnStyles || columnStyles,
      didParseCell: (data) => {
        const cellText = String(data.cell.raw || '')
        
        // Fila divisoria especial
        if (cellText.startsWith('---') || cellText.startsWith('TOTAL') || cellText.startsWith('FASE')) {
          data.cell.styles.fillColor = [241, 245, 249]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [15, 23, 42]
        }

        // Resaltar Apertura
        if (cellText.includes('APERTURA') || cellText.includes('Apertura')) {
          data.cell.styles.fillColor = [236, 253, 245]
          data.cell.styles.textColor = [6, 95, 70]
          data.cell.styles.fontStyle = 'bold'
        }

        // Resaltar Cierre Z
        if (cellText.includes('CIERRE') || cellText.includes('Cierre')) {
          data.cell.styles.fillColor = [255, 241, 242]
          data.cell.styles.textColor = [159, 18, 57]
          data.cell.styles.fontStyle = 'bold'
        }

        // Sobrante
        if (cellText.includes('Sobrante')) {
          data.cell.styles.textColor = [180, 83, 9]
          data.cell.styles.fontStyle = 'bold'
        }

        // Faltante
        if (cellText.includes('Faltante')) {
          data.cell.styles.textColor = [225, 29, 72]
          data.cell.styles.fontStyle = 'bold'
        }

        // Caja Exacta
        if (cellText.includes('Exacta') || cellText.includes('Caja Exacta')) {
          data.cell.styles.textColor = [5, 150, 105]
          data.cell.styles.fontStyle = 'bold'
        }

        // Turno en Curso
        if (cellText.includes('En Curso') || cellText.includes('Turno en Curso')) {
          data.cell.styles.fillColor = [236, 253, 245]
          data.cell.styles.textColor = [5, 150, 105]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      didDrawPage: (data) => {
        // Pie de página profesional
        const pageNumber = (doc as any).internal.getNumberOfPages()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)

        doc.setDrawColor(226, 232, 240)
        doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

        doc.text(
          'Garantía de Auditoría: Documento oficial generado por el Sistema POS. Datos trazables e inmutables.',
          margin,
          pageHeight - 12
        )

        doc.text(
          `Página ${pageNumber}`,
          pageWidth - margin - 35,
          pageHeight - 12
        )
      }
    })

    currentY = (doc as any).lastAutoTable.finalY + 18
  })

  // Guardar documento
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  doc.save(cleanFilename)
}
