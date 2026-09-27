/**
 * Formato de papel para los documentos de creditos.
 *
 * Hasta ahora cada generador decidia por su cuenta: el comprobante de pago
 * aceptaba un ancho pero nadie se lo pasaba, y el estado de cuenta tenia 80mm
 * escrito a mano. Un comercio con impresora de 58mm recibia un documento
 * cortado por los costados, y uno con laser A4 recibia una tira angosta en una
 * esquina de la hoja.
 *
 * Reparaciones ya resolvio esto dejando elegir entre 80mm, 58mm y A4 y
 * recordando la eleccion. Se sigue el mismo criterio para que el comerciante no
 * tenga que aprender dos sistemas distintos.
 */

export type CreditPaperFormat = '58mm' | '80mm' | 'A4'

export const CREDIT_PAPER_FORMATS: CreditPaperFormat[] = ['80mm', '58mm', 'A4']

export const CREDIT_PAPER_LABELS: Record<CreditPaperFormat, string> = {
  '80mm': 'Ticket 80 mm',
  '58mm': 'Ticket 58 mm',
  'A4': 'Hoja A4',
}

/** Ancho fisico del papel. El area imprimible real es algo menor. */
export const CREDIT_PAPER_WIDTH_MM: Record<CreditPaperFormat, number> = {
  '58mm': 58,
  '80mm': 80,
  'A4': 210,
}

export function isCreditPaperFormat(value: unknown): value is CreditPaperFormat {
  return value === '58mm' || value === '80mm' || value === 'A4'
}

/** Los dos rollos comparten diseño; la hoja necesita otro. */
export function isRollFormat(format: CreditPaperFormat): boolean {
  return format !== 'A4'
}

const STORAGE_KEY = 'creditReceiptPaper'
const DEFAULT_FORMAT: CreditPaperFormat = '80mm'

/**
 * La eleccion es del puesto de trabajo, no de la organizacion: en un mismo
 * comercio la caja imprime en rollo y la oficina en A4. Por eso vive en el
 * navegador y no en los ajustes compartidos.
 */
export function readCreditPaperFormat(): CreditPaperFormat {
  if (typeof window === 'undefined') return DEFAULT_FORMAT
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isCreditPaperFormat(saved) ? saved : DEFAULT_FORMAT
  } catch {
    // Ventana privada o almacenamiento bloqueado: no es motivo para no imprimir.
    return DEFAULT_FORMAT
  }
}

export function writeCreditPaperFormat(format: CreditPaperFormat): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, format)
  } catch {
    // Se pierde la preferencia, pero la impresion en curso igual sale.
  }
}

/**
 * Escala tipografica y de espaciado por formato. Un cuerpo de 7pt que se lee
 * bien en un rollo de 80mm queda diminuto en una hoja A4, y en 58mm hay que
 * ceder tamaño para que las columnas entren.
 */
export type CreditPaperMetrics = {
  format: CreditPaperFormat
  pageWidthMm: number
  /** Ancho de la columna de contenido. En A4 no ocupa toda la hoja. */
  contentWidthMm: number
  marginMm: number
  titleSize: number
  headingSize: number
  bodySize: number
  smallSize: number
  tableHeadSize: number
  tableBodySize: number
  cellPadding: number
  lineGap: number
}

export function getCreditPaperMetrics(format: CreditPaperFormat): CreditPaperMetrics {
  if (format === 'A4') {
    const pageWidthMm = CREDIT_PAPER_WIDTH_MM.A4
    return {
      format,
      pageWidthMm,
      contentWidthMm: pageWidthMm - 30,
      marginMm: 15,
      titleSize: 15,
      headingSize: 10,
      bodySize: 9,
      smallSize: 7.5,
      tableHeadSize: 8,
      tableBodySize: 8,
      cellPadding: 2.2,
      lineGap: 5,
    }
  }

  const angosto = format === '58mm'
  const pageWidthMm = CREDIT_PAPER_WIDTH_MM[format]
  const marginMm = angosto ? 3 : 4

  return {
    format,
    pageWidthMm,
    contentWidthMm: pageWidthMm - marginMm * 2,
    marginMm,
    titleSize: angosto ? 8.5 : 10,
    headingSize: angosto ? 7.5 : 8.5,
    bodySize: angosto ? 6.5 : 7.5,
    smallSize: angosto ? 5.5 : 6.5,
    tableHeadSize: angosto ? 5.5 : 6.5,
    tableBodySize: angosto ? 5.5 : 6.5,
    cellPadding: angosto ? 0.8 : 1,
    lineGap: angosto ? 3 : 3.5,
  }
}
