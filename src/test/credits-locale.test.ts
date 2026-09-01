import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La plataforma admite espanol, ingles y portugues, y doce monedas. Un locale
 * escrito a mano rompe eso en silencio: con 'es-AR' fijo, una instalacion
 * brasilena mostraba las fechas de sus cuotas y comprobantes en espanol
 * argentino.
 */
const archivos = [
  'src/lib/credits/payment-receipt.ts',
  'src/lib/date-only.ts',
  'src/components/dashboard/credits/CreditDetailDialog.tsx',
  'src/components/dashboard/credits/CreditPaymentDialog.tsx',
  'src/components/dashboard/credits/PaymentReceiptDialog.tsx',
  'src/components/dashboard/credits/PaymentsTimeline.tsx',
]

describe('idioma de fechas en creditos', () => {
  it.each(archivos)('%s no fija un locale a mano', (ruta) => {
    const contenido = readFileSync(resolve(process.cwd(), ruta), 'utf8')
    // Se buscan literales de locale, no menciones en comentarios.
    expect(contenido).not.toMatch(/toLocale\w*\(\s*'[a-z]{2}-[A-Z]{2}'/)
  })

  it('el helper compartido de fechas toma el idioma configurado', () => {
    const contenido = readFileSync(resolve(process.cwd(), 'src/lib/date-only.ts'), 'utf8')
    expect(contenido).toContain('locale = getDisplayLocale()')
  })

  it('el comprobante impreso usa el idioma configurado', () => {
    const contenido = readFileSync(resolve(process.cwd(), 'src/lib/credits/payment-receipt.ts'), 'utf8')
    expect(contenido).toContain('getDisplayLocale()')
  })
})
