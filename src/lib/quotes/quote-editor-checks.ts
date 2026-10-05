/**
 * Qué le falta a un presupuesto antes de guardarlo. El editor lo muestra como
 * lista de pendientes y bloquea el guardado con el primer problema, en vez de
 * dejar que el servidor rechace una línea vacía.
 */

export type QuoteDraftLine = {
  description: string
  quantity: number
  unit_price: number
}

export type QuoteIssue = {
  kind: 'customer' | 'no_lines' | 'empty_description' | 'zero_price'
  message: string
  /** Índice de la línea afectada, cuando aplica. */
  line?: number
  /** Las advertencias no impiden guardar. */
  blocking: boolean
}

export function findQuoteIssues(customerName: string, lines: QuoteDraftLine[]): QuoteIssue[] {
  const issues: QuoteIssue[] = []
  if (!customerName.trim()) {
    issues.push({ kind: 'customer', message: 'Indicá para quién es el presupuesto', blocking: true })
  }
  if (lines.length === 0) {
    issues.push({ kind: 'no_lines', message: 'Agregá al menos un producto o servicio', blocking: true })
  }
  lines.forEach((line, index) => {
    if (!line.description.trim()) {
      issues.push({ kind: 'empty_description', message: `La línea ${index + 1} no tiene descripción`, line: index, blocking: true })
    } else if (!(Number(line.unit_price) > 0)) {
      issues.push({ kind: 'zero_price', message: `«${line.description.trim()}» está sin precio`, line: index, blocking: false })
    }
  })
  return issues
}
