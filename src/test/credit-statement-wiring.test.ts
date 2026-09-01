import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los generadores del estado de cuenta (A4 y ticket de 80mm) estuvieron 465
 * lineas completas sin que nadie los llamara: existia el codigo, pero no habia
 * forma de imprimirle a un cliente su deuda. Estas pruebas fijan el cableado
 * para que no vuelva a quedar huerfano.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const dialog = leer('src/components/dashboard/credits/CreditDetailDialog.tsx')
const page = leer('src/app/dashboard/credits/page.tsx')

describe('cableado del estado de cuenta', () => {
  it('el dialog llama a los dos generadores', () => {
    expect(dialog).toContain('createCreditHistoryPdf')
    expect(dialog).toContain('createCreditHistoryTicket')
  })

  it('ofrece las tres salidas: imprimir A4, ticket y descargar', () => {
    expect(dialog).toMatch(/printStatementPdf/)
    expect(dialog).toMatch(/printStatementTicket/)
    expect(dialog).toMatch(/exportStatementPdf/)
  })

  it('la pagina le pasa todos los creditos, no solo el abierto', () => {
    // Sin esto el estado de cuenta cubriria un unico credito y el total de deuda
    // seria menor al real.
    expect(page).toMatch(/allCredits=\{credits\}/)
    expect(page).toMatch(/allInstallments=\{installments\}/)
  })

  it('la pantalla y los documentos comparten la regla de estado de cuota', () => {
    expect(dialog).toContain('resolveInstallmentStatus')
    // La copia local que existia antes hacia que un documento pudiera decir
    // "Pendiente" sobre una cuota que la pantalla mostraba vencida.
    expect(dialog).not.toMatch(/if \(new Date\(inst\.due_date\) < new Date\(\)\)/)
  })

  it('los generadores saben traducir una cuota atrasada', () => {
    // 'late' es un estado real del sistema; sin etiqueta se imprimia la palabra
    // en ingles dentro de un documento en espanol.
    for (const ruta of [
      'src/lib/credits/credit-history-pdf.ts',
      'src/lib/credits/credit-history-ticket.ts',
    ]) {
      expect(leer(ruta)).toMatch(/late: '/)
    }
  })

  it('los generadores usan el idioma configurado', () => {
    for (const ruta of [
      'src/lib/credits/credit-history-pdf.ts',
      'src/lib/credits/credit-history-ticket.ts',
    ]) {
      const contenido = leer(ruta)
      expect(contenido).toContain('getDisplayLocale')
      expect(contenido).not.toMatch(/toLocale\w*\(\s*'[a-z]{2}-[A-Z]{2}'/)
    }
  })
})
